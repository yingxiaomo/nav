import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
const METADATA_FILE = path.join(DATA_DIR, 'docker-metadata.json');

export interface DockerContainerMeta {
  name: string;
  icon?: string;
}

function ensureDir() {
  const dir = path.dirname(METADATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadAll(): Record<string, DockerContainerMeta> {
  try {
    ensureDir();
    if (!fs.existsSync(METADATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, DockerContainerMeta>) {
  ensureDir();
  fs.writeFileSync(METADATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function getDockerMetadata(name: string): DockerContainerMeta | null {
  return loadAll()[name] || null;
}

export function setDockerMetadata(name: string, meta: DockerContainerMeta) {
  const all = loadAll();
  all[name] = meta;
  saveAll(all);
}

export function getAllDockerMetadata(): Record<string, DockerContainerMeta> {
  return loadAll();
}
