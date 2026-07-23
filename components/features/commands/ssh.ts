// /ssh 命令 — 远程连接设备 + 快速执行
import type { CommandHandler, ExecutionContext, DeviceAlias } from "./registry";

export async function loadDeviceAliases(): Promise<DeviceAlias[]> {
  const results: DeviceAlias[] = [];
  try {
    const res = await fetch("/api/v1/admin/monitor/checks");
    const d = await res.json();
    const targets = (d?.targets || []).map((t: any) => ({
      name: t.name, host: t.url, type: "monitor" as const, user: t.sshUser, pass: t.sshPass,
    }));
    results.push(...targets);
  } catch {}
  try {
    const res = await fetch("/api/v1/settings/device_config");
    const d = await res.json();
    if (d?.value) {
      const devices = JSON.parse(d.value);
      const aliases = (devices.devices || []).map((dv: any) => ({
        name: dv.name, host: dv.host, type: "device" as const, user: dv.username, pass: dv.password,
      }));
      results.push(...aliases);
    }
  } catch {}
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
  try {
    const res = await fetch("/api/v1/ssh/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: sshHost, user: alias.user || "root", pass: alias.pass || "", command: cmdStr }),
    });
    const data = await res.json();
    if (!res.ok) {
      const { toast } = await import("sonner");
      toast.error("SSH 失败: " + (data.error || data.message || "未知错误"));
      ctx.setLoading(false);
      return;
    }
    ctx.setGroups([{ label: `SSH ${alias.name}: ${cmdStr}`, items: [{ id: "output", title: data.output || "(无输出)", description: "" }] }]);
  } catch {
    const { toast } = await import("sonner");
    toast.error("SSH 执行失败");
  }
  ctx.setLoading(false);
};
