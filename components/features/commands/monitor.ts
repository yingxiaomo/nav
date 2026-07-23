// /monitor 命令 — 内网检测状态
import type { CommandHandler, ExecutionContext } from "./registry";

export const handler: CommandHandler = async (_args, ctx) => {
  const { toast } = await import("sonner");
  try {
    const res = await fetch("/api/v1/admin/monitor/all");
    const d = await res.json();
    const results = d.results || [];
    const statusIcons: Record<string, string> = { ok: "✅", timeout: "⏳", error: "❌" };
    ctx.setGroups([{
      label: `服务巡检（${results.filter((r: any) => r.status === "ok").length}/${results.length} 在线）`,
      items: results.map((r: any) => ({
        id: r.id, title: `${statusIcons[r.status] || "❓"} ${r.name}`,
        description: r.latency != null ? `${r.latency}ms` : "—", url: r.url,
      })),
    }]);
  } catch {
    toast.error("获取监控数据失败");
  }
  ctx.setLoading(false);
};
