// /stats 命令 — 系统资源仪表
import type { CommandHandler, ExecutionContext } from "./registry";

export const handler: CommandHandler = async (_args, ctx) => {
  const { toast } = await import("sonner");
  try {
    const res = await fetch("/api/v1/admin/monitor/all");
    const d = await res.json();
    const s = d.system;
    if (!s) {
      toast.error("获取系统信息失败");
      ctx.setLoading(false);
      return;
    }
    const items = [
      { id: "cpu", title: `💻 CPU  ${s.cpu.usage}%  ·  ${s.cpu.cores} 核`, description: `${(s.cpu.usage / s.cpu.cores).toFixed(0)}% / 核` },
      { id: "mem", title: `🧠 内存  ${(s.memory.used / 1073741824).toFixed(1)} GB / ${(s.memory.total / 1073741824).toFixed(1)} GB`, description: `${s.memory.usedPercent}% 已用` },
      { id: "disk", title: `💾 磁盘  ${(s.disk.used / 1073741824).toFixed(1)} GB / ${(s.disk.total / 1073741824).toFixed(1)} GB`, description: `${s.disk.usedPercent}% 已用` },
    ];
    ctx.setGroups([{ label: "📊 系统资源", items }]);
  } catch {
    toast.error("获取系统信息失败");
  }
  ctx.setLoading(false);
};
