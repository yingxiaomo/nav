'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { req, API, Category, ConfirmState } from '../admin-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Check, X, Folder } from 'lucide-react';

export default function CategoriesTab({ showConfirm }: { showConfirm: (opts: Omit<ConfirmState, 'open'>) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editIcon, setEditIcon] = useState('');

  const load = useCallback(async () => {
    const { data } = await req<Category[]>('GET', `${API}/categories`);
    if (Array.isArray(data)) setCats(data);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const addCat = async () => {
    if (!newTitle.trim()) return;
    await req('POST', `${API}/categories`, { title: newTitle.trim() });
    setNewTitle('');
    load();
  };

  const delCat = (id: string) => {
    showConfirm({
      title: '删除分类',
      description: '确定删除此分类？书签也会一起删除',
      variant: 'destructive',
      onConfirm: async () => {
        await req('DELETE', `${API}/categories/${id}`);
        load();
      },
    });
  };

  const saveCat = async (id: string, title: string, icon: string) => {
    if (!title.trim()) return;
    await req('PUT', `${API}/categories/${id}`, { title: title.trim(), icon: icon.trim() || undefined });
    setEditing(null);
    load();
  };

  if (cats.length === 0) {
    return (
      <div>
        <p className="text-muted-foreground text-center py-6 text-sm">暂无分类 · 在下方添加</p>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="新分类名称"
            className="flex-1 min-w-[120px] h-9 px-3 rounded-md border border-input bg-background text-sm"
            onKeyDown={e => { if (e.key === 'Enter') addCat(); }}
          />
          <Button variant="default" size="sm" onClick={addCat}><Plus className="size-3.5" /> 添加</Button>
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
            <TableHead>书签数</TableHead>
            <TableHead className="w-28">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cats.map(c => (
            <TableRow key={c.id}>
              {editing === c.id ? (
                <TableCell colSpan={3}>
                  <div className="flex gap-1.5 items-center">
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="标题" className="flex-1 h-8 px-2 rounded border border-input bg-background text-sm" />
                    <input value={editIcon} onChange={e => setEditIcon(e.target.value)} placeholder="图标" className="w-20 h-8 px-2 rounded border border-input bg-background text-sm" />
                    <Button variant="default" size="sm" onClick={() => saveCat(c.id, editTitle, editIcon)} aria-label="保存分类"><Check className="size-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(null)} aria-label="取消编辑"><X className="size-3.5" /></Button>
                  </div>
                </TableCell>
              ) : (
                <>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <Folder className="size-3.5 text-muted-foreground" />
                      <span>{c.title}</span>
                    </span>
                  </TableCell>
                  <TableCell>{c.links?.length || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setEditing(c.id); setEditTitle(c.title); setEditIcon(c.icon || ''); }} aria-label="编辑分类"><Pencil className="size-3.5" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => delCat(c.id)} aria-label="删除分类"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex gap-2 items-center flex-wrap mt-3">
        <input
          value={newTitle} onChange={e => setNewTitle(e.target.value)}
          placeholder="新分类名称"
          className="w-48 h-9 px-3 rounded-md border border-input bg-background text-sm"
          onKeyDown={e => { if (e.key === 'Enter') addCat(); }}
        />
        <Button variant="default" size="sm" onClick={addCat}><Plus className="size-3.5" /> 添加</Button>
      </div>
    </div>
  );
}
