"use client";

import { Category, LinkItem } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";

interface LinkGridProps {
  categories: Category[];
}

const IconRender = ({ name, className }: { name: string; className?: string }) => {
  // @ts-ignore
  const Icon = (Icons[name as keyof typeof Icons] as LucideIcon) || Icons.Link;
  return <Icon className={className} />;
};

export function LinkGrid({ categories }: LinkGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl mx-auto pb-20">
      {categories.map((category) => (
        <div key={category.id} className="space-y-3">
          <h2 className="text-white/90 text-lg font-medium pl-2 drop-shadow-sm flex items-center gap-2">
            <span className="w-1 h-4 bg-primary/80 rounded-full inline-block" />
            {category.title}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {category.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <Card className="h-full border-none bg-white/10 dark:bg-black/20 hover:bg-white/25 dark:hover:bg-black/30 backdrop-blur-md transition-all duration-200 hover:-translate-y-1 hover:shadow-lg overflow-hidden">
                  <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3 h-24">
                    {link.icon && (
                      <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors text-white">
                        <IconRender name={link.icon} className="h-6 w-6" />
                      </div>
                    )}
                    <span className="text-sm font-medium text-white/90 group-hover:text-white line-clamp-1">
                      {link.title}
                    </span>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
