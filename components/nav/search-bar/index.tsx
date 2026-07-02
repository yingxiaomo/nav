"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";
import { motion } from "framer-motion";
import { Input, Button } from "@/components/ui";


const ENGINES = [
  { name: "Google", url: "https://www.google.com/search?q=" },
  { name: "Baidu", url: "https://www.baidu.com/s?wd=" },
  { name: "Bing", url: "https://www.bing.com/search?q=" },
  { name: "Bilibili", url: "https://search.bilibili.com/all?keyword=" },
  { name: "GitHub", url: "https://github.com/search?q=" },
  { name: "DuckDuckGo", url: "https://duckduckgo.com/?q=" },
  { name: "Sogou", url: "https://www.sogou.com/web?query=" },
  { name: "360", url: "https://www.so.com/s?q=" },
  { name: "Yahoo", url: "https://search.yahoo.com/search?p=" },
  { name: "本地", url: "local" },
];

interface SearchBarProps {
  onLocalSearch?: (query: string) => void;
  ref?: React.RefObject<HTMLInputElement>;
}

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ onLocalSearch }, ref) => {
    const [query, setQuery] = useState("");
    const [engine, setEngine] = useState(ENGINES[0]);

    const handleEngineChange = (newEngine: (typeof ENGINES)[0]) => {
      setEngine(newEngine);
      if (newEngine.url === "local") {
        onLocalSearch?.(query);
      } else {
        onLocalSearch?.("");
      }
    };

    const handleInputChange = (val: string) => {
      setQuery(val);
      if (engine.url === "local") {
        onLocalSearch?.(val);
      }
    };

    const handleSearch = (e?: React.FormEvent) => {
      e?.preventDefault();
      if (engine.url === "local") return;
      if (!query.trim()) return;

      window.open(`${engine.url}${encodeURIComponent(query)}`, "_blank");
    };

    return (
      <motion.div
        className="relative w-full max-w-2xl mx-auto mb-12 z-40"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* 搜索引擎标签切换 */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-3">
          {ENGINES.map((e) => (
            <button
              key={e.name}
              onClick={() => handleEngineChange(e)}
              aria-label={`切换搜索引擎为 ${e.name}`}
              aria-pressed={engine.name === e.name}
              className={[
                "px-3 py-1 rounded-full text-xs font-medium transition-all duration-200",
                "cursor-pointer hover:scale-105 active:scale-95",
                engine.name === e.name
                  ? "bg-white/25 text-white shadow-md"
                  : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80",
              ].join(" ")}
            >
              {e.name}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSearch}
          className="relative flex items-center group"
        >
          <motion.div
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <Input
              ref={ref}
              type="text"
              value={query}
              onChange={(e) =>
                handleInputChange(e.target.value)
              }
              placeholder={
                engine.url === "local"
                  ? "筛选我的链接..."
                  : `在 ${engine.name} 中搜索...`
              }
              aria-label={
                engine.url === "local"
                  ? "本地链接搜索"
                  : "搜索引擎搜索"
              }
              className="h-14 pl-6 pr-14 rounded-2xl border-white/20 bg-white/10 dark:bg-black/20 backdrop-blur-xl text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/30 shadow-xl transition-all hover:bg-white/15 text-lg"
            />
          </motion.div>

          <Button
            type="submit"
            size="icon"
            variant="ghost"
            onClick={() => handleSearch()}
            className="absolute right-2 top-2 h-10 w-10 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-110 hover:rotate-15 active:scale-95 active:rotate-0"
          >
            <Search className="h-5 w-5" />
          </Button>
        </form>
      </motion.div>
    );
  }
);

SearchBar.displayName = "SearchBar";