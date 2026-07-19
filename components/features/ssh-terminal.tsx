"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useUIStore } from "@/lib/stores";
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

export function SSHTerminalPanel() {
  const { activePanel, setActivePanel, sshConnectRequest, clearSSHConnectRequest } = useUIStore();
  const [instances, setInstances] = useState<SSHInstance[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const terminalsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const handledTokenRef = useRef<number>(0);

  const initTerminal = useCallback((id: string, cfg: { name: string; host: string; user: string; pass: string; port: number }) => {
    const termDiv = terminalsRef.current.get(id);
    if (!termDiv) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: { background: "#1a1a2e", foreground: "#e0e0e0", cursor: "#60a5fa" },
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
    <div className="flex flex-col h-full bg-[#1a1a2e]">
      <div className="flex items-center bg-[#16162a] px-2 py-1 gap-0.5 shrink-0">
        {instances.map((inst) => (
          <button
            key={inst.id}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t transition-colors ${
              activeTab === inst.id
                ? "bg-[#1a1a2e] text-white"
                : "text-gray-400 hover:text-white hover:bg-[#1a1a2e]/50"
            }`}
            onClick={() => setActiveTab(inst.id)}
          >
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            {inst.name}
            <X
              className="h-3 w-3 ml-1 hover:text-red-400 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                closeInstance(inst.id);
              }}
            />
          </button>
        ))}
        {instances.length === 0 && (
          <span className="text-xs text-gray-500 px-3 py-1.5">暂无连接</span>
        )}
        <div className="flex-1" />
        <Minus
          className="h-3 w-3 text-gray-500 cursor-pointer hover:text-white"
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 gap-4">
            <p className="text-sm">暂无 SSH 连接</p>
            <p className="text-xs text-gray-600">
              在 ⌘K 中输入 /ssh &lt;别名&gt;，或从监控面板右键连接
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
