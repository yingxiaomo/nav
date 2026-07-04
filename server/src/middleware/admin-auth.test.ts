import { describe, it, expect } from 'vitest';
import { signAdminSession, verifySession } from './admin-auth.ts';

describe('signAdminSession / verifySession', () => {
  it('应签发并验证有效 session', () => {
    const secret = 'test-secret-key-1234567890';
    const cookie = signAdminSession(secret);
    expect(cookie).toMatch(/^\d+:[a-f0-9]{64}$/);
    expect(verifySession(cookie, secret)).toBe(true);
  });

  it('应拒绝篡改过的 cookie', () => {
    const secret = 'test-secret-key-1234567890';
    const cookie = signAdminSession(secret);
    const [expires] = cookie.split(':');
    // 篡改 hmac
    const tampered = `${expires}:${'a'.repeat(64)}`;
    expect(verifySession(tampered, secret)).toBe(false);
  });

  it('应拒绝格式错误的 cookie', () => {
    expect(verifySession('', 'secret')).toBe(false);
    expect(verifySession('no-colons', 'secret')).toBe(false);
    expect(verifySession('1:2:3', 'secret')).toBe(false);
  });

  it('应拒绝错误 secret', () => {
    const cookie = signAdminSession('real-secret');
    expect(verifySession(cookie, 'wrong-secret')).toBe(false);
  });

  it('应拒绝已过期的 session', () => {
    // 伪造一个过期时间戳
    const expired = Date.now() - 1000;
    const fakeCookie = `${expired}:0000000000000000000000000000000000000000000000000000000000000000`;
    expect(verifySession(fakeCookie, 'any')).toBe(false);
  });
});
