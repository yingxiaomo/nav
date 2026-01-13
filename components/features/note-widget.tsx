"use client"

import { useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Note } from "@/lib/types"
import { motion, AnimatePresence } from "framer-motion"

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
    <div className="flex flex-col md:flex-row h-full gap-2 p-4">
      <div className="w-full md:w-[140px] h-[140px] md:h-full flex flex-col gap-2 border-b md:border-b-0 md:border-r border-border/50 pb-2 md:pb-0 md:pr-2 shrink-0">
        <motion.button 
          onClick={addNote} 
          className="w-full shadow-sm p-2 rounded-md bg-accent text-accent-foreground font-medium text-sm flex items-center justify-center gap-2"
          whileHover={{ scale: 1.05, boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)" }}
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <div className="relative">
            <Plus className="w-4 h-4" />
          </div>
          新建笔记
        </motion.button>
        
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            <AnimatePresence>
              {notes.map(note => (
                <motion.div 
                  key={note.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setActiveNoteId(note.id)}
                  className={`p-2 text-sm rounded-md cursor-pointer flex justify-between items-center group transition-all ${activeNoteId === note.id ? 'bg-accent text-accent-foreground font-medium shadow-sm' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <motion.span 
                    className="truncate flex-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {note.title || "无标题"}
                  </motion.span>
                  <motion.button
                    onClick={(e) => deleteNote(e, note.id)}
                    className="p-0.5 rounded-full hover:bg-destructive/20"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.1, opacity: 1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Trash2 
                      className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors shrink-0" 
                    />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
            {notes.length === 0 && (
               <motion.div 
                 className="text-center text-xs text-muted-foreground py-4"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ duration: 0.5 }}
               >
                 暂无笔记
               </motion.div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col gap-2 h-full min-w-0">
        <AnimatePresence mode="wait">
          {activeNote ? (
            <motion.div
              key={activeNote.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-2 h-full"
            >
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
              >
                <Input 
                  value={activeNote.title} 
                  onChange={(e) => updateNote(activeNote.id, 'title', e.target.value)}
                  className="font-bold border-none shadow-none px-0 focus-visible:ring-0 text-lg bg-transparent placeholder:text-muted-foreground/50 text-foreground" 
                  placeholder="在此输入笔记标题" 
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.2 }}
                className="flex-1"
              >
                <Textarea 
                  value={activeNote.content}
                  onChange={(e) => updateNote(activeNote.id, 'content', e.target.value)}
                  className="flex-1 resize-none border-none shadow-none px-0 focus-visible:ring-0 bg-transparent text-foreground leading-relaxed custom-scrollbar"
                  placeholder="在此输入内容..."
                />
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.3 }}
                className="text-[10px] text-muted-foreground text-right"
              >
                {new Date(activeNote.updatedAt).toLocaleString()}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center h-full text-muted-foreground text-sm bg-muted/20 rounded-lg border-2 border-dashed border-border/50"
            >
              选择或创建一个笔记
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}