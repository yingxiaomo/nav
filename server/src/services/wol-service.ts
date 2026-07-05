import dgram from 'node:dgram';

/**
 * Wake-on-LAN 服务
 * 发送 UDP 魔法包唤醒局域网内设备
 */

const WOL_PORT = 9;
const BROADCAST_ADDR = '255.255.255.255';

/** 解析 MAC 地址字符串为 Buffer，支持 xx:xx:xx:xx:xx:xx 和 xx-xx-xx-xx-xx-xx 格式 */
function parseMac(mac: string): Buffer | null {
  const cleaned = mac.replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length !== 12) return null;
  return Buffer.from(cleaned, 'hex');
}

/**
 * 发送 WOL 魔法包
 * @param mac MAC 地址字符串（如 "AA:BB:CC:DD:EE:FF")
 * @returns 是否发送成功
 */
export function wakeOnLan(mac: string): Promise<boolean> {
  return new Promise((resolve) => {
    const macBuffer = parseMac(mac);
    if (!macBuffer) {
      resolve(false);
      return;
    }

    // 魔法包 = 6 字节 0xFF + 16 次重复的 MAC 地址
    const packet = Buffer.alloc(6 + 16 * 6);
    packet.fill(0xFF, 0, 6);
    for (let i = 0; i < 16; i++) {
      macBuffer.copy(packet, 6 + i * 6);
    }

    const socket = dgram.createSocket('udp4');
    socket.on('error', () => {
      socket.close();
      resolve(false);
    });

    socket.send(packet, 0, packet.length, WOL_PORT, BROADCAST_ADDR, (err) => {
      socket.close();
      resolve(!err);
    });
  });
}
