// 命令定义 + 注册表（策略模式）
// 新命令在这里注册即可，无需改路由逻辑

export interface ExecutionContext {
  setGroups: (groups: { label: string; items: any[] }[]) => void;
  setLoading: (loading: boolean) => void;
  closePalette: () => void;
}

export interface DeviceAlias {
  name: string;
  host?: string;
  type: string;
  user?: string;
  pass?: string;
}

export interface CommandDef {
  prefix: string;
  label: string;
  description: string;
}

export type CommandHandler = (args: string[], ctx: ExecutionContext) => Promise<void>;

const handlers = new Map<string, { def: CommandDef; handler: CommandHandler }>();

export function registerCommand(def: CommandDef, handler: CommandHandler) {
  handlers.set(def.prefix, { def, handler });
}

export function getCommand(prefix: string) {
  return handlers.get(prefix);
}

export function getAllCommands(): CommandDef[] {
  return Array.from(handlers.values()).map(h => h.def);
}

export function getMatching(prefix: string): CommandDef[] {
  return getAllCommands().filter(c => c.prefix.startsWith(prefix));
}
