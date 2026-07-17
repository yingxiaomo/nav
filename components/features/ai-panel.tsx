"use client";

import { useState, useRef, useEffect } from "react";
import { useUIStore } from "@/lib/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Brain, Trash2, Minus } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function AIPanel() {
  const { activePanel, setActivePanel } = useUIStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activePanel === "ai") inputRef.current?.focus();
  }, [activePanel]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setBusy(true);

    try {
      const res = await fetch("/api/v1/ai/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const { reply } = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("AI 回复失败", { description: msg });
      setMessages(prev => [...prev, { role: "assistant", content: "❌ " + msg }]);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => setMessages([]);

  if (activePanel !== "ai") return null;

  return (
    <div className="fixed bottom-0 right-4 z-40 w-[500px] h-[450px] bg-background border rounded-t-xl shadow-2xl flex flex-col animate-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <Brain className="h-4 w-4 text-purple-500" />
        <span className="text-sm font-medium flex-1">AI 助手</span>
        <button onClick={clear} className="text-muted-foreground/50 hover:text-muted-foreground p-1" title="清空对话">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <Minus className="h-3.5 w-3.5 text-muted-foreground/50 cursor-pointer hover:text-muted-foreground" onClick={() => setActivePanel(null)} />
      </div>
      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground/40 mt-12 space-y-2">
            <Brain className="h-8 w-8 mx-auto opacity-30" />
            <p>有什么我可以帮助你的吗？</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-foreground border"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-muted/50 border rounded-xl px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              思考中...
            </div>
          </div>
        )}
      </div>
      {/* Input */}
      <div className="p-3 border-t shrink-0">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="输入消息，回车发送..."
            className="flex-1 h-10"
            disabled={busy}
          />
          <Button onClick={send} disabled={busy || !input.trim()} className="h-10 px-4 shrink-0">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "发送"}
          </Button>
        </div>
      </div>
    </div>
  );
}
