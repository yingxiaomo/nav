import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 模拟 global.fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// 导入被测试模块（需要在 vi.stubGlobal 之后）
const { fetchMonitorIconUrl } = await import('./monitor-icon-service.ts');

function mockHtmlResponse(html: string, contentType = 'text/html') {
  return {
    ok: true,
    headers: new Map(Object.entries({ 'content-type': contentType })),
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(html).buffer),
  };
}

describe('fetchMonitorIconUrl', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应从 HTML 的 <link rel="icon"> 提取 favicon', async () => {
    mockFetch
      .mockResolvedValueOnce(mockHtmlResponse(
        '<html><head><link rel="icon" href="/favicon.ico"></head></html>'
      ));

    const icon = await fetchMonitorIconUrl('http://192.168.1.100:8080');
    expect(icon).toBe('http://192.168.1.100:8080/favicon.ico');
  });

  it('应提取 apple-touch-icon（优先于普通 icon）', async () => {
    mockFetch
      .mockResolvedValueOnce(mockHtmlResponse(
        '<html><head><link rel="apple-touch-icon" href="/apple-icon.png"><link rel="icon" href="/favicon.ico"></head></html>'
      ));

    const icon = await fetchMonitorIconUrl('http://192.168.1.100');
    expect(icon).toContain('apple-icon');
  });

  it('应解析绝对 URL 图标', async () => {
    mockFetch
      .mockResolvedValueOnce(mockHtmlResponse(
        '<html><head><link rel="icon" href="https://cdn.example.com/icon.png"></head></html>'
      ));

    const icon = await fetchMonitorIconUrl('http://192.168.1.100');
    expect(icon).toBe('https://cdn.example.com/icon.png');
  });

  it('应解析属性顺序不同的 link 标签', async () => {
    mockFetch
      .mockResolvedValueOnce(mockHtmlResponse(
        '<html><head><link href="/static/logo.svg" rel="icon"></head></html>'
      ));

    const icon = await fetchMonitorIconUrl('http://10.0.0.50');
    expect(icon).toBe('http://10.0.0.50/static/logo.svg');
  });

  it('HTML 无图标时应兜底到 /favicon.ico', async () => {
    mockFetch
      .mockResolvedValueOnce(mockHtmlResponse('<html><head><title>Test</title></head></html>'));

    const icon = await fetchMonitorIconUrl('http://192.168.1.1');
    expect(icon).toBe('http://192.168.1.1/favicon.ico');
  });

  it('页面请求失败时应兜底到 /favicon.ico', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const icon = await fetchMonitorIconUrl('http://192.168.1.100');
    expect(icon).toBe('http://192.168.1.100/favicon.ico');
  });

  it('网络异常时应返回 /favicon.ico', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Connection refused'));

    const icon = await fetchMonitorIconUrl('http://10.0.0.1');
    expect(icon).toBe('http://10.0.0.1/favicon.ico');
  });

  it('应处理 shortcut icon 格式', async () => {
    mockFetch
      .mockResolvedValueOnce(mockHtmlResponse(
        '<html><head><link rel="shortcut icon" href="/myicon.ico"></head></html>'
      ));

    const icon = await fetchMonitorIconUrl('http://192.168.1.1');
    expect(icon).toBe('http://192.168.1.1/myicon.ico');
  });
});
