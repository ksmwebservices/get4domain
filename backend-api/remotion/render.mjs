// Standalone Remotion render: bundles the Reel composition and renders it to MP4.
// Invoked by the backend reels module as a child process (keeps Remotion's heavy
// native deps — headless Chrome + FFmpeg — out of the main NestJS build).
//
// Usage: node render.mjs <propsJsonPath> <outputMp4Path>
//   propsJson: { "images": ["https://…","…"], "text": "…", "audioFile": "track.mp3"|null, "accent": "#0f766e" }
//   audioFile resolves via staticFile() against the tracks/ folder (the public dir below).
//
// Requires (on the VM): `npm install` in this folder, plus FFmpeg and the Chrome
// Headless Shell that @remotion/renderer downloads on first run.
//
// LICENSING: Remotion is free for individuals and companies with ≤3 people; larger
// companies need a paid Remotion Company License. Confirm KSM's license before use.
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const [propsPath, outputPath] = process.argv.slice(2);
  if (!propsPath || !outputPath) {
    console.error('usage: node render.mjs <propsJsonPath> <outputMp4Path>');
    process.exit(2);
  }
  const inputProps = JSON.parse(readFileSync(propsPath, 'utf8'));

  // publicDir = tracks/ so <Audio src={staticFile('name.mp3')} /> resolves the licensed tracks.
  const serveUrl = await bundle({
    entryPoint: path.join(__dirname, 'src', 'index.ts'),
    publicDir: path.join(__dirname, 'tracks'),
  });
  const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
  });
  console.log('RENDER_OK ' + outputPath);
}

main().catch((e) => {
  console.error('RENDER_FAILED', e?.message || e);
  process.exit(1);
});
