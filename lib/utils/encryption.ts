// 敏感数据加密/解密工具
// 用于保护存储在localStorage中的敏感信息

// 加密密钥生成 - 使用浏览器的crypto API
const generateEncryptionKey = async (): Promise<CryptoKey> => {
  if (typeof crypto === 'undefined') {
    throw new Error('Web Crypto API is not available');
  }
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  return key;
};

// 将CryptoKey转换为字符串，用于存储
const exportKeyToBase64 = async (key: CryptoKey): Promise<string> => {
  if (typeof crypto === 'undefined') {
    throw new Error('Web Crypto API is not available');
  }
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
};

// 从字符串恢复CryptoKey
const importKeyFromBase64 = async (base64Key: string): Promise<CryptoKey> => {
  if (typeof crypto === 'undefined') {
    throw new Error('Web Crypto API is not available');
  }
  const binaryKey = atob(base64Key);
  return crypto.subtle.importKey(
    'raw',
    Uint8Array.from(binaryKey, c => c.charCodeAt(0)),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

// 获取或生成加密密钥
const getOrCreateEncryptionKey = async (): Promise<CryptoKey> => {
  if (typeof window === 'undefined') {
    throw new Error('localStorage is not available in this environment');
  }
  // 检查本地存储中是否已有密钥
  const storedKey = window.localStorage.getItem('clean-nav-encryption-key');
  if (storedKey) {
    try {
      return await importKeyFromBase64(storedKey);
    } catch (error) {
      console.error('Failed to import encryption key, generating new one:', error);
      // 密钥无效，生成新密钥
      const newKey = await generateEncryptionKey();
      const newKeyBase64 = await exportKeyToBase64(newKey);
      window.localStorage.setItem('clean-nav-encryption-key', newKeyBase64);
      return newKey;
    }
  }
  // 生成新密钥
  const newKey = await generateEncryptionKey();
  const newKeyBase64 = await exportKeyToBase64(newKey);
  window.localStorage.setItem('clean-nav-encryption-key', newKeyBase64);
  return newKey;
};

/**
 * 加密敏感数据
 * @param data 要加密的数据
 * @returns 加密后的字符串
 */
export const encryptData = async (data: string): Promise<string> => {
  try {
    const key = await getOrCreateEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 12字节IV用于AES-GCM
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedData
    );
    
    // 将IV和密文组合成一个字符串，使用Base64编码
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // 优化：使用更高效的方式将Uint8Array转换为Base64
    const uint8ArrayToBase64 = (arr: Uint8Array): string => {
      let binary = '';
      for (let i = 0; i < arr.length; i++) {
        binary += String.fromCharCode(arr[i]);
      }
      return btoa(binary);
    };
    
    return uint8ArrayToBase64(combined);
  } catch (error) {
    console.error('Encryption failed:', error);
    // 在加密失败时，返回原始数据（降级处理）
    return data;
  }
};

/**
 * 解密敏感数据
 * @param encryptedData 加密后的数据
 * @returns 解密后的字符串
 */
export const decryptData = async (encryptedData: string): Promise<string> => {
  try {
    // 如果数据看起来没有被加密，直接返回
    if (!encryptedData || encryptedData.length < 20) {
      return encryptedData;
    }
    
    // 验证是否为有效的Base64字符串
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(encryptedData)) {
      // 不是有效的Base64字符串，直接返回原始数据
      return encryptedData;
    }
    
    const key = await getOrCreateEncryptionKey();
    
    let binaryString;
    try {
      // 优化：使用更高效的方式将Base64字符串转换为Uint8Array
      binaryString = atob(encryptedData);
    } catch {
      // atob解码失败，直接返回原始数据
      return encryptedData;
    }
    
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // 确保数据长度足够（至少包含12字节IV）
    if (bytes.length < 12) {
      return encryptedData;
    }
    
    const iv = bytes.slice(0, 12);
    const encrypted = bytes.slice(12);
    
    // 确保有加密数据
    if (encrypted.length === 0) {
      return encryptedData;
    }
    
    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch {
      // 解密操作失败，直接返回原始数据
      // 可能的原因：密钥不匹配、IV不匹配、数据损坏等
      return encryptedData;
    }
  } catch (error) {
    console.error('Decryption failed:', error);
    // 解密失败时，返回原始数据（可能是未加密的数据）
    return encryptedData;
  }
};

/**
 * 安全存储对象到localStorage，自动加密敏感字段
 * @param key 存储键名
 * @param data 要存储的数据对象
 * @param sensitiveFields 需要加密的敏感字段路径数组
 */
export const safeLocalStorageSet = async <T>(
  key: string,
  data: T,
  sensitiveFields: string[] = []
): Promise<void> => {
  try {
    if (typeof window === 'undefined') {
      // 非浏览器环境，不执行存储操作
      return;
    }
    
    if (!sensitiveFields.length) {
      // 没有敏感字段，直接存储
      window.localStorage.setItem(key, JSON.stringify(data));
      return;
    }
    
    // 深拷贝数据，避免修改原始对象
    const clone = JSON.parse(JSON.stringify(data)) as T;
    
    // 加密每个敏感字段
    for (const fieldPath of sensitiveFields) {
      const keys = fieldPath.split('.');
      let current: unknown = clone;
      
      // 遍历到字段的父对象
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (current && typeof current === 'object' && k in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[k];
        } else {
          break;
        }
      }
      
      const lastKey = keys[keys.length - 1];
      if (current && typeof current === 'object' && lastKey in (current as Record<string, unknown>)) {
        const value = String((current as Record<string, unknown>)[lastKey] || '');
        (current as Record<string, unknown>)[lastKey] = await encryptData(value);
      }
    }
    
    window.localStorage.setItem(key, JSON.stringify(clone));
  } catch (error) {
    console.error('Safe localStorage set failed:', error);
    // 失败时，降级为直接存储（如果在浏览器环境中）
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, JSON.stringify(data));
    }
  }
};

/**
 * 从localStorage安全读取对象，自动解密敏感字段
 * @param key 存储键名
 * @param sensitiveFields 需要解密的敏感字段路径数组
 * @returns 读取并解密后的数据对象
 */
export const safeLocalStorageGet = async <T>(
  key: string,
  sensitiveFields: string[] = []
): Promise<T | null> => {
  try {
    if (typeof window === 'undefined') {
      // 非浏览器环境，返回null
      return null;
    }
    
    const item = window.localStorage.getItem(key);
    if (!item) return null;
    
    const data = JSON.parse(item) as T;
    
    if (!sensitiveFields.length) {
      // 没有敏感字段，直接返回
      return data;
    }
    
    // 深拷贝数据，避免修改原始对象
    const clone = JSON.parse(JSON.stringify(data)) as T;
    
    // 解密每个敏感字段
    for (const fieldPath of sensitiveFields) {
      const keys = fieldPath.split('.');
      let current: unknown = clone;
      
      // 遍历到字段的父对象
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (current && typeof current === 'object' && k in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[k];
        } else {
          break;
        }
      }
      
      const lastKey = keys[keys.length - 1];
      if (current && typeof current === 'object' && lastKey in (current as Record<string, unknown>)) {
        const value = String((current as Record<string, unknown>)[lastKey] || '');
        (current as Record<string, unknown>)[lastKey] = await decryptData(value);
      }
    }
    
    return clone;
  } catch (error) {
    console.error('Safe localStorage get failed:', error);
    // 失败时，降级为直接读取（如果在浏览器环境中）
    if (typeof window !== 'undefined') {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) as T : null;
    }
    return null;
  }
};