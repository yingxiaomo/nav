const fs = require('fs');
let c = fs.readFileSync('D:/Github/nav/nav/server/public/admin/index.html', 'utf8');

// 1. Add monitor tab
c = c.replace("{id:'logs',label:'📋 日志'}", "{id:'logs',label:'📋 日志'},{id:'monitor',label:'📊 监控'}");

// 2. Add renderMonitor to cmds
c = c.replace(
  "cmds={overview:renderOverview,cats:renderCats,bms:renderBms,todos:renderTodos,notes:renderNotes,backup:renderBackup,logs:renderLogs};",
  "cmds={overview:renderOverview,cats:renderCats,bms:renderBms,todos:renderTodos,notes:renderNotes,backup:renderBackup,logs:renderLogs,monitor:renderMonitor};"
);

// 3. Insert renderMonitor before renderLogs
const logFunc = "// ====== 日志 ======";
const monitorFunc = `
// ====== 监控 ======
async function renderMonitor(){$('tabContent').innerHTML='<div class=spinner style=margin:20px auto></div>';
const[s,r]=await Promise.all([req('GET',API+'/admin/monitor/system'),req('GET',API+'/admin/monitor/checks')]);
const sys=s.data||{},ch=r.data||{};
const fm=t=>{if(!t||t===0)return'0B';const u=['B','KB','MB','GB','TB'],i=Math.floor(Math.log(t)/Math.log(1024));return(t/Math.pow(1024,i)).toFixed(1)+u[i]};
const ft=t=>{const d=Math.floor(t/86400),h=Math.floor((t%86400)/3600),m=Math.floor((t%3600)/60);return(d?d+'天':'')+h+'小时'+m+'分'};
const bar=p=>'<div style=background:#27272a;border-radius:4px;height:8px;overflow:hidden;flex:1><div style=width:'+Math.min(p,100)+'%;height:100%;background:'+(p>80?'#dc2626':p>50?'#fbbf24':'#4ade80')+';border-radius:4px;transition:width .5s></div></div>';
$('tabContent').innerHTML='<div style=display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px>'
+'<div class=backup-section style=margin:0><h3>💻 CPU</h3><div style=margin-top:8px><div style=display:flex;align-items:center;gap:12px><span style=font-size:24px;font-weight:700;color:#6366f1>'+(sys.cpu?.usage||0)+'%</span><span style=color:#a1a1aa;font-size:12px>'+(sys.cpu?.cores||'-')+' 核</span></div></div></div>'
+'<div class=backup-section style=margin:0><h3>🧠 内存</h3><div style=margin-top:8px><div style=display:flex;align-items:center;gap:12px><span style=font-size:24px;font-weight:700>'+(sys.memory?.usedPercent||0)+'%</span></div><div style=display:flex;align-items:center;gap:8px;margin-top:6px>'+bar(sys.memory?.usedPercent||0)+'<span style=font-size:11px;color:#a1a1aa;white-space:nowrap>'+fm(sys.memory?.used)+' / '+fm(sys.memory?.total)+'</span></div></div></div>'
+'<div class=backup-section style=margin:0><h3>💾 磁盘</h3><div style=margin-top:8px><div style=display:flex;align-items:center;gap:12px><span style=font-size:24px;font-weight:700>'+(sys.disk?.usedPercent||0)+'%</span></div><div style=display:flex;align-items:center;gap:8px;margin-top:6px>'+bar(sys.disk?.usedPercent||0)+'<span style=font-size:11px;color:#a1a1aa;white-space:nowrap>'+fm(sys.disk?.used)+' / '+fm(sys.disk?.total)+'</span></div></div></div>'
+'<div class=backup-section style=margin:0><h3>⏱ 运行时间</h3><div style=margin-top:8px><span style=font-size:20px;font-weight:600>'+ft(sys.uptime||0)+'</span></div></div></div>';
$('tabContent').innerHTML+='<div style=display:flex;justify-content:space-between;align-items:center;margin-bottom:8px><h3 style=font-size:14px>🔍 服务巡检</h3><button class="btn btn-primary btn-sm" onclick="showAddMonitor()">+ 添加</button></div>';
var results=ch.results||[];
if(results.length===0){$('tabContent').innerHTML+='<div class=empty-cell style=padding:16px>暂无巡检目标</div>';return;}
$('tabContent').innerHTML+='<table><thead><tr><th>名称</th><th>URL</th><th>状态</th><th>延迟</th></tr></thead><tbody>';
for(var i=0;i<results.length;i++){var r=results[i];
$('tabContent').innerHTML+='<tr><td>'+r.name+'</td><td class=url-cell><a href=\"'+r.url+'\" target=_blank style=color:#6366f1;font-size:12px>'+r.url+'</a></td><td>'+(r.status==='ok'?'<span style=color:#4ade80>● 正常</span>':'<span style=color:#f87171>○ 离线</span>')+'</td><td>'+(r.latency!==null?r.latency+'ms':'-')+'</td></tr>';}
$('tabContent').innerHTML+='</tbody></table>';}
`;

c = c.replace(logFunc, monitorFunc + '\n// ====== 日志 ======');

// 4. Add showAddMonitor function at the end
c += `
async function showAddMonitor(){var n=prompt('名称：');if(!n)return;var u=prompt('URL：');if(!u)return;var r=await req('POST',API+'/admin/monitor/checks',{name:n,url:u});if(r.ok)renderMonitor();else alert(r.data.error||'添加失败');}
`;

fs.writeFileSync('D:/Github/nav/nav/server/public/admin/index.html', c);
console.log('done');
