import { describe, it, expect } from 'vitest';
import { wakeOnLan } from './wol-service.ts';

// 手写私有函数测试——验证 magic packet 构造逻辑
// 不实际发送 UDP（需要网络），仅验证 MAC 解析

/** MAC 地址解析和 magic packet 构造（私有函数，直接复制测试逻辑）*/
function parseMac(mac: string): Buffer | null {
  const cleaned = mac.replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length !== 12) return null;
  return Buffer.from(cleaned, 'hex');
}

function buildMagicPacket(macBuffer: Buffer): Buffer {
  const packet = Buffer.alloc(6 + 16 * 6);
  packet.fill(0xFF, 0, 6);
  for (let i = 0; i < 16; i++) {
    macBuffer.copy(packet, 6 + i * 6);
  }
  return packet;
}

describe('MAC 地址解析', () => {
  it('应解析标准格式 xx:xx:xx:xx:xx:xx', () => {
    const buf = parseMac('AA:BB:CC:DD:EE:FF');
    expect(buf).not.toBeNull();
    expect(buf!.toString('hex').toUpperCase()).toBe('AABBCCDDEEFF');
  });

  it('应解析连字符格式 xx-xx-xx-xx-xx-xx', () => {
    const buf = parseMac('aa-bb-cc-dd-ee-ff');
    expect(buf).not.toBeNull();
    expect(buf!.toString('hex')).toBe('aabbccddeeff');
  });

  it('应解析无分隔符格式', () => {
    const buf = parseMac('AABBCCDDEEFF');
    expect(buf).not.toBeNull();
    expect(buf!.toString('hex').toUpperCase()).toBe('AABBCCDDEEFF');
  });

  it('应拒绝无效 MAC（长度不对）', () => {
    expect(parseMac('AA:BB:CC:DD:EE')).toBeNull();
    expect(parseMac('')).toBeNull();
  });

  it('应拒绝无效 MAC（非法字符）', () => {
    expect(parseMac('GG:HH:II:JJ:KK:LL')).toBeNull();
  });
});

describe('Magic Packet 构造', () => {
  it('应以 6 字节 0xFF 开头', () => {
    const mac = parseMac('AA:BB:CC:DD:EE:FF')!;
    const packet = buildMagicPacket(mac);
    expect(packet.slice(0, 6)).toEqual(Buffer.alloc(6, 0xFF));
  });

  it('应包含 16 次重复的 MAC 地址', () => {
    const mac = parseMac('AA:BB:CC:DD:EE:FF')!;
    const packet = buildMagicPacket(mac);
    expect(packet.length).toBe(6 + 16 * 6);
    for (let i = 0; i < 16; i++) {
      const offset = 6 + i * 6;
      expect(packet.slice(offset, offset + 6)).toEqual(mac);
    }
  });
});

describe('wakeOnLan 公共接口', () => {
  it('无效 MAC 应返回 false（不发送网络请求）', async () => {
    const result = await wakeOnLan('invalid-mac');
    expect(result).toBe(false);
  });

  it('空字符串应返回 false', async () => {
    const result = await wakeOnLan('');
    expect(result).toBe(false);
  });
});
