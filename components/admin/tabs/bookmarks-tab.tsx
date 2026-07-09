'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { req, API, LinkItem, Category, ConfirmState } from '../admin-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Check, X, Link, ExternalLink } from 'lucide-react';

export default function BookmarksTab({ showConfirm }: { showConfirm: (opts: Omit<ConfirmState, 'open'>) => void }) {
  const [bms, setBms] = useState<LinkItem[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');

  const load = useCallback(async () => {
    const [br, cr] = await Promise.all([
      req<LinkItem[]>('GET', `${API}/bookmarks`),
      req<Category[]>('GET', `${API}/categories`),
    ]);
    if (br.ok) setBms(br.data);
    if (cr.ok) setCats(cr.data);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const addBm = async () => {
    if (!newCat || !newTitle.trim() || !newUrl.trim()) return;
    await req('POST', `${API}/bookmarks`, { categoryId: newCat, title: newTitle.trim(), url: newUrl.trim() });
    setNewTitle(''); setNewUrl('');
    load();
  };

  const delBm = (id: string) => {
    showConfirm({
      title: '删除书签',
      description: '确定删除此书签？',
      variant: 'destructive',
      onConfirm: async () => {
        await req('DELETE', `${API}/bookmarks/${id}`);
        load();
      },
    });
  };

  const saveBm = async (id: string) => {
    if (!editTitle.trim() || !editUrl.trim()) return;
    await req('PUT', `${API}/bookmarks/${id}`, { title: editTitle.trim(), url: editUrl.trim() });
    setEditing(null);
    load();
  };

  if (bms.length === 0) {
    return (
      <div>
        <p className="text-muted-foreground text-center py-6 text-sm">暂无书签 · 在下方添加</p>
        <AddBookmarkForm cats={cats} newCat={newCat} setNewCat={setNewCat} newTitle={newTitle} setNewTitle={setNewTitle} newUrl={newUrl} setNewUrl={setNewUrl} addBm={addBm} />
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>标题</TableHead>
            <TableHead>URL</TableHead>
            <TableHead className="w-24">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bms.map(b => (
            <TableRow key={b.id}>
              {editing === b.id ? (
                <TableCell colSpan={3}>
                  <div className="flex gap-1.5 items-center">
                    <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="标题" className="flex-1 h-8 px-2 rounded border border-input bg-background text-sm" />
                    <input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="https://..." className="flex-[2] h-8 px-2 rounded border border-input bg-background text-sm" />
                    <Button variant="default" size="sm" onClick={() => saveBm(b.id)} aria-label="保存书签"><Check className="size-3.5" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(null)} aria-label="取消编辑"><X className="size-3.5" /></Button>
                  </div>
                </TableCell>
              ) : (
                <>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <Link className="size-3.5 text-muted-foreground" />
                      <span>{b.title}</span>
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[250px] overflow-hidden text-ellipsis whitespace-nowrap">
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary no-underline text-xs hover:underline">
                      <ExternalLink className="size-3" />
                      <span className="truncate max-w-[200px]">{b.url}</span>
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => { setEditing(b.id); setEditTitle(b.title); setEditUrl(b.url); }} aria-label="编辑书签"><Pencil className="size-3.5" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => delBm(b.id)} aria-label="删除书签"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </TableCell>
                </>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <AddBookmarkForm cats={cats} newCat={newCat} setNewCat={setNewCat} newTitle={newTitle} setNewTitle={setNewTitle} newUrl={newUrl} setNewUrl={setNewUrl} addBm={addBm} />
    </div>
  );
}

function AddBookmarkForm({ cats, newCat, setNewCat, newTitle, setNewTitle, newUrl, setNewUrl, addBm }: {
  cats: Category[];
  newCat: string; setNewCat: (v: string) => void;
  newTitle: string; setNewTitle: (v: string) => void;
  newUrl: string; setNewUrl: (v: string) => void;
  addBm: () => void;
}) {
  return (
    <div className="flex gap-2 items-center flex-wrap mt-3">
      <select
        value={newCat} onChange={e => setNewCat(e.target.value)}
        className="w-36 h-9 px-3 rounded-md border border-input bg-background text-sm"
      >
        <option value="">选择分类</option>
        {cats.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
      </select>
      <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="标题"
        className="w-36 h-9 px-3 rounded-md border border-input bg-background text-sm" />
      <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..."
        className="w-48 h-9 px-3 rounded-md border border-input bg-background text-sm"
        onKeyDown={e => { if (e.key === 'Enter') addBm(); }} />
      <Button variant="default" size="sm" onClick={addBm}><Plus className="size-3.5" /> 添加</Button>
    </div>
  );
}
