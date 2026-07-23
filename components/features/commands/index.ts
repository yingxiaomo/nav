// 命令注册中心 — 所有命令在这里注册
import { registerCommand } from "./registry";
import { handler as docker } from "./docker";
import { handler as ssh } from "./ssh";
import { handler as monitor } from "./monitor";
import { handler as stats } from "./stats";
import { handler as ai } from "./ai";
import { handler as wol } from "./wol";

registerCommand(
  { prefix: "docker", label: "/docker", description: "管理 Docker 容器（含资源占用）" },
  docker,
);
registerCommand(
  { prefix: "ssh", label: "/ssh <别名>", description: "远程连接设备" },
  ssh,
);
registerCommand(
  { prefix: "monitor", label: "/monitor", description: "查看内网监控状态" },
  monitor,
);
registerCommand(
  { prefix: "stats", label: "/stats", description: "查看系统资源仪表" },
  stats,
);
registerCommand(
  { prefix: "ai", label: "/ai <问题>", description: "AI 快速问答" },
  ai,
);
registerCommand(
  { prefix: "wol", label: "/wol <别名>", description: "Wake-on-LAN 唤醒设备" },
  wol,
);
