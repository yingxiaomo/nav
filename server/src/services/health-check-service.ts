import { db } from '../db/index.ts';
import { monitorTargets } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { isPrivateHost } from './security.ts';

export interface MonitorTarget {
  id: string;
  name: string;
  url: string;
  timeout: number;
  createdAt: number;
}

export interface CheckResult {
  id: string;
  name: string;
  url: string;
  status: 'ok' | 'timeout' | 'error';
  latency: number | null;
  lastCheck: number | null;
}

const CHECK_TIMEOUT = 5000;
let cachedResults = new Map<string, CheckResult>();

// 定时巡检（每 60 秒）
let interval: ReturnType<typeof setInterval> | null = null;

export function startHealthChecks(): void {
  if (interval) return;
  runAllChecks();
  interval = setInterval(runAllChecks, 60_000);
}

export function stopHealthChecks(): void {
  if (interval) { clearInterval(interval); interval = null; }
}

export function getTargets(): MonitorTarget[] {
  try {
    return db.select().from(monitorTargets).orderBy(monitorTargets.createdAt).all() as MonitorTarget[];
  } catch {
    return [];
  }
}

export function addTarget(name: string, url: string, timeout = CHECK_TIMEOUT): MonitorTarget {
  const target = { id: crypto.randomUUID(), name, url, timeout, createdAt: Date.now() };
  db.insert(monitorTargets).values(target).run();
  return target;
}

export function updateTarget(id: string, data: { name?: string; url?: string; timeout?: number }): boolean {
  const existing = db.select().from(monitorTargets).where(eq(monitorTargets.id, id)).get();
  if (!existing) return false;
  db.update(monitorTargets).set(data).where(eq(monitorTargets.id, id)).run();
  return true;
}

export function deleteTarget(id: string): boolean {
  const existing = db.select().from(monitorTargets).where(eq(monitorTargets.id, id)).get();
  if (!existing) return false;
  db.delete(monitorTargets).where(eq(monitorTargets.id, id)).run();
  cachedResults.delete(id);
  return true;
}

async function checkTarget(target: MonitorTarget): Promise<CheckResult> {
  // SSRF 防护：阻止巡检内网地址
  try {
    const url = new URL(target.url);
    if (isPrivateHost(url.hostname)) {
      return { id: target.id, name: target.name, url: target.url, status: 'error', latency: null, lastCheck: Date.now() };
    }
  } catch {
    return { id: target.id, name: target.name, url: target.url, status: 'error', latency: null, lastCheck: Date.now() };
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), target.timeout || CHECK_TIMEOUT);
    const res = await fetch(target.url, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    const latency = Date.now() - start;
    return { id: target.id, name: target.name, url: target.url, status: 'ok', latency, lastCheck: Date.now() };
  } catch {
    return { id: target.id, name: target.name, url: target.url, status: 'timeout', latency: null, lastCheck: Date.now() };
  }
}

async function runAllChecks(): Promise<void> {
  const targets = getTargets();
  const results = await Promise.all(targets.map(t => checkTarget(t)));
  for (const r of results) {
    cachedResults.set(r.id, r);
  }
}

export function getCheckResults(): CheckResult[] {
  const targets = getTargets();
  return targets.map(t => cachedResults.get(t.id) || {
    id: t.id, name: t.name, url: t.url, status: 'error' as const,
    latency: null, lastCheck: null,
  });
}
