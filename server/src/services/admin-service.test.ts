import { describe, it, expect } from 'vitest';
import { verifyApiToken, generateApiToken } from '../services/admin-service.ts';

// Note: hasAdminPassword / verifyAdminPassword / saveAdminPassword
// depend on DB and are tested via the API integration tests.

describe('verifyApiToken', () => {
  it('应拒绝未设置 token（无环境变量、无 DB 行）', () => {
    // 在测试环境下，没有 DB 也没有环境变量
    expect(verifyApiToken('anything')).toBe(false);
  });
});

describe('generateApiToken', () => {
  it('应生成 sk- 开头的 32 字节 base64url token', () => {
    const token = generateApiToken();
    expect(token).toMatch(/^sk-[A-Za-z0-9_-]{43}$/);
  });

  it('每次生成的 token 应不同', () => {
    const t1 = generateApiToken();
    const t2 = generateApiToken();
    expect(t1).not.toBe(t2);
  });
});
