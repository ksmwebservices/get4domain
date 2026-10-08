const fs = require('fs'), path = require('path');
const dir = 'C:/Get4Domain/get4domain-site/backend-api/src/config/industries';
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.ts') && !['index.ts', 'types.ts'].includes(x))) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  const label = (s.match(/label:\s*'([^']+)'/) || [])[1];
  const i = s.indexOf('dashboardTabs');
  const block = i >= 0 ? s.slice(i, s.indexOf(']', i)) : '';
  const tabs = [...block.matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1]);
  const fields = (s.match(/fields:\s*\[/g) || []).length;
  const addons = [...s.matchAll(/addon[A-Za-z]*:\s*'([^']+)'/g)].map((m) => m[1]);
  console.log(f.replace('.ts', '').padEnd(13), '|', (label || '').padEnd(24), '|', tabs.join(', '), '|', s.split('\n').length, 'lines');
}
