import fs from 'fs';
import path from 'path';
import { buildThemeSrcDoc, RawThemeFrame } from '@/engine/raw-theme-frame';

// TEMP local fidelity test: render the clinic-demo theme through the raw-theme iframe
// pipeline (parsed body + inlined css + theme js + bridge) to confirm it reproduces the
// source design. Not linked in nav; safe to delete after verification.
export const dynamic = 'force-dynamic';

function read(p: string): string {
  try { return fs.readFileSync(path.join(process.cwd(), 'public/theme-samples/clinic-demo', p), 'utf8'); }
  catch { return ''; }
}

export default function ThemeLocalTest() {
  const index = read('index.html');
  const css = read('css/styles.css');
  const js = read('js/main.js');
  const bodyM = index.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = bodyM ? bodyM[1] : index;
  const fonts = Array.from(index.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis[^"]+)"/g)).map((m) => m[1]);
  const srcDoc = buildThemeSrcDoc(
    { pages: [{ slug: 'home', title: 'Home', html: body }], css, js, fonts },
    { vendor: { businessName: 'Yogaanand Physiotherapy Clinic', subdomain: null }, cms: null },
    { subdomain: 'preview', rest: [], apiBase: 'https://gapi.get4domain.com' },
  );
  return <RawThemeFrame srcDoc={srcDoc} title="Clinic theme — local fidelity test" />;
}
