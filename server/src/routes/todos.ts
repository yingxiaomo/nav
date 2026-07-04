import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { db } from '../db/index.ts';
import { todos } from '../db/schema.ts';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { apiError } from '../utils/response.ts';

const todoRoutes = new Hono();

const createSchema = z.object({
  text: z.string().min(1, '内容不能为空'),
});

const updateSchema = z.object({
  text: z.string().optional(),
  completed: z.boolean().optional(),
});

// ===== GET /api/v1/todos =====
todoRoutes.get('/', async (c) => {
  const all = await db
    .select()
    .from(todos)
    .orderBy(asc(todos.createdAt));
  return c.json(all);
});

// ===== POST /api/v1/todos =====
todoRoutes.post('/', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');
  const now = Date.now();

  const newTodo = {
    id: nanoid(),
    text: body.text,
    completed: false,
    createdAt: now,
  };

  await db.insert(todos).values(newTodo);
  return c.json(newTodo, 201);
});

// ===== PUT /api/v1/todos/:id =====
todoRoutes.put('/:id', zValidator('json', updateSchema), async (c) => {
  const { id } = c.req.param();
  const body = c.req.valid('json');

  const existing = await db
    .select()
    .from(todos)
    .where(eq(todos.id, id))
    .get();

  if (!existing) return c.json(apiError('待办不存在', 'NOT_FOUND'), 404);

  await db
    .update(todos)
    .set({
      ...(body.text !== undefined && { text: body.text }),
      ...(body.completed !== undefined && { completed: body.completed }),
    })
    .where(eq(todos.id, id));

  const updated = await db
    .select()
    .from(todos)
    .where(eq(todos.id, id))
    .get();

  return c.json(updated);
});

// ===== DELETE /api/v1/todos/:id =====
todoRoutes.delete('/:id', async (c) => {
  const { id } = c.req.param();

  const existing = await db
    .select()
    .from(todos)
    .where(eq(todos.id, id))
    .get();

  if (!existing) return c.json(apiError('待办不存在', 'NOT_FOUND'), 404);

  await db.delete(todos).where(eq(todos.id, id));
  return c.json({ success: true });
});

export default todoRoutes;
