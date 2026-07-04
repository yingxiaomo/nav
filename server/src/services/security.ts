/**
 * 安全工具函数 - SSRF 防护等
 */

/** 检查目标主机是否为私有/内网地址 */
export function isPrivateHost(hostname: string): boolean {
  // 常见私有域名
  const privateHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]'];
  if (privateHosts.includes(hostname.toLowerCase())) return true;
  if (hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname.endsWith('.lan')) return true;

  // IPv4 私有段：10.x.x.x, 172.16-31.x.x, 192.168.x.x, 127.x.x.x
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [a, b] = [parseInt(ipMatch[1]), parseInt(ipMatch[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
  }

  // IPv6 私有地址
  // fc00::/7 (唯一本地地址), fe80::/10 (链路本地地址)
  // ::1 (回环), ::ffff:0:0/96 (IPv4 映射地址)
  if (hostname.startsWith('[') || hostname.includes(':')) {
    const ipv6 = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (ipv6 === '::1' || ipv6 === '::') return true;
    if (ipv6.startsWith('fc') || ipv6.startsWith('fd')) return true;
    if (ipv6.startsWith('fe80')) return true;
    if (ipv6.startsWith('::ffff:127') || ipv6.startsWith('::ffff:10') ||
        ipv6.startsWith('::ffff:192.168') || ipv6.startsWith('::ffff:172.')) return true;
  }

  return false;
}
