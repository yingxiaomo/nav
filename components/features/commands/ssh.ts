// /ssh 命令 — 远程连接设备 + 快速执行
import type { CommandHandler, DeviceAlias } from "./registry";
import { request, apiGet } from "@/lib/utils/api";

export async function loadDeviceAliases(): Promise<DeviceAlias[]> {
  const results: DeviceAlias[] = [];
  const checks = await apiGet<{ targets?: { name: string; url?: string; sshUser?: string; sshPass?: string }[] }>(null, "/api/v1/admin/monitor/checks");
  for (const t of checks?.targets || []) {
    results.push({ name: t.name, host: t.url, type: "monitor" as const, user: t.sshUser, pass: t.sshPass });
  }
  const cfg = await apiGet<{ value?: string }>(null, "/api/v1/settings/device_config");
  if (cfg?.value) {
    try {
      const devices = JSON.parse(cfg.value);
      for (const dv of (devices.devices || [])) {
        results.push({ name: dv.name, host: dv.host, type: "device" as const, user: dv.username, pass: dv.password });
      }
    } catch { /* 配置损坏忽略 */ }
  }
  return results;
}

function extractHost(raw: string | undefined): string {
  if (!raw) return "";
  try { return new URL(raw).hostname; } catch { return raw; }
}

export const handler: CommandHandler = async (args, ctx) => {
  const aliases = await loadDeviceAliases();
  const argsStr = args.join(" ");

  if (!argsStr) {
    const sshDevices = aliases.filter(d => d.user && d.pass);
    if (sshDevices.length === 0) {
      ctx.setGroups([{
        label: "可用设备",
        items: [{ id: "none", title: "没有可 SSH 连接的设备", description: "请先在监控编辑弹窗中配置 SSH 账号密码", prefix: "" }],
      }]);
    } else {
      ctx.setGroups([{
        label: "可用设备",
        items: sshDevices.map(d => ({ id: d.name, title: d.name, description: d.host || "", alias: d })),
      }]);
    }
    ctx.setLoading(false);
    return;
  }

  const alias = aliases.find(d => argsStr.startsWith(d.name));
  if (!alias) {
    const { toast } = await import("sonner");
    toast.error(`未找到设备 "${argsStr}"`);
    ctx.setLoading(false);
    return;
  }

  const cmdStr = argsStr.slice(alias.name.length).trim();
  const sshHost = extractHost(alias.host);
  if (!sshHost) {
    const { toast } = await import("sonner");
    toast.error("设备没有可用的 SSH 地址");
    ctx.setLoading(false);
    return;
  }
  if (!alias.user && !alias.pass) {
    const { toast } = await import("sonner");
    toast.error(`「${alias.name}」未配置 SSH 凭证，请在监控右键 → 编辑里填写`);
    ctx.setLoading(false);
    return;
  }

  // 无命令 → 打开交互终端
  if (!cmdStr) {
    const { useUIStore } = await import("@/lib/stores");
    useUIStore.getState().openSSHConnection({
      name: alias.name, host: sshHost, user: alias.user || "root", pass: alias.pass || "",
    });
    ctx.setLoading(false);
    return;
  }

  // 有命令 → 快速执行
  const res = await request<{ output?: string; error?: string; message?: string }>(null, "/api/v1/ssh/exec", {
    method: "POST",
    body: { host: sshHost, user: alias.user || "root", pass: alias.pass || "", command: cmdStr },
  });
  if (!res.ok) {
    const { toast } = await import("sonner");
    toast.error("SSH 失败: " + (res.data?.error || res.data?.message || "未知错误"));
    ctx.setLoading(false);
    return;
  }
  ctx.setGroups([{ label: `SSH ${alias.name}: ${cmdStr}`, items: [{ id: "output", title: res.data?.output || "(无输出)", description: "" }] }]);
  ctx.setLoading(false);
};
