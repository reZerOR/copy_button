import { readFile, readdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
let checks = 0;
for (const target of ['extension', 'dist/chromium', 'dist/firefox', 'dist/safari-source']) {
  const dir = path.join(root, target), manifest = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
  for (const file of [manifest.action.default_popup, ...Object.values(manifest.icons), ...(manifest.background.scripts || [manifest.background.service_worker])]) { await access(path.join(dir, file)); checks++; }
  if (manifest.host_permissions || manifest.content_scripts) throw new Error('Unexpected persistent automatic page access');
  const walk = async folder => {
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (file.endsWith('.js')) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status) throw new Error(result.stderr); checks++; }
    }
  };
  await walk(dir);
}
console.log(`Passed ${checks} manifest, resource, and JavaScript syntax checks.`);
