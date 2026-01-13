"use client";

import React, { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Input, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui";


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

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(({ onLocalSearch }, ref) => {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState(ENGINES[0]);

  const handleEngineChange = (newEngine: typeof ENGINES[0]) => {
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
    
    window.open(`${engine.url}${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto mb-12 z-40">
      <form 
        onSubmit={handleSearch}
        className="relative flex items-center group"
      >
        <div className="absolute left-2 z-50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 px-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors gap-1"
              >
                {engine.name}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            
            <DropdownMenuContent 
              align="start" 
              className="w-40 bg-black/60 backdrop-blur-xl border-white/20 text-white p-0 overflow-hidden" 
            >

              <div className="h-64 overflow-y-auto p-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/40">
                {ENGINES.map((e) => (
                  <DropdownMenuItem 
                    key={e.name} 
                    onClick={() => handleEngineChange(e)}
                    className="focus:bg-white/20 focus:text-white cursor-pointer"
                  >
                    {e.name}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Input
          ref={ref}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={engine.url === 'local' ? "筛选我的链接..." : `在 ${engine.name} 中搜索...`}
          className="h-14 pl-32 pr-14 rounded-2xl border-white/20 bg-white/10 dark:bg-black/20 backdrop-blur-xl text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/30 shadow-xl transition-all hover:bg-white/15 text-lg"
        />
        
        <Button 
          type="submit" 
          size="icon" 
          variant="ghost" 
          onClick={() => handleSearch()}
          className="absolute right-2 top-2 h-10 w-10 text-white/80 hover:text-white hover:bg-white/10 rounded-xl"
        >
          <Search className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
});

SearchBar.displayName = "SearchBar";