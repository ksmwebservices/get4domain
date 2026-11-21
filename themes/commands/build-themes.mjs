import { writeBuilt, checkBuilt, standardThemeIds } from '../lib/build-themes.mjs';

/** node themes/cli.mjs build-themes [--check]   Copies the shared sources into every Standard theme (writes themes/library/<id>/) or checks that the committed files match. */
export async function run({ flags }) {
  const ids = standardThemeIds();
  if (flags.check) {
    const diffs = await checkBuilt();
    if (diffs.length) { console.error(`The committed Standard themes differ from the sources (${diffs.length}):`); for (const d of diffs.slice(0, 30)) console.error(`  ${d}`); console.error('Run: node themes/cli.mjs build-themes'); return 1; }
    console.log(`Standard themes are current (${ids.length} theme(s): ${ids.join(', ') || 'none yet'})`);
    return 0;
  }
  const written = await writeBuilt();
  console.log(`built ${written.length} theme(s): ${written.join(', ') || 'none'}`);
  return 0;
}
