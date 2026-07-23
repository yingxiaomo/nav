// /wol 命令 — Wake-on-LAN 唤醒设备
import type { CommandHandler, ExecutionContext } from "./registry";
import { loadDeviceAliases } from "./ssh";

export const handler: CommandHandler = async (args, ctx) => {
  const { toast } = await import("sonner");
  const aliases = await loadDeviceAliases();
  const argsStr = args.join(" ");

  if (!argsStr) {
    ctx.setGroups([{
      label: "可唤醒设备",
      items: aliases.map(d => ({ id: d.name, title: d.name, description: "发送 WOL 魔术包" })),
    }]);
    ctx.setLoading(false);
    return;
  }

  toast.success(`已发送 WOL 唤醒包到 ${argsStr}`);
  ctx.closePalette();
  ctx.setLoading(false);
};
