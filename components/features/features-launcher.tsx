"use client";

import { Button } from "@/components/ui/button";
import { ListTodo, NotebookPen, Brain, TerminalSquare } from "lucide-react";
import { ResizablePanel } from "@/components/ui/resizable-panel";
import { TodoWidget } from "@/components/features/todo-widget";
import { NoteWidget } from "@/components/features/note-widget";
import { Todo, Note } from "@/lib/types";
import { useUIStore } from "@/lib/stores";
import { useAuthStatus } from "@/lib/hooks/use-auth-status";

interface FeaturesLauncherProps {
  todos: Todo[];
  notes: Note[];
  onTodosUpdate: (todos: Todo[]) => void;
  onNotesUpdate: (notes: Note[]) => void;
}

export function FeaturesLauncher({ todos, notes, onTodosUpdate, onNotesUpdate }: FeaturesLauncherProps) {
  const { activePanel, togglePanel, setActivePanel, backendAvailable } = useUIStore();
  const sidebarCollapsed = useUIStore(s => s.sidebarCollapsed);
  const auth = useAuthStatus();

  // 笔记/待办属敏感个人数据：后端模式仅登录后展示入口；
  // 静态部署模式（无后端）数据来自本地/云同步，不门控
  const showPersonalWidgets = !backendAvailable || auth.loggedIn;

  return (
    <>
      {/* Floating launcher buttons — top-left corner, hidden on mobile */}
      <div className="fixed top-6 z-50 max-md:hidden flex gap-3 transition-[left] duration-300"
        style={{ left: sidebarCollapsed ? '1.5rem' : 'calc(360px + 1.5rem)' }}
      >
        {showPersonalWidgets && (
        <Button
          variant="outline"
          onClick={() => togglePanel('todo')}
          className={`h-11 px-5 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${activePanel === 'todo' ? 'bg-black/40 ring-2 ring-blue-500/50' : 'bg-black/20'}`}
        >
          <ListTodo className="w-5 h-5 shrink-0 text-blue-400" />
          <span className="text-sm">待办</span>
        </Button>
        )}

        {showPersonalWidgets && (
        <Button
          variant="outline"
          onClick={() => togglePanel('note')}
          className={`h-11 px-5 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${activePanel === 'note' ? 'bg-black/40 ring-2 ring-amber-500/50' : 'bg-black/20'}`}
        >
          <NotebookPen className="w-5 h-5 shrink-0 text-amber-400" />
          <span className="text-sm">笔记</span>
        </Button>
        )}

        {backendAvailable && auth.loggedIn && (
        <Button
          variant="outline"
          onClick={() => togglePanel('ai')}
          className={`h-11 px-5 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${activePanel === 'ai' ? 'bg-black/40 ring-2 ring-purple-500/50' : 'bg-black/20'}`}
        >
          <Brain className="w-5 h-5 shrink-0 text-purple-400" />
          <span className="text-sm">AI</span>
        </Button>
        )}

        {backendAvailable && auth.loggedIn && (
        <Button
          variant="outline"
          onClick={() => togglePanel('ssh')}
          className={`h-11 px-5 rounded-full border-white/20 hover:bg-black/40 backdrop-blur-md text-white transition-all hover:scale-105 gap-2 ${activePanel === 'ssh' ? 'bg-black/40 ring-2 ring-green-500/50' : 'bg-black/20'}`}
        >
          <TerminalSquare className="w-5 h-5 shrink-0 text-green-400" />
          <span className="text-sm">终端</span>
        </Button>
        )}
      </div>

      {/* Panels — remain centered。已打开的敏感面板同样受登录态门控：
          共享浏览器场景下登出后，残留面板必须立即消失 */}
      <div className="flex justify-center w-full">
        {showPersonalWidgets && activePanel === 'todo' && (
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

        {showPersonalWidgets && activePanel === 'note' && (
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
