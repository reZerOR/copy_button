import { mkdir, cp, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipBytes } from '../extension/lib/export.js';
import { readdir } from 'node:fs/promises';
const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'extension');
const original = JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8'));
async function entries(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await entries(path.join(directory, entry.name), relative + '/'));
    else result.push({ name: relative, data: await readFile(path.join(directory, entry.name)) });
  }
  return result;
}
for (const target of ['chromium', 'firefox', 'safari-source']) {
  const destination = path.join(root, 'dist', target);
  await mkdir(destination, { recursive: true }); await cp(source, destination, { recursive: true });
  const manifest = structuredClone(original);
  if (target !== 'chromium') {
    manifest.background = { scripts: ['lib/api.js', 'background.js'] };
    if (target === 'firefox') manifest.browser_specific_settings = { gecko: { id: 'button-copy@local.extension', strict_min_version: '128.0', data_collection_permissions: { required: ['none'] } } };
  }
  await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const files = await entries(destination);
  // zipBytes accepts bytes as well as text, so icons are stored losslessly.
  await writeFile(path.join(root, 'dist', `button-copy-${target}.zip`), zipBytes(files));
  console.log(`Built ${target}: ${files.length} files`);
}
