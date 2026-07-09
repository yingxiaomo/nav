'use client';

import { useState, useEffect } from 'react';
import { req, API, Category, TodoItem, NoteItem, StatCard } from '../admin-tabs';

export default function OverviewTab() {
  const [cats, setCats] = useState<Category[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);

  useEffect(() => {
    (async () => {
      const [cr, tr, nr] = await Promise.all([
        req<Category[]>('GET', `${API}/categories`),
        req<TodoItem[]>('GET', `${API}/todos`),
        req<NoteItem[]>('GET', `${API}/notes`),
      ]);
      if (cr.ok) setCats(cr.data);
      if (tr.ok) setTodos(tr.data);
      if (nr.ok) setNotes(nr.data);
    })();
  }, []);

  const bmCount = cats.reduce((s, c) => s + (c.links?.length || 0), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard value={cats.length} label="分类" />
      <StatCard value={bmCount} label="书签" />
      <StatCard value={todos.length} label="待办" />
      <StatCard value={notes.length} label="笔记" />
    </div>
  );
}
