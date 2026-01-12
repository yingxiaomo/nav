"use client"

import { useState, KeyboardEvent } from "react"
import { Trash2, CheckCircle2, Circle } from "lucide-react" 
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Todo } from "@/lib/types"
import { cn } from "@/lib/utils"

interface TodoWidgetProps {
  todos: Todo[]
  onUpdate: (todos: Todo[]) => void
}

export function TodoWidget({ todos = [], onUpdate }: TodoWidgetProps) {
  const [newTodo, setNewTodo] = useState("")

  const addTodo = () => {
    if (!newTodo.trim()) return
    const newItem: Todo = {
      id: Date.now().toString(),
      text: newTodo.trim(),
      completed: false,
      createdAt: Date.now(),
    }
    onUpdate([newItem, ...todos])
    setNewTodo("")
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTodo()
    }
  }

  const toggleTodo = (id: string) => {
    onUpdate(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const deleteTodo = (id: string) => {
    onUpdate(todos.filter(t => t.id !== id))
  }

  const sortedTodos = [...todos].sort((a, b) => {
    if (a.completed === b.completed) {
        return b.createdAt - a.createdAt
    }
    return a.completed ? 1 : -1
  })

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <Input
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="添加新待办..."
          className="flex-1 bg-muted/40 border-white/10 focus-visible:ring-primary/20"
        />
        <Button onClick={addTodo} className="shrink-0">
          添加
        </Button>
      </div>

      <ScrollArea className="flex-1 -mr-3 pr-3">
        <div className="space-y-2">
          {sortedTodos.map(todo => (
            <div 
              key={todo.id}
              className={cn(
                "group flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-muted/20 transition-all hover:bg-muted/40",
                todo.completed && "opacity-60 bg-muted/10"
              )}
            >
              <button 
                onClick={() => toggleTodo(todo.id)}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
              >
                {todo.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                ) : (
                  <Circle className="w-5 h-5" />
                )}
              </button>
              
              <span className={cn(
                "flex-1 text-sm truncate transition-all",
                todo.completed && "line-through text-muted-foreground"
              )}>
                {todo.text}
              </span>

              <button
                onClick={() => deleteTodo(todo.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all focus:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          {todos.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              还没有待办事项，添加一个吧！
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}