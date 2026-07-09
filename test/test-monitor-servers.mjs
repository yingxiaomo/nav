/**
 * 本地监控测试服务（带 favicon）
 * 启动 3 个模拟 HTTP 服务用于测试后端健康巡检和图标识别:
 *   - 正常服务   http://localhost:9001（HTML + favicon）
 *   - 慢速服务   http://localhost:9002（延迟 3 秒响应）
 *   - 故障服务   http://localhost:9003（返回 500）
 *
 * 使用方式: node scripts/test-monitor-servers.mjs
 * 测试完后 Ctrl+C 停止
 */
import http from 'node:http';

/** 内联 SVG favicon 生成器 */
function svgFavicon(color, symbol) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="12" fill="${color}"/>
    <text x="32" y="44" font-size="36" text-anchor="middle" fill="white">${symbol}</text>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** HTML 页面模板（包含 favicon link） */
function htmlPage(title, color, symbol, extra = '') {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <link rel="icon" type="image/svg+xml" href="${svgFavicon(color, symbol)}">
  <link rel="shortcut icon" href="${svgFavicon(color, symbol)}">
  <style>
    body { font-family: system-ui; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0;
           background: #f5f5f5; color: #333; }
    .card { text-align: center; padding: 2rem; background: white;
            border-radius: 16px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    .dot { display: inline-block; width: 12px; height: 12px;
           border-radius: 50%; margin-right: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 48px; margin-bottom: 8px;">${symbol === '✓' ? '✅' : symbol === '⏳' ? '⏳' : '❌'}</div>
    <h2><span class="dot" style="background:${color}"></span>${title}</h2>
    <p style="color:#666">这是一个模拟的${title}页面，用于测试图标识别</p>
    ${extra}
  </div>
</body>
</html>`;
}

const servers = [
  { port: 9001, name: '正常服务', handler: (req, res) => {
    const html = htmlPage('正常服务', '#22c55e', '✓');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }},
  { port: 9002, name: '慢速服务', handler: (req, res) => {
    setTimeout(() => {
      const html = htmlPage('慢速服务', '#f59e0b', '⏳', '<p style="color:#999;font-size:12px">响应延迟 3 秒</p>');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    }, 3000);
  }},
  { port: 9003, name: '故障服务', handler: (req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Server Error');
  }},
];

for (const s of servers) {
  const server = http.createServer(s.handler);
  server.listen(s.port, () => {
    console.log(`✅ ${s.name} → http://localhost:${s.port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ ${s.name} 端口 ${s.port} 被占用，尝试强制重启`);
    } else {
      console.error(`❌ ${s.name} 启动失败:`, err.message);
    }
  });
}

console.log('\n=== 测试服务已启动（带 favicon）===');
console.log('在管理后台添加以下目标测试巡检:');
console.log('  正常: http://localhost:9001');
console.log('  慢速: http://localhost:9002');
console.log('  故障: http://localhost:9003');
console.log('\n按 Ctrl+C 停止所有测试服务\n');
