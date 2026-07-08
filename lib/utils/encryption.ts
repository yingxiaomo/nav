// 轻量编码工具 — 防止 localStorage 中敏感字段被目视窥屏
// 不使用真正的加密：密钥与密文同存一处并无安全意义（能读你 localStorage 的人也能读你的密钥）
// 使用 btoa/atob 基础编码足以防止 DevTools 中一眼看到敏感 token

const B64_PREFIX = '__b64__';

/**
 * 编码字符串（base64）
 * 同步版本，替代旧的 AES-GCM 异步加密
 */
export function encryptData(data: string): string {
  try { return btoa(data); } catch { return data; }
}

/**
 * 解码字符串，失败返回 null
 * 会校验解码结果是否有效（防止旧版 AES-GCM 加密数据产生垃圾输出）
 */
export function decryptData(encoded: string): string | null {
  try {
    const decoded = atob(encoded);
    // 校验：重新编码后是否一致 —— 筛掉旧版 AES-GCM 加密的二进制数据
    if (btoa(decoded) === encoded) return decoded;
    return null;
  } catch { return null; }
}

/**
 * 安全存储对象到 localStorage
 * 有敏感字段时整体 base64 编码，否则直接 JSON 存储
 */
export function safeLocalStorageSet<T>(
  key: string,
  data: T,
  sensitiveFields: string[] = []
): void {
  try {
    if (typeof window === 'undefined') return;
    if (!sensitiveFields.length) {
      localStorage.setItem(key, JSON.stringify(data));
      return;
    }
    localStorage.setItem(key, B64_PREFIX + btoa(JSON.stringify(data)));
  } catch (e) {
    console.error('safeLocalStorageSet failed:', e);
    throw e;
  }
}

/**
 * 从 localStorage 安全读取对象，自动解码
 * 会自动检测新格式（__b64__）、旧明文 JSON、旧 AES-GCM 加密数据
 * 旧加密数据无法解码时返回 null，触发调用方让用户重新输入
 */
export function safeLocalStorageGet<T>(
  key: string,
  _sensitiveFields: string[] = []
): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    // 新格式：__b64__ + base64(JSON)
    if (raw.startsWith(B64_PREFIX)) {
      return JSON.parse(atob(raw.slice(B64_PREFIX.length))) as T;
    }

    // 旧明文 JSON（无敏感字段时存储的格式，或旧版未加密数据）
    if (raw.startsWith('{') || raw.startsWith('[')) {
      return JSON.parse(raw) as T;
    }

    // 旧 AES-GCM 加密数据（无法解码）
    console.warn(
      '[encryption] 检测到旧版加密格式（AES-GCM），请重新输入敏感字段的值。',
      '旧加密密钥位于 localStorage["clean-nav-encryption-key"]，可手动清除。'
    );
    return null;
  } catch (e) {
    console.error('safeLocalStorageGet failed:', e);
    return null;
  }
}
