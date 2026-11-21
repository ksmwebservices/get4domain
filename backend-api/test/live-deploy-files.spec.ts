import * as fs from 'fs';
import * as path from 'path';

/** Job L: the V3 live deployment files keep their promises (read as text: no Docker is needed). */
const root = path.resolve(__dirname, '..');
const read = (f: string): string => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const dockerfile = read('Dockerfile.v3live');
const compose = read('docker-compose.v3live.yml');
const strip = (s: string): string => s.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');

describe('Dockerfile.v3live', () => {
  it('is multi-stage, generates the prisma client through the build, and copies only the build and production dependencies', () => {
    expect((dockerfile.match(/^FROM /gm) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(dockerfile).toContain('RUN npm run build');   // package.json: prisma generate && nest build && renderer
    expect(read('package.json')).toMatch(/"build": "prisma generate && nest build/);
    expect(dockerfile).toContain('npm ci --omit=dev');
    expect(dockerfile).toContain('node_modules/.prisma');
  });
  it('runs as a non-root user, with a health check and a clean stop', () => {
    expect(dockerfile).toMatch(/^USER nestjs$/m);
    expect(dockerfile.indexOf('USER nestjs')).toBeLessThan(dockerfile.indexOf('CMD ["node", "dist/src/main"]'));
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).toContain('/health');
    expect(dockerfile).toContain('tini');
  });
  it('marks the process as the live one (so the startup check applies) and bakes in no value, secret or real domain', () => {
    expect(dockerfile).toMatch(/^ENV V3_LIVE=true$/m);
    expect(dockerfile).toMatch(/^ENV NODE_ENV=production$/m);
    const code = strip(dockerfile);
    expect(code).not.toMatch(/(SECRET|PASSWORD|DATABASE_URL|DIRECT_URL|API_KEY|TOKEN)\s*=/i);
    expect(code).not.toMatch(/get4domain\.(com|in)/i);
  });
  it('the build context leaves out every env file except the example, and node_modules', () => {
    const ig = read('Dockerfile.v3live.dockerignore');
    expect(ig).toMatch(/^\.env$/m); expect(ig).toMatch(/^\.env\.\*$/m); expect(ig).toMatch(/^node_modules$/m);
  });
});

describe('docker-compose.v3live.yml', () => {
  const code = strip(compose);
  it('serves the API only, from the live Dockerfile, restarting, with an env_file that is not committed', () => {
    expect(code).toMatch(/^services:\n {2}api:$/m);
    expect((code.match(/^ {2}[a-z0-9_-]+:$/gm) ?? []).filter((l) => !['  api:'].includes(l) && l !== '  v3live_net:' && l !== '  public_uploads:' && l !== '  private_uploads:')).toEqual([]);
    expect(code).toContain('dockerfile: Dockerfile.v3live');
    expect(code).toContain('restart: unless-stopped');
    expect(code).toMatch(/env_file:\n\s+- \.env\.live/);
    const ignore = fs.readFileSync(path.resolve(root, '..', '.gitignore'), 'utf8');
    expect(ignore).toMatch(/^\.env\.live$/m);
    expect(fs.existsSync(path.join(root, '.env.live'))).toBe(false);
  });
  it('listens on 0.0.0.0 inside the container, publishes NO port to the host, and gives the container a fixed address on a private network for the host\'s nginx', () => {
    expect(code).toMatch(/HOST: "0\.0\.0\.0"/);
    expect(code).not.toMatch(/^\s+ports:/m);   // nothing is published to the host
    expect(code).toMatch(/expose:\n\s+- "3008"/);
    expect(code).toContain('ipv4_address: ${V3_API_IP:-');
    expect(code).toMatch(/ipam:\n\s+config:\n\s+- subnet: \$\{V3_API_SUBNET:-/);
    expect(code).not.toMatch(/driver: host|network_mode: ?host/);
    expect(read('src/main.ts')).toMatch(/app\.listen\(port, host\)/);
    expect(dockerfile).toMatch(/^ENV HOST=0\.0\.0\.0$/m);
  });
  it('keeps the health check (image) and the log rotation (compose)', () => { expect(dockerfile).toContain('HEALTHCHECK'); expect(code).toMatch(/max-size: "10m"/); expect(code).toMatch(/max-file: "5"/); });
  it('rotates its logs, drops privileges, and takes the domain as the variable V3_DOMAIN (required)', () => {
    expect(code).toMatch(/max-size: "10m"/); expect(code).toMatch(/max-file: "5"/);
    expect(code).toContain('no-new-privileges:true');
    expect(code).toContain('V3_DOMAIN: ${V3_DOMAIN:?');
    expect(code).toMatch(/V3_LIVE: "true"/);
  });
  it('holds no real value', () => { expect(code).not.toMatch(/get4domain\.(com|in)/i); expect(code).not.toMatch(/(SECRET|PASSWORD|KEY)\s*:\s*[^$\s]/i); });
});
