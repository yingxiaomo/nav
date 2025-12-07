"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ENGINES = [
  { name: "Google", url: "https://www.google.com/search?q=" },
  { name: "Baidu", url: "https://www.baidu.com/s?wd=" },
  { name: "Bing", url: "https://www.bing.com/search?q=" },
];

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState(ENGINES[0]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    window.location.href = `${engine.url}${encodeURIComponent(query)}`;
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-2xl mx-auto mb-12 group">
      <div className="relative flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="absolute left-2 h-8 w-auto px-2 text-muted-foreground hover:text-foreground hover:bg-white/20 rounded-md transition-colors"
            >
              {engine.name}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {ENGINES.map((e) => (
              <DropdownMenuItem key={e.name} onClick={() => setEngine(e)}>
                {e.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`在 ${engine.name} 上搜索...`}
          className="h-12 pl-24 pr-12 rounded-full border-none bg-white/20 dark:bg-black/20 backdrop-blur-md text-white placeholder:text-white/60 focus-visible:ring-2 focus-visible:ring-white/50 shadow-lg transition-all hover:bg-white/30"
        />
        
        <Button 
          type="submit" 
          size="icon" 
          variant="ghost" 
          className="absolute right-2 text-white/80 hover:text-white hover:bg-white/20 rounded-full"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
}
