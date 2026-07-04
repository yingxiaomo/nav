"use client";

import { Button } from "@/components/ui/button";
import { ListTodo, NotebookPen, Activity } from "lucide-react";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { TodoWidget } from "@/components/features/todo-widget";
import { NoteWidget } from "@/components/features/note-widget";
import { MonitorWidget } from "@/components/features/monitor-widget";
import { Todo, Note } from "@/lib/types";
import { useUIStore } from "@/lib/stores";

interface FeaturesLauncherProps {
  todos: Todo[];
  notes: Note[];
  onTodosUpdate: (todos: Todo[]) => void;
  onNotesUpdate: (notes: Note[]) => void;
}

export function FeaturesLauncher({ todos, notes, onTodosUpdate, onNotesUpdate }: FeaturesLauncherProps) {
  const { activePanel, togglePanel, setActivePanel } = useUIStore();

  return (
    <>
      <div className="flex gap-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <Button
          variant="outline"
          onClick={() => togglePanel('todo')}
          className={`h-12 px-6 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${activePanel === 'todo' ? 'bg-black/40 ring-2 ring-blue-500/50' : 'bg-black/20'}`}
        >
          <ListTodo className="w-5 h-5 text-blue-400" />
          <span>待办</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => togglePanel('note')}
          className={`h-12 px-6 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${activePanel === 'note' ? 'bg-black/40 ring-2 ring-amber-500/50' : 'bg-black/20'}`}
        >
          <NotebookPen className="w-5 h-5 text-amber-400" />
          <span>笔记</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => togglePanel('monitor')}
          className={`h-12 px-6 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${activePanel === 'monitor' ? 'bg-black/40 ring-2 ring-green-500/50' : 'bg-black/20'}`}
        >
          <Activity className="w-5 h-5 text-green-400" />
          <span>监控</span>
        </Button>
      </div>

      {activePanel === 'todo' && (
        <ResizablePanel
          title="待办清单"
          icon={<ListTodo className="w-5 h-5 text-blue-500" />}
          defaultWidth={400}
          defaultHeight={600}
          onClose={() => togglePanel('todo')}
          zIndex={activePanel === 'todo' ? 101 : 100}
          onFocus={() => setActivePanel('todo')}
        >
          <TodoWidget todos={todos} onUpdate={onTodosUpdate} />
        </ResizablePanel>
      )}

      {activePanel === 'note' && (
        <ResizablePanel
          title="随手笔记"
          icon={<NotebookPen className="w-5 h-5 text-amber-500" />}
          defaultWidth={600}
          defaultHeight={500}
          onClose={() => togglePanel('note')}
          zIndex={activePanel === 'note' ? 101 : 100}
          onFocus={() => setActivePanel('note')}
        >
          <NoteWidget notes={notes} onUpdate={onNotesUpdate} />
        </ResizablePanel>
      )}

      {activePanel === 'monitor' && (
        <ResizablePanel
          title="系统监控"
          icon={<Activity className="w-5 h-5 text-green-500" />}
          defaultWidth={480}
          defaultHeight={500}
          onClose={() => togglePanel('monitor')}
          zIndex={activePanel === 'monitor' ? 101 : 100}
          onFocus={() => setActivePanel('monitor')}
        >
          <MonitorWidget />
        </ResizablePanel>
      )}
    </>
  );
}