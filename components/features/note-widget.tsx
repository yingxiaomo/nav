"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Note } from "@/lib/types"

interface NoteWidgetProps {
  notes: Note[]
  onUpdate: (notes: Note[]) => void
}

export function NoteWidget({ notes = [], onUpdate }: NoteWidgetProps) {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)

  const activeNote = notes.find(n => n.id === activeNoteId) || null

  const addNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: "", 
      content: "",
      updatedAt: Date.now(),
    }
    onUpdate([newNote, ...notes])
    setActiveNoteId(newNote.id)
  }

  const updateNote = (id: string, field: keyof Note, value: string) => {
    onUpdate(notes.map(n => n.id === id ? { ...n, [field]: value, updatedAt: Date.now() } : n))
  }

  const deleteNote = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    onUpdate(notes.filter(n => n.id !== id))
    if (activeNoteId === id) setActiveNoteId(null)
  }

  return (
    <div className="flex h-full gap-2 p-4">
      <div className="w-[140px] flex flex-col gap-2 border-r border-border/50 pr-2 shrink-0">
        <Button onClick={addNote} className="w-full shadow-sm" size="sm">
          <Plus className="w-4 h-4 mr-2" /> 新建笔记
        </Button>
        
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {notes.map(note => (
              <div 
                key={note.id}
                onClick={() => setActiveNoteId(note.id)}
                className={`p-2 text-sm rounded-md cursor-pointer flex justify-between items-center group transition-all ${
                  activeNoteId === note.id 
                    ? 'bg-accent text-accent-foreground font-medium shadow-sm' 
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="truncate flex-1">{note.title || "无标题"}</span>
                <Trash2 
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity ml-2 shrink-0" 
                  onClick={(e) => deleteNote(e, note.id)}
                />
              </div>
            ))}
            {notes.length === 0 && (
               <div className="text-center text-xs text-muted-foreground py-4">暂无笔记</div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col gap-2 h-full min-w-0">
        {activeNote ? (
          <>
            <Input 
              value={activeNote.title} 
              onChange={(e) => updateNote(activeNote.id, 'title', e.target.value)}
              className="font-bold border-none shadow-none px-0 focus-visible:ring-0 text-lg bg-transparent placeholder:text-muted-foreground/50 text-foreground" 
              placeholder="在此输入笔记标题" 
            />
            <Textarea 
              value={activeNote.content}
              onChange={(e) => updateNote(activeNote.id, 'content', e.target.value)}
              className="flex-1 resize-none border-none shadow-none px-0 focus-visible:ring-0 bg-transparent text-foreground leading-relaxed custom-scrollbar"
              placeholder="在此输入内容..."
            />
            <div className="text-[10px] text-muted-foreground text-right">
              {new Date(activeNote.updatedAt).toLocaleString()}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm bg-muted/20 rounded-lg border-2 border-dashed border-border/50">
            选择或创建一个笔记
          </div>
        )}
      </div>
    </div>
  )
}