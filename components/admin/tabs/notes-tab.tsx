'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { req, API, NoteItem, ConfirmState } from '../admin-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Check, X, FileText } from 'lucide-react';

export default function NotesTab({ showConfirm }: { showConfirm: (opts: Omit<ConfirmState, 'open'>) => void }) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const load = useCallback(async () => {
    const { data } = await req<NoteItem[]>('GET', `${API}/notes`);
    if (Array.isArray(data)) setNotes(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addNote = async () => {
    if (!newTitle.trim()) return;
    await req('POST', `${API}/notes`, { title: newTitle.trim(), content: newContent.trim() });
    setNewTitle(''); setNewContent('');
    load();
  };

  const delNote = (id: string) => {
    showConfirm({
      title: '删除笔记',
      description: '确定删除此笔记？',
      variant: 'destructive',
      onConfirm: async () => {
        await req('DELETE', `${API}/notes/${id}`);
        load();
      },
    });
  };

  const saveNote = async (id: string) => {
    if (!editTitle.trim()) return;
    await req('PUT', `${API}/notes/${id}`, { title: editTitle.trim(), content: editContent.trim() });
    setEditing(null);
    load();
  };

  if (notes.length === 0) {
    return (
      <div>
        <p className="text-muted-foreground text-center py-6 text-sm">暂无笔记 · 在下方添加</p>
        <div className="flex gap-2 items-center flex-wrap">
          <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="笔记标题"
            className="w-36 h-9 px-3 rounded-md border border-input bg-background text-sm" />
          <input value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="笔记内容"
            className="w-60 h-9 px-3 rounded-md border border-input bg-background text-sm"
            onKeyDown={e => { if (e.key === 'Enter') addNote(); }} />
          <Button variant="default" size="sm" onClick={addNote}><Plus className="size-3.5" /> 添加</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>标题</TableHead>
            <TableHead>内容</TableHead>
            <TableHead className="w-20">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notes.map(n => (
            <TableRow key={n.id}>
              {editing === n.id ? (
                <TableCell colSpan={3}>
                  <div className="flex gap-1.5 items-center">
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="标题"
                      className="flex-1 h-8 px-2 rounded border border-input bg-background text-sm" />
                    <input value={editContent} onChange={e => setEditContent(e.target.value)} placeholder="内容"
                      className="flex-[2] h-8 px-2 rounded border border-input bg-background text-sm" />
                    <Button variant="default" size="sm" onClick={() => saveNote(n.id)} aria-label="保存笔记"><Check className="size-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(null)} aria-label="取消编辑"><X className="size-3.5" /></Button>
                  </div>
                </TableCell>
              ) : (
                <>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span>{n.title}</span>
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground">
                    {n.content || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setEditing(n.id); setEditTitle(n.title); setEditContent(n.content || ''); }} aria-label="编辑笔记"><Pencil className="size-3.5" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => delNote(n.id)} aria-label="删除笔记"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex gap-2 items-center flex-wrap mt-3">
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="笔记标题"
          className="w-36 h-9 px-3 rounded-md border border-input bg-background text-sm" />
        <input value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="笔记内容"
          className="w-60 h-9 px-3 rounded-md border border-input bg-background text-sm"
          onKeyDown={e => { if (e.key === 'Enter') addNote(); }} />
        <Button variant="default" size="sm" onClick={addNote}><Plus className="size-3.5" /> 添加</Button>
      </div>
    </div>
  );
}
