"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

interface LogViewerProps {
  containerName: string;
  baseUrl: string;
  onClose: () => void;
}

/** 迷你 Docker 日志查看器（SSE 流式输出） */
export function LogViewer({ containerName, baseUrl, onClose }: LogViewerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`${baseUrl}/api/v1/admin/docker/logs/${encodeURIComponent(containerName)}`);
    es.onmessage = (e) => {
      setLines((prev) => {
        const next = [...prev, e.data];
        return next.length > 500 ? next.slice(-500) : next;
      });
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [containerName, baseUrl]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        ref={scrollRef}
        className="relative w-full max-w-2xl max-h-[70vh] bg-black/90 border border-white/10 rounded-xl p-4 overflow-y-auto font-mono text-xs leading-relaxed text-green-400"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="sticky top-0 float-right p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
        {lines.length === 0 ? (
          <div className="text-white/40 text-center py-8">等待日志输出...</div>
        ) : (
          lines.map((line, i) => <div key={i}>{line}</div>)
        )}
      </div>
    </div>
  );
}
