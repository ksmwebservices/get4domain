/**
 * Static route inventory. Parses every controller with the TypeScript compiler API (no app boot, no database) and classifies
 * each HTTP route from its decorators:
 *   public         @Public() on the class or the method (skips the global JwtAuthGuard)
 *   admin          @UseGuards(...AdminGuard | SuperAdminGuard...) on the class or the method
 *   authenticated  everything else (the global JwtAuthGuard applies; any logged-in principal gets in)
 * and records whether the handler reads the caller (@CurrentUser) and any @RequireModule / @Roles.
 * This is a review aid and a drift alarm, not proof of safety: it cannot see what a handler does with the principal.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export type RouteClass = 'public' | 'admin' | 'authenticated';

export interface RouteInfo {
  route: string;            // "GET /crm/leads/:id"
  controller: string;       // "src/crm/crm.controller.ts#CrmController"
  cls: RouteClass;
  readsPrincipal: boolean;  // some parameter uses @CurrentUser (or @Req) in this handler
  module?: string;          // @RequireModule('x')
  roles?: string;           // @Roles(...)
  ownerOnly?: boolean;      // @UseGuards(VendorOwnerGuard): a vendor's team member is refused (present only when true)
  adminGuard?: boolean;     // @UseGuards(AdminGuard): staff-role checked against auth/guards/admin-role-matrix.ts (present only when true)
  staffMatrix?: boolean;    // a parameter uses @RouteKey(): the handler asks STAFF_VENDOR_ACCESS_MATRIX (S7-B; present only when true)
}

const HTTP = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All']);
// Every guard in the codebase that restricts a route to Get4Domain staff (see `grep -rh "@UseGuards(" src`). Add a new staff guard here.
const ADMIN_GUARDS = new Set(['AdminGuard', 'SuperAdminGuard', 'CommercialAdminGuard', 'MoneyAdminGuard', 'LeadspaceStaffGuard']);

interface Deco { name: string; args: ts.Expression[] }

function decos(node: ts.Node): Deco[] {
  if (!ts.canHaveDecorators(node)) return [];
  return (ts.getDecorators(node) ?? []).flatMap((d): Deco[] => {
    const e = d.expression;
    if (ts.isCallExpression(e) && ts.isIdentifier(e.expression)) return [{ name: e.expression.text, args: [...e.arguments] }];
    if (ts.isIdentifier(e)) return [{ name: e.text, args: [] }];
    return [];
  });
}

const str = (e: ts.Expression | undefined): string | undefined => (e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) ? e.text : undefined);

function hasAdminGuard(ds: Deco[]): boolean {
  return ds.some((d) => d.name === 'UseGuards' && d.args.some((a) => ts.isIdentifier(a) && ADMIN_GUARDS.has(a.text)));
}

function hasGuard(ds: Deco[], name: string): boolean {
  return ds.some((d) => d.name === 'UseGuards' && d.args.some((a) => ts.isIdentifier(a) && a.text === name));
}

function join(...parts: (string | undefined)[]): string {
  const p = parts.filter((x): x is string => typeof x === 'string' && x.length > 0).map((x) => x.replace(/^\/+|\/+$/g, '')).filter(Boolean);
  return '/' + p.join('/');
}

export function controllerFiles(srcDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.controllers?\.ts$/.test(e.name)) out.push(full);
    }
  };
  walk(srcDir);
  return out.sort();
}

export function scanRoutes(srcDir: string): RouteInfo[] {
  const root = path.dirname(srcDir);
  const routes: RouteInfo[] = [];
  for (const file of controllerFiles(srcDir)) {
    const sf = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ES2021, true);
    const rel = path.relative(root, file).split(path.sep).join('/');
    sf.forEachChild((node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const classDecos = decos(node);
      const ctrl = classDecos.find((d) => d.name === 'Controller');
      if (!ctrl) return;
      const prefix = str(ctrl.args[0]);
      const classPublic = classDecos.some((d) => d.name === 'Public');
      const classAdmin = hasAdminGuard(classDecos);
      const classModule = str(classDecos.find((d) => d.name === 'RequireModule')?.args[0]);
      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const md = decos(member);
        const verb = md.find((d) => HTTP.has(d.name));
        if (!verb) continue;
        const sub = str(verb.args[0]);
        const isPublic = classPublic || md.some((d) => d.name === 'Public');
        const isAdmin = classAdmin || hasAdminGuard(md);
        const readsPrincipal = member.parameters.some((p) => decos(p).some((d) => d.name === 'CurrentUser' || d.name === 'Req'));
        const mod = str(md.find((d) => d.name === 'RequireModule')?.args[0]) ?? classModule;
        const rolesDeco = md.find((d) => d.name === 'Roles') ?? classDecos.find((d) => d.name === 'Roles');
        routes.push({
          route: `${verb.name.toUpperCase()} ${join(prefix, sub)}`,
          controller: `${rel}#${node.name.text}`,
          // A route that is both @Public and admin-guarded is a contradiction worth reviewing; "public" wins because the JWT guard is skipped.
          cls: isPublic ? 'public' : isAdmin ? 'admin' : 'authenticated',
          readsPrincipal,
          ...(mod ? { module: mod } : {}),
          ...(rolesDeco ? { roles: rolesDeco.args.map((a) => str(a) ?? a.getText()).join(',') } : {}),
          ...(hasGuard(classDecos, 'VendorOwnerGuard') || hasGuard(md, 'VendorOwnerGuard') ? { ownerOnly: true } : {}),
          ...(hasGuard(classDecos, 'AdminGuard') || hasGuard(md, 'AdminGuard') ? { adminGuard: true } : {}),
          ...(member.parameters.some((p) => decos(p).some((d) => d.name === 'RouteKey')) ? { staffMatrix: true } : {}),
        });
      }
    });
  }
  return routes.sort((a, b) => (a.route + a.controller).localeCompare(b.route + b.controller));
}

/** Paths whose first segment says "staff only". A route here that is not admin-guarded deserves a human decision. */
export const STAFF_PATH = /^\/(admin|admin-team|admin\/[^/]+)(\/|$)/;

export function violatesStaffPath(r: RouteInfo): boolean {
  const p = r.route.split(' ')[1];
  return STAFF_PATH.test(p) && r.cls !== 'admin';
}
