import { startPreview } from '../lib/preview.mjs';

/** node themes/cli.mjs preview [--port 4173]   Local review server on 127.0.0.1 only. Press Ctrl+C to stop. */
export async function run({ flags }) {
  const port = flags.port && flags.port !== true ? Number(flags.port) : 4173;
  if (!Number.isInteger(port) || port < 0 || port > 65535) { console.error('--port must be a number from 0 to 65535'); return 2; }
  const { url } = await startPreview({ port });
  console.log(`Theme preview running at ${url}  (this computer only; press Ctrl+C to stop)`);
  console.log(`  ${url}/coverage   ${url}/motion   ${url}/variants   ${url}/performance   ${url}/contrast`);
  await new Promise(() => {});
}
