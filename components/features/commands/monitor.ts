// /monitor 命令 — 内网检测状态
import type { CommandHandler } from "./registry";
import { apiGet } from "@/lib/utils/api";

interface MonitorAllResp {
  results?: { id: string; name: string; status: string; latency?: number | null; url?: string }[];
}

export const handler: CommandHandler = async (_args, ctx) => {
  const { toast } = await import("sonner");
  const d = await apiGet<MonitorAllResp>(null, "/api/v1/admin/monitor/all");
  if (!d) {
    toast.error("获取监控数据失败");
    ctx.setLoading(false);
    return;
  }
  const results = d.results || [];
  const statusIcons: Record<string, string> = { ok: "✅", timeout: "⏳", error: "❌" };
  ctx.setGroups([{
    label: `服务巡检（${results.filter((r) => r.status === "ok").length}/${results.length} 在线）`,
    items: results.map((r) => ({
      id: r.id, title: `${statusIcons[r.status] || "❓"} ${r.name}`,
      description: r.latency != null ? `${r.latency}ms` : "—", url: r.url,
    })),
  }]);
  ctx.setLoading(false);
};

