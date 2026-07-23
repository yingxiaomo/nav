// /ai 命令 — AI 快速问答
import type { CommandHandler, ExecutionContext } from "./registry";

export const handler: CommandHandler = async (args, ctx) => {
  const argsStr = args.join(" ");
  if (!argsStr) {
    // 没有问题 → 打开 AI 面板
    ctx.closePalette();
    const { useUIStore } = await import("@/lib/stores");
    useUIStore.getState().setActivePanel("ai");
    return;
  }
  try {
    const res = await fetch("/api/v1/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: argsStr }),
    });
    const data = await res.json();
    ctx.setGroups([{ label: "AI 回复", items: [{ id: "reply", title: data.reply || data.error, description: "" }] }]);
  } catch {
    const { toast } = await import("sonner");
    toast.error("AI 调用失败");
  }
  ctx.setLoading(false);
};
