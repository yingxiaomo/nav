"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ListTodo, NotebookPen } from "lucide-react";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { TodoWidget } from "@/components/features/todo-widget";
import { NoteWidget } from "@/components/features/note-widget";
import { Todo, Note } from "@/lib/types";

interface FeaturesLauncherProps {
  todos: Todo[];
  notes: Note[];
  onTodosUpdate: (todos: Todo[]) => void;
  onNotesUpdate: (notes: Note[]) => void;
}

export function FeaturesLauncher({ todos, notes, onTodosUpdate, onNotesUpdate }: FeaturesLauncherProps) {
  const [showTodo, setShowTodo] = useState(false);
  const [showNote, setShowNote] = useState(false);

  return (
    <>
      <div className="flex gap-4 mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        <Button 
          variant="outline" 
          onClick={() => setShowTodo(!showTodo)}
          className={`h-12 px-6 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${showTodo ? 'bg-black/40 ring-2 ring-blue-500/50' : 'bg-black/20'}`}
        >
          <ListTodo className="w-5 h-5 text-blue-400" />
          <span>待办</span>
        </Button>

        <Button 
          variant="outline" 
          onClick={() => setShowNote(!showNote)}
          className={`h-12 px-6 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${showNote ? 'bg-black/40 ring-2 ring-amber-500/50' : 'bg-black/20'}`}
        >
          <NotebookPen className="w-5 h-5 text-amber-400" />
          <span>笔记</span>
        </Button>
      </div>

      {showTodo && (
        <ResizablePanel 
          title="待办清单" 
          icon={<ListTodo className="w-5 h-5 text-blue-500" />}
          defaultWidth={400}
          defaultHeight={600}
          onClose={() => setShowTodo(false)}
        >
          <TodoWidget todos={todos} onUpdate={onTodosUpdate} />
        </ResizablePanel>
      )}

      {showNote && (
        <ResizablePanel 
          title="随手笔记" 
          icon={<NotebookPen className="w-5 h-5 text-amber-500" />}
          defaultWidth={600}
          defaultHeight={500}
          onClose={() => setShowNote(false)}
        >
          <NoteWidget notes={notes} onUpdate={onNotesUpdate} />
        </ResizablePanel>
      )}
    </>
  );
}