import { PrismaService } from '../prisma/prisma.service';
import { PackConfig } from './pack.types';

/** The pack as the public page needs it: the starter content (sample quotes and prices) stays on the server. */
export function publicPackConfig(c: PackConfig): PackConfig {
  const { seed: _seed, ...rest } = c;
  void _seed;
  return rest as PackConfig;
}

/**
 * Which pack describes a vendor's site: the one the site was generated from, else the pack whose key or keywords match the vendor's industry.
 * Used by the public site endpoint (so the renderer knows the section order, wording and layouts) and by generation.
 */
export async function resolvePack(prisma: PrismaService, packKey: string | null | undefined, industry: string | null | undefined): Promise<{ key: string; name: string; config: PackConfig } | null> {
  const ind = (industry ?? '').trim().toLowerCase();
  if (packKey) {
    const p = await prisma.categoryPack.findUnique({ where: { key: packKey } });
    if (p && p.enabled) return { key: p.key, name: p.name, config: publicPackConfig(p.config as unknown as PackConfig) };
  }
  if (!ind) return null;
  const all = await prisma.categoryPack.findMany({ where: { enabled: true } });
  const hit = all.find((p) => p.key === ind) ?? all.find((p) => ((p.config as unknown as PackConfig).keywords ?? []).some((k) => k.toLowerCase() === ind));
  return hit ? { key: hit.key, name: hit.name, config: publicPackConfig(hit.config as unknown as PackConfig) } : null;
}
