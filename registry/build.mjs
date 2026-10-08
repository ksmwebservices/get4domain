#!/usr/bin/env node
// Writes the generated registry files into get4domain_mvp and backend-api.   node registry/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRegistry, generatedFiles } from './lib.mjs';

const reg = await loadRegistry();
const files = generatedFiles(reg);
for (const [rel, text] of Object.entries(files)) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  console.log(`wrote ${rel}`);
}
