import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.ts';
import { notes } from '../db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const noteRoutes = new Hono();

const createSchema = z.object({
  title: z.string().optional().default(''),
  content: z.string().optional().default(''),
});

const updateSchema = createSchema.partial();

// ===== GET /api/v1/notes =====
noteRoutes.get('/', async (c) => {
  const all = await db
    .select()
    .from(notes)
    .orderBy(desc(notes.updatedAt));
  return c.json(all);
});

// ===== GET /api/v1/notes/:id =====
noteRoutes.get('/:id', async (c) => {
  const { id } = c.req.param();
  const note = await db
    .select()
    .from(notes)
    .where(eq(notes.id, id))
    .get();

  if (!note) return c.json({ error: '笔记不存在' }, 404);
  return c.json(note);
});

// ===== POST /api/v1/notes =====
noteRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');
  const now = Date.now();

  const newNote = {
    id: nanoid(),
    title: body.title ?? '',
    content: body.content ?? '',
    updatedAt: now,
  };

  await db.insert(notes).values(newNote);
  return c.json(newNote, 201);
});

// ===== PUT /api/v1/notes/:id =====
noteRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const existing = await db
    .select()
    .from(notes)
    .where(eq(notes.id, id))
    .get();

  if (!existing) return c.json({ error: '笔记不存在' }, 404);

  await db
    .update(notes)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      updatedAt: Date.now(),
    })
    .where(eq(notes.id, id));

  const updated = await db
    .select()
    .from(notes)
    .where(eq(notes.id, id))
    .get();

  return c.json(updated);
});

// ===== DELETE /api/v1/notes/:id =====
noteRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();

  const existing = await db
    .select()
    .from(notes)
    .where(eq(notes.id, id))
    .get();

  if (!existing) return c.json({ error: '笔记不存在' }, 404);

  await db.delete(notes).where(eq(notes.id, id));
  return c.json({ success: true });
});

export default noteRoutes;
