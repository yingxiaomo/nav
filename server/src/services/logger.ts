import fs from 'node:fs';
import path from 'node:path';

const logDir = path.resolve(process.env.UPLOAD_DIR ?? './data');
const logFile = path.join(logDir, 'nav-server.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB

function ensureLogFile(): void {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

/** 追加日志，超 5MB 自动截断前半 */
export function log(level: string, msg: string): void {
  ensureLogFile();
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  try {
    fs.appendFileSync(logFile, line);
    // 检查大小并截断
    const stat = fs.statSync(logFile);
    if (stat.size > MAX_LOG_SIZE) {
      const content = fs.readFileSync(logFile, 'utf-8');
      const half = content.slice(content.length / 2);
      fs.writeFileSync(logFile, `[${new Date().toISOString()}] [INFO] 日志已截断（超过 5MB）\n${half}`);
    }
  } catch {
    // 日志写入失败不干扰主流程
  }
}

export function info(msg: string): void { log('INFO', msg); }
export function warn(msg: string): void { log('WARN', msg); }
export function error(msg: string): void { log('ERROR', msg); }

/** 读取最近 N 条日志 */
export function readRecent(lines: number = 200): string[] {
  ensureLogFile();
  try {
    const content = fs.readFileSync(logFile, 'utf-8');
    const all = content.split('\n').filter(Boolean);
    return all.slice(-lines);
  } catch {
    return [];
  }
}
