'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { req, API, TodoItem } from '../admin-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';

export default function TodosTab() {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newText, setNewText] = useState('');

  const load = useCallback(async () => {
    const { data } = await req<TodoItem[]>('GET', `${API}/todos`);
    if (Array.isArray(data)) setTodos(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addTodo = async () => {
    if (!newText.trim()) return;
    await req('POST', `${API}/todos`, { text: newText.trim() });
    setNewText('');
    load();
  };

  const delTodo = async (id: string) => {
    await req('DELETE', `${API}/todos/${id}`);
    load();
  };

  const toggleTodo = async (id: string) => {
    const t = todos.find(x => x.id === id);
    if (!t) return;
    await req('PUT', `${API}/todos/${id}`, { completed: !t.completed });
    load();
  };

  if (todos.length === 0) {
    return (
      <div>
        <p className="text-muted-foreground text-center py-6 text-sm">暂无待办 · 在下方添加</p>
        <div className="flex gap-2 items-center flex-wrap">
          <input
            value={newText} onChange={e => setNewText(e.target.value)}
            placeholder="新待办..."
            className="w-72 h-9 px-3 rounded-md border border-input bg-background text-sm"
            onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
          />
          <Button variant="default" size="sm" onClick={addTodo}><Plus className="size-3.5" /> 添加</Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">状态</TableHead>
            <TableHead>内容</TableHead>
            <TableHead className="w-20">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {todos.map(t => (
            <TableRow key={t.id}>
              <TableCell>
                <input
                  type="checkbox"
                  checked={t.completed}
                  onChange={() => toggleTodo(t.id)}
                  className="size-4 accent-[var(--theme-accent)]"
                />
              </TableCell>
              <TableCell className={t.completed ? 'line-through text-muted-foreground' : ''}>
                {t.text}
              </TableCell>
              <TableCell>
                <Button variant="destructive" size="sm" onClick={() => delTodo(t.id)} aria-label="删除待办">
                  <Trash2 className="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex gap-2 items-center flex-wrap mt-3">
        <input
          value={newText} onChange={e => setNewText(e.target.value)}
          placeholder="新待办..."
          className="w-72 h-9 px-3 rounded-md border border-input bg-background text-sm"
          onKeyDown={e => { if (e.key === 'Enter') addTodo(); }}
        />
        <Button variant="default" size="sm" onClick={addTodo}><Plus className="size-3.5" /> 添加</Button>
      </div>
    </div>
  );
}
