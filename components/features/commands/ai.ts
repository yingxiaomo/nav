// /ai 命令 — AI 快速问答
import type { CommandHandler } from "./registry";
import { request } from "@/lib/utils/api";

export const handler: CommandHandler = async (args, ctx) => {
  const argsStr = args.join(" ");
  if (!argsStr) {
    // 没有问题 → 打开 AI 面板
    ctx.closePalette();
    const { useUIStore } = await import("@/lib/stores");
    useUIStore.getState().setActivePanel("ai");
    return;
  }
  const res = await request<{ reply?: string; error?: string }>(null, "/api/v1/ai/chat", {
    method: "POST", body: { message: argsStr },
  });
  ctx.setGroups([{ label: "AI 回复", items: [{ id: "reply", title: res.ok ? (res.data.reply || res.data.error || "AI 调用失败") : "AI 调用失败", description: "" }] }]);
  ctx.setLoading(false);
};

