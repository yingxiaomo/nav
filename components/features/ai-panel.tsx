"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useUIStore } from "@/lib/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Brain, Trash2, Plus, MessageSquare, Minus, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

const STORAGE_KEY = "clean-nav-ai-conversations";
const MAX_CONVERSATIONS = 20;

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConversations(list: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_CONVERSATIONS)));
}

function genId(): string {
  try { if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function AIPanel() {
  const { activePanel, setActivePanel } = useUIStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadedRef = useRef(false);

  const newConversation = () => {
    const id = genId();
    const conv: Conversation = { id, title: "新对话", messages: [], createdAt: Date.now() };
    setConversations(prev => [conv, ...prev]);
    setActiveId(id);
  };

  // 加载保存的对话（仅首次打开时）
  useEffect(() => {
    if (activePanel !== "ai" || loadedRef.current) return;
    loadedRef.current = true;
    const saved = loadConversations();
    if (saved.length > 0) {
      setConversations(saved);
      setActiveId(saved[0].id);
    } else {
      newConversation();
    }
  }, [activePanel]); // eslint-disable-line react-hooks/exhaustive-deps

  // 自动保存
  useEffect(() => {
    if (conversations.length > 0) saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [conversations]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activePanel === "ai") setTimeout(() => inputRef.current?.focus(), 100);
  }, [activePanel, activeId]);

  const activeConv = useMemo(() => conversations.find(c => c.id === activeId), [conversations, activeId]);

  const deleteConversation = (id: string) => {
    setConversations(prev => {
      const rest = prev.filter(c => c.id !== id);
      if (activeId === id) {
        setActiveId(rest.length > 0 ? rest[0].id : null);
        if (rest.length === 0) {
          const fresh: Conversation = { id: genId(), title: "新对话", messages: [], createdAt: Date.now() };
          setActiveId(fresh.id);
          return [fresh];
        }
      }
      return rest;
    });
  };

  const updateTitle = (id: string, firstMsg: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: firstMsg.slice(0, 30) + (firstMsg.length > 30 ? "…" : "") } : c));
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !activeId) return;
    setInput("");

    setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...c.messages, { role: "user" as const, content: text }], title: c.messages.length === 0 ? text.slice(0, 30) + (text.length > 30 ? "…" : "") : c.title } : c));
    setBusy(true);

    try {
      const res = await fetch("/api/v1/ai/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversation_id: activeId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `请求失败 (${res.status})`);
      }
      const { reply } = await res.json();
      setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...c.messages, { role: "assistant", content: reply }] } : c));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("AI 回复失败", { description: msg });
      setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...c.messages, { role: "assistant", content: "❌ " + msg }] } : c));
    } finally {
      setBusy(false);
    }
  };

  if (activePanel !== "ai") return null;

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar + Main */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className={`shrink-0 border-r bg-muted/10 flex flex-col transition-all duration-200 ${sidebarOpen ? "w-[180px]" : "w-0 overflow-hidden"}`}>
          <div className="p-2 border-b shrink-0">
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs" onClick={newConversation}>
              <Plus className="h-3.5 w-3.5" /> 新对话
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {conversations.map(conv => (
              <div key={conv.id} className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${conv.id === activeId ? "bg-muted/60 font-medium" : "hover:bg-muted/30"}`} onClick={() => setActiveId(conv.id)}>
                <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <span className="flex-1 truncate">{conv.title}</span>
                <Trash2 className="h-3 w-3 shrink-0 text-muted-foreground/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); deleteConversation(conv.id); }} />
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b shrink-0">
            <button className="text-muted-foreground/50 hover:text-muted-foreground p-0.5 -ml-1" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <ChevronDown className={`h-4 w-4 transition-transform ${sidebarOpen ? "-rotate-90" : "rotate-0"}`} />
            </button>
            <Brain className="h-4 w-4 text-purple-500 shrink-0" />
            <span className="text-sm font-medium flex-1 truncate">{activeConv?.title || "AI 助手"}</span>
            <Minus className="h-3.5 w-3.5 text-muted-foreground/50 cursor-pointer hover:text-muted-foreground shrink-0" onClick={() => setActivePanel(null)} />
          </div>
          {/* Messages */}
          <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
            {activeConv?.messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground/40 mt-12 space-y-2">
                <Brain className="h-8 w-8 mx-auto opacity-30" />
                <p>有什么我可以帮助你的吗？</p>
              </div>
            )}
            {activeConv?.messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-foreground border"}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="bg-muted/50 border rounded-xl px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />思考中...
                </div>
              </div>
            )}
          </div>
          {/* Input */}
          <div className="p-3 border-t shrink-0">
            <div className="flex gap-2">
              <Input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} placeholder="输入消息，回车发送..." className="flex-1 h-10" disabled={busy} />
              <Button onClick={send} disabled={busy || !input.trim()} className="h-10 px-4 shrink-0">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "发送"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
