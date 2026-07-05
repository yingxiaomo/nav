"use client";

import { Button } from "@/components/ui/button";
import { ListTodo, NotebookPen } from "lucide-react";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { TodoWidget } from "@/components/features/todo-widget";
import { NoteWidget } from "@/components/features/note-widget";
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
      {/* Floating launcher buttons — top-left corner */}
      <div className="fixed top-6 left-6 z-50 flex gap-3">
        <Button
          variant="outline"
          onClick={() => togglePanel('todo')}
          className={`h-11 px-5 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${activePanel === 'todo' ? 'bg-black/40 ring-2 ring-blue-500/50' : 'bg-black/20'}`}
        >
          <ListTodo className="w-5 h-5 shrink-0 text-blue-400" />
          <span className="text-sm">待办</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => togglePanel('note')}
          className={`h-11 px-5 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${activePanel === 'note' ? 'bg-black/40 ring-2 ring-amber-500/50' : 'bg-black/20'}`}
        >
          <NotebookPen className="w-5 h-5 shrink-0 text-amber-400" />
          <span className="text-sm">笔记</span>
        </Button>
      </div>

      {/* Panels — remain centered */}
      <div className="flex justify-center w-full">
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
      </div>
    </>
  );
}
