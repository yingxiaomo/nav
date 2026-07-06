/**
 * Docker API 本地测试
 * 用于验证系统状态浮窗的 Docker 容器数据接口是否正常。
 *
 * 使用方式：
 *   node test/docker-monitor.mjs [baseUrl]
 *
 * 示例：
 *   node test/docker-monitor.mjs http://192.168.0.100:8642
 *   node test/docker-monitor.mjs http://localhost:3000
 */

const baseUrl = process.argv[2] || 'http://localhost:8642';
const endpoints = [
  { name: '系统状态', path: '/api/v1/admin/monitor/system' },
  { name: '服务巡检', path: '/api/v1/admin/monitor/checks' },
  { name: 'Docker 容器', path: '/api/v1/admin/docker/containers' },
];

async function test() {
  console.log(`\n🔍 Nav Docker 监控接口测试 — ${baseUrl}\n`);
  let passed = 0;
  let failed = 0;

  for (const ep of endpoints) {
    const url = `${baseUrl}${ep.path}`;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const body = await res.json();
      if (res.ok) {
        console.log(`  ✅ ${ep.name} (${res.status})`);
        if (body.error) {
          console.log(`     ⚠️  返回错误: ${body.error}`);
        }
        if (body.cpu) console.log(`     CPU: ${body.cpu.usage}% | 内存: ${body.memory?.usedPercent}% | 磁盘: ${body.disk?.usedPercent}%`);
        if (body.results) console.log(`     巡检目标: ${body.results.length} 个`);
        if (body.containers) {
          const running = body.containers.filter(c => c.state === 'running').length;
          console.log(`     Docker 容器: ${body.containers.length} 个（${running} 运行中）`);
          if (body.containers.length > 0 && body.containers.length <= 10) {
            for (const c of body.containers) {
              const status = c.state === 'running' ? '🟢' : '🔴';
              console.log(`       ${status} ${c.name.padEnd(20)} ${c.status}`);
            }
          }
        }
        passed++;
      } else {
        console.log(`  ❌ ${ep.name} (${res.status}): ${body.error || '未知错误'}`);
        failed++;
      }
    } catch (err) {
      console.log(`  💥 ${ep.name}: 请求失败 — ${err.message}`);
      failed++;
    }
  }

  console.log(`\n📊 结果: ${passed} 通过, ${failed} 失败\n`);
  process.exit(failed > 0 ? 1 : 0);
}

test();
