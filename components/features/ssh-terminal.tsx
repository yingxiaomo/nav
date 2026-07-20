"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useUIStore } from "@/lib/stores";
import { useThemeStore } from "@/lib/stores/theme-store";
import { X, Minus } from "lucide-react";

interface SSHInstance {
  id: string;
  name: string;
  host: string;
  user: string;
  pass: string;
  port: number;
  term: Terminal | null;
  ws: WebSocket | null;
  fitAddon: FitAddon | null;
}

const LIGHT_TERM_THEME = {
  background: "#f8fafc",
  foreground: "#0f172a",
  cursor: "#2563eb",
  cursorAccent: "#f8fafc",
  selectionBackground: "rgba(37, 99, 235, 0.25)",
  black: "#0f172a",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
  magenta: "#9333ea",
  cyan: "#0891b2",
  white: "#334155",
  brightBlack: "#64748b",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#0f172a",
};

const DARK_TERM_THEME = {
  background: "#0f172a",
  foreground: "#e2e8f0",
  cursor: "#60a5fa",
  cursorAccent: "#0f172a",
  selectionBackground: "rgba(96, 165, 250, 0.30)",
  black: "#0f172a",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e2e8f0",
  brightBlack: "#94a3b8",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde047",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#f8fafc",
};

function resolveIsDark(theme: "light" | "dark" | "system"): boolean {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function SSHTerminalPanel() {
  const { activePanel, setActivePanel, sshConnectRequest, clearSSHConnectRequest } = useUIStore();
  const theme = useThemeStore((s) => s.theme);
  const isDark = resolveIsDark(theme);
  const [instances, setInstances] = useState<SSHInstance[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const terminalsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const handledTokenRef = useRef<number>(0);
  const instancesRef = useRef(instances);

  // 同步 instances 到 ref（用于主题切换回调访问最新列表）
  useEffect(() => {
    instancesRef.current = instances;
  }, [instances]);

  // 主题切换时同步已打开终端配色
  useEffect(() => {
    const termTheme = isDark ? DARK_TERM_THEME : LIGHT_TERM_THEME;
    for (const inst of instancesRef.current) {
      if (inst.term) {
        inst.term.options.theme = termTheme;
      }
    }
  }, [isDark]);

  const initTerminal = useCallback((id: string, cfg: { name: string; host: string; user: string; pass: string; port: number }) => {
    const termDiv = terminalsRef.current.get(id);
    if (!termDiv) return;

    const darkNow = resolveIsDark(useThemeStore.getState().theme);
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: darkNow ? DARK_TERM_THEME : LIGHT_TERM_THEME,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termDiv);
    setTimeout(() => fitAddon.fit(), 50);

    const params = new URLSearchParams({
      host: cfg.host,
      user: cfg.user,
      pass: cfg.pass,
      port: String(cfg.port || 22),
    });
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/ws/ssh?${params}`);

    term.writeln(`\x1b[90m正在连接 ${cfg.user}@${cfg.host}:${cfg.port || 22} ...\x1b[0m`);

    ws.onopen = () => term.writeln("\x1b[32mWebSocket 已建立，等待 SSH 握手...\x1b[0m");
    ws.onmessage = (e) => {
      if (e.data instanceof Blob) {
        e.data.arrayBuffer().then((buf) => term.write(new Uint8Array(buf)));
      } else {
        term.write(e.data);
      }
    };
    ws.onclose = () => term.writeln("\r\n\x1b[31m连接已关闭\x1b[0m");
    ws.onerror = () => term.writeln("\r\n\x1b[31m连接错误\x1b[0m");

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    const onResize = () => fitAddon.fit();
    window.addEventListener("resize", onResize);

    setInstances((prev) =>
      prev.map((i) => (i.id === id ? { ...i, term, ws, fitAddon } : i))
    );

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const connect = useCallback((name: string, host: string, user: string, pass: string, port = 22) => {
    if (!host || !user) {
      return;
    }
    const id = `ssh-${Date.now()}`;
    const inst: SSHInstance = { id, name, host, user, pass, port, term: null, ws: null, fitAddon: null };
    setInstances((prev) => [...prev, inst]);
    setActiveTab(id);
    // 等 DOM 挂载 ref 后再初始化 xterm
    setTimeout(() => initTerminal(id, { name, host, user, pass, port }), 80);
  }, [initTerminal]);

  // 消费外部发起的连接请求
  useEffect(() => {
    if (!sshConnectRequest) return;
    if (sshConnectRequest.token === handledTokenRef.current) return;
    handledTokenRef.current = sshConnectRequest.token;
    connect(
      sshConnectRequest.name,
      sshConnectRequest.host,
      sshConnectRequest.user,
      sshConnectRequest.pass,
      sshConnectRequest.port || 22
    );
    clearSSHConnectRequest();
  }, [sshConnectRequest, connect, clearSSHConnectRequest]);

  const closeInstance = (id: string) => {
    setInstances((prev) => {
      const inst = prev.find((i) => i.id === id);
      inst?.ws?.close();
      inst?.term?.dispose();
      const rest = prev.filter((i) => i.id !== id);
      if (activeTab === id) {
        setActiveTab(rest.length > 0 ? rest[rest.length - 1].id : null);
      }
      return rest;
    });
  };

  if (activePanel !== "ssh") return null;

  return (
    <div className={`flex flex-col h-full ${isDark ? "bg-slate-950" : "bg-slate-50"}`}>
      <div className={`flex items-center px-2 py-1 gap-0.5 shrink-0 border-b ${
        isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      }`}>
        {instances.map((inst) => (
          <button
            key={inst.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t transition-colors ${
              activeTab === inst.id
                ? isDark
                  ? "bg-slate-950 text-slate-100"
                  : "bg-slate-50 text-slate-900"
                : isDark
                  ? "text-slate-400 hover:text-slate-100 hover:bg-slate-950/50"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
            onClick={() => setActiveTab(inst.id)}
          >
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            {inst.name}
            <X
              className={`h-3 w-3 ml-1 shrink-0 ${isDark ? "hover:text-red-400" : "hover:text-red-500"}`}
              onClick={(e) => {
                e.stopPropagation();
                closeInstance(inst.id);
              }}
            />
          </button>
        ))}
        {instances.length === 0 && (
          <span className={`text-xs px-3 py-1.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>暂无连接</span>
        )}
        <div className="flex-1" />
        <Minus
          className={`h-3 w-3 cursor-pointer ${
            isDark ? "text-slate-500 hover:text-white" : "text-slate-400 hover:text-slate-900"
          }`}
          onClick={() => setActivePanel(null)}
        />
      </div>
      <div className="flex-1 relative">
        {instances.map((inst) => (
          <div
            key={inst.id}
            ref={(el) => {
              if (el) terminalsRef.current.set(inst.id, el);
            }}
            className={`absolute inset-0 p-1 ${activeTab === inst.id ? "block" : "hidden"}`}
          />
        ))}
        {instances.length === 0 && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-4 ${
            isDark ? "text-slate-500" : "text-slate-400"
          }`}>
            <p className="text-sm">暂无 SSH 连接</p>
            <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
              在 ⌘K 中输入 /ssh &lt;别名&gt;，或从监控面板右键连接
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
