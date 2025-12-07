"use client";

import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
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

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    window.location.href = `${engine.url}${encodeURIComponent(query)}`;
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto mb-12 z-40">
      <form 
        onSubmit={handleSearch}
        className="relative flex items-center group"
      >
        {/* Engine Switcher */}
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
            <DropdownMenuContent align="start" className="bg-white/90 backdrop-blur-xl">
              {ENGINES.map((e) => (
                <DropdownMenuItem key={e.name} onClick={() => setEngine(e)}>
                  {e.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Search Input */}
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search with ${engine.name}...`}
          className="h-14 pl-28 pr-14 rounded-2xl border-white/20 bg-white/10 dark:bg-black/20 backdrop-blur-xl text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-white/30 shadow-xl transition-all hover:bg-white/15 text-lg"
        />
        
        {/* Submit Button */}
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
}
