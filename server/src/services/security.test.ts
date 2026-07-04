import { describe, it, expect } from 'vitest';
import { isPrivateHost } from './security.ts';

describe('isPrivateHost', () => {
  it('应识别 localhost', () => {
    expect(isPrivateHost('localhost')).toBe(true);
    expect(isPrivateHost('127.0.0.1')).toBe(true);
    expect(isPrivateHost('[::1]')).toBe(true);
  });

  it('应识别 IPv4 私有段', () => {
    expect(isPrivateHost('10.0.0.1')).toBe(true);
    expect(isPrivateHost('172.16.0.1')).toBe(true);
    expect(isPrivateHost('172.31.255.255')).toBe(true);
    expect(isPrivateHost('192.168.1.1')).toBe(true);
  });

  it('应拒绝公网 IPv4 地址', () => {
    expect(isPrivateHost('8.8.8.8')).toBe(false);
    expect(isPrivateHost('1.1.1.1')).toBe(false);
    expect(isPrivateHost('172.32.0.1')).toBe(false);
  });

  it('应识别私有域名后缀', () => {
    expect(isPrivateHost('server.local')).toBe(true);
    expect(isPrivateHost('internal.internal')).toBe(true);
    expect(isPrivateHost('nas.lan')).toBe(true);
  });

  it('应识别 IPv6 私有地址', () => {
    expect(isPrivateHost('fc00::1')).toBe(true);
    expect(isPrivateHost('fd00::1')).toBe(true);
    expect(isPrivateHost('fe80::1')).toBe(true);
    expect(isPrivateHost('::1')).toBe(true);
  });

  it('应拒绝公网域名', () => {
    expect(isPrivateHost('github.com')).toBe(false);
    expect(isPrivateHost('example.com')).toBe(false);
  });

  it('应处理 0.0.0.0', () => {
    expect(isPrivateHost('0.0.0.0')).toBe(true);
    expect(isPrivateHost('[::]')).toBe(true);
  });
});
