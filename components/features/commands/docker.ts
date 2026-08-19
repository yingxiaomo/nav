// /docker 命令 — 容器管理
import type { CommandHandler } from "./registry";
import { apiGet, apiWrite, request } from "@/lib/utils/api";

export const handler: CommandHandler = async (args, ctx) => {
  const argsStr = args.join(" ");
  const { toast } = await import("sonner");

  if (!argsStr) {
    try {
      const [conts, stats] = await Promise.all([
        apiGet<{ containers?: { id: string; name: string; image?: string; state?: string }[] }>(null, "/api/v1/admin/docker/containers"),
        apiGet<{ name: string; cpuPercent?: number; memUsage?: number }[]>(null, "/api/v1/admin/docker/stats"),
      ]);
      const statsMap: Record<string, { cpuPercent?: number; memUsage?: number }> = {};
      for (const s of stats || []) statsMap[s.name] = s;
      const items = (conts?.containers || []).map((c) => {
        const name = c.name.replace(/^\//, "");
        const st = statsMap[name];
        const info = st
          ? ` 💻${st.cpuPercent || "—"}% 🧠${(st.memUsage || 0) / 1048576 < 1024 ? ((st.memUsage || 0) / 1048576).toFixed(0) + "MB" : ((st.memUsage || 0) / 1073741824).toFixed(1) + "GB"}`
          : "";
        const desc = `${c.image?.split("/").pop()?.split(":")[0] || c.image} · ${c.state}${info}`;
        return { id: c.id, title: name, dockerName: name, description: desc };
      });
      ctx.setGroups([{ label: `Docker 容器 (${items.length})`, items }]);
    } catch {
      toast.error("获取容器列表失败");
    }
    ctx.setLoading(false);
    return;
  }

  const [action, ...nameParts] = args;
  const containerName = nameParts.join(" ");

  if (!containerName) {
    ctx.setGroups([{
      label: "Docker 操作", items: [
        { id: "ps", title: "📋 列出所有容器", description: "查看容器列表和资源占用", prefix: "docker", action: "list" },
        { id: "restart", title: "🔄 重启容器", description: "docker restart <容器名>", prefix: "docker" },
        { id: "start", title: "▶️ 启动容器", description: "docker start <容器名>", prefix: "docker" },
        { id: "stop", title: "⏹️ 停止容器", description: "docker stop <容器名>", prefix: "docker" },
        { id: "logs", title: "📜 查看日志", description: "docker logs <容器名>", prefix: "docker" },
      ],
    }]);
    ctx.setLoading(false);
    return;
  }

  const validActions = ["start", "stop", "restart"];
  if (validActions.includes(action)) {
    if (await apiWrite(null, `/api/v1/admin/docker/${encodeURIComponent(containerName)}/${action}`, { method: "POST" })) {
      toast.success(`Docker ${action} ${containerName} ✅`);
    } else {
      toast.error(`Docker ${action} 失败`);
    }
    ctx.closePalette();
  } else if (action === "logs") {
    const res = await request<string>(null, `/api/v1/admin/docker/logs/${encodeURIComponent(containerName)}`, { responseType: "text" });
    const logs = res.ok ? res.data : "";
    ctx.setGroups([{ label: `日志: ${containerName}`, items: [{ id: "logs", title: logs.slice(0, 2000) || "(空)", description: "" }] }]);
  } else {
    toast.error(`未知操作: ${action}，支持 start/stop/restart/logs`);
  }
  ctx.setLoading(false);
};

