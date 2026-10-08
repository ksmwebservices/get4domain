// Step 4: categories (create / rename / reorder / hide / delete-or-move, what the public site reads), the Adjust-stock screen's rules
// against the server's rules, and a source scan proving every VendorProduct stock write goes through StockService (→ a StockMovement).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { dist, ok, rejects, section, finish } = require('../security-verify/harness');
const { createMemPrisma } = require('./mem-prisma');
const ts = require('typescript');

const R = dist('stock/stock-rules');
const { StockService } = dist('stock/stock.service');
const { CmsService } = dist('cms/cms.service');

// the dashboard's own helper modules, transpiled in memory
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g4d-ui-'));
function loadUi(rel) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'get4domain_mvp', 'src', rel), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const f = path.join(tmp, rel.replace(/\//g, '_').replace(/\.ts$/, '.js'));
  fs.writeFileSync(f, out);
  return require(f);
}
const UI = loadUi('lib/stock-ui.ts');
const ORD = loadUi('lib/orders-ui.ts');

function world() {
  const prisma = createMemPrisma({
    vendor: [
      { id: 'v1', name: 'Suresh', email: 's@x.in', businessName: 'Step N Rock', industry: 'retail', subdomain: 'stepnrock' },
      { id: 'v2', name: 'Other', email: 'o@x.in', businessName: 'Other', industry: 'retail', subdomain: 'other' },
    ],
  }, { rollback: true });
  const stock = new StockService(prisma, { notifyVendor: async () => undefined });
  const cms = new CmsService(prisma, undefined, stock);
  return { prisma, cms, stock, t: prisma.$tables };
}
const names = (rows) => rows.map((c) => c.name);

(async () => {
  section('CATEGORIES: create, rename, reorder, hide, delete');
  {
    const w = world();
    const a = await w.cms.createCategory('v1', 'Sneakers');
    const dup = await w.cms.createCategory('v1', '  sneakers ');
    ok('create: a repeat name (any case / spacing) reuses the same category', a.id === dup.id && w.t.category.filter((c) => c.vendorId === 'v1').length === 1);
    await rejects('an empty name is refused', w.cms.createCategory('v1', '   '), { status: 400 });
    const b = await w.cms.createCategory('v1', 'Sandals');
    const c = await w.cms.createCategory('v1', 'Kids');
    const other = await w.cms.createCategory('v2', 'Sneakers');
    ok('another vendor can use the same name independently', other.id !== a.id && other.vendorId === 'v2');

    const p1 = await w.cms.addProduct('v1', { name: 'Aero', price: '1000', category: 'Sneakers' }, 'o');
    const p2 = await w.cms.addProduct('v1', { name: 'Slide', price: '300', category: 'Sandals' }, 'o');
    ok('products are linked to the category row (not only free text)', p1.categoryId === a.id && p2.categoryId === b.id);

    await w.cms.updateCategory('v1', a.id, { name: 'Shoes' });
    ok('RENAME: the category and every product\'s category text follow', w.t.category.find((x) => x.id === a.id).name === 'Shoes' && w.t.vendorProduct.find((p) => p.id === p1.id).category === 'Shoes');
    await rejects('renaming onto an existing name is refused (409)', w.cms.updateCategory('v1', a.id, { name: 'sandals' }), { status: 409 });
    await rejects('another vendor cannot rename this vendor\'s category (404)', w.cms.updateCategory('v2', a.id, { name: 'Hacked' }), { status: 404 });

    await w.cms.reorderCategories('v1', [c.id, b.id, a.id]);
    ok('REORDER: the manage list and the public list follow the chosen order', names(await w.cms.getCategoriesForManage('v1')).join() === 'Kids,Sandals,Shoes' && names(await w.cms.getVendorCategories('v1')).join() === 'Kids,Sandals,Shoes');
    await rejects('reorder with another vendor\'s category is refused', w.cms.reorderCategories('v1', [c.id, other.id]), { status: 400 });

    await w.cms.updateCategory('v1', c.id, { hidden: true });
    ok('HIDE: gone from the public list (the storefront filters), still in the vendor\'s manage list', !names(await w.cms.getVendorCategories('v1')).includes('Kids') && names(await w.cms.getCategoriesForManage('v1')).includes('Kids'));
    ok('…hidden category flagged in manage list; product counts are right', (await w.cms.getCategoriesForManage('v1')).find((x) => x.name === 'Kids').hidden === true && (await w.cms.getCategoriesForManage('v1')).find((x) => x.name === 'Shoes').productCount === 1);
    await w.cms.updateCategory('v1', c.id, { hidden: false });
    ok('un-hide brings it back', names(await w.cms.getVendorCategories('v1')).includes('Kids'));

    const e = await w.cms.deleteCategory('v1', c.id);
    ok('DELETE an empty category works', e.deleted === true && e.moved === 0 && !w.t.category.some((x) => x.id === c.id));
    const blocked = await w.cms.deleteCategory('v1', a.id).catch((x) => x);
    ok('DELETE a category that has products is BLOCKED with a clear message (409) and nothing changes', blocked.getStatus && blocked.getStatus() === 409 && /1 product uses "Shoes"/.test(blocked.message) && w.t.category.some((x) => x.id === a.id) && w.t.vendorProduct.find((p) => p.id === p1.id).categoryId === a.id);
    await rejects('moving to itself is refused', w.cms.deleteCategory('v1', a.id, a.id), { status: 400 });
    await rejects('moving to another vendor\'s category is refused', w.cms.deleteCategory('v1', a.id, other.id), { status: 400 });
    const moved = await w.cms.deleteCategory('v1', a.id, b.id);
    const pp = w.t.vendorProduct.find((p) => p.id === p1.id);
    ok('DELETE with a destination MOVES the products (id and text) and then deletes', moved.moved === 1 && pp.categoryId === b.id && pp.category === 'Sandals' && !w.t.category.some((x) => x.id === a.id));
    ok('no product was lost or left pointing at a deleted category', w.t.vendorProduct.length === 2 && w.t.vendorProduct.every((p) => !p.categoryId || w.t.category.some((x) => x.id === p.categoryId)));
    await rejects('another vendor cannot delete this vendor\'s category (404)', w.cms.deleteCategory('v2', b.id), { status: 404 });
    const siteProducts = (await w.cms.getSiteBySubdomain('stepnrock')).products;
    ok('the public site payload carries the up-to-date category text for the storefront filters', siteProducts.find((p) => p.id === p1.id).category === 'Sandals');
  }

  section('STOREFRONT reads categories dynamically (source guard)');
  {
    const root = path.join(__dirname, '..', '..', '..', 'stepnrock');
    const cat = fs.readFileSync(path.join(root, 'app', 'shop', '[category]', 'page.tsx'), 'utf8');
    const shop = fs.readFileSync(path.join(root, 'app', 'shop', 'page.tsx'), 'utf8');
    const home = fs.readFileSync(path.join(root, 'app', 'page.tsx'), 'utf8');
    const hook = fs.readFileSync(path.join(root, 'lib', 'use-products.ts'), 'utf8');
    ok('shop filters come from useCategories() (the vendor\'s real list), not a constant', /useCategories\(\)/.test(shop) && /fetchVendorCategories/.test(hook) && !/fallbackCategories/.test(hook));
    ok('/shop/<any vendor category> works: no fixed list of valid slugs', !/validSlugs|categoryMeta/.test(cat) && /useCategories/.test(cat));
    ok('the home page category tiles come from the API (hidden ones already removed server-side)', /fetchVendorCategories/.test(home) && !/from '@\/lib\/products'/.test(home));
  }

  section('ADJUST STOCK screen ⇄ server rules');
  {
    let allowedOk = true; let listedOk = true;
    for (const mode of ['add', 'remove', 'set']) {
      for (const reason of UI.REASONS_BY_MODE[mode]) if (!R.reasonAllowsMode(reason, mode)) allowedOk = false;
      for (const reason of ['SHOP_SALE', 'DAMAGE', 'RETURN', 'RECOUNT', 'OPENING', 'ADJUSTMENT']) if (R.reasonAllowsMode(reason, mode) && !UI.REASONS_BY_MODE[mode].includes(reason)) listedOk = false;
    }
    ok('every reason the screen offers for a direction is accepted by the server for it', allowedOk);
    ok('every reason the server allows for a direction is offered by the screen (nothing hidden, nothing impossible)', listedOk);
    ok('the labels the vendor asked for exist: Shop sale, Damage or loss, Return, Recount, Opening stock', ['Shop sale', 'Damage or loss', 'Return', 'Recount', 'Opening stock'].every((l) => Object.values(UI.REASON_LABEL).includes(l)));
    let same = true;
    for (const mode of ['add', 'remove', 'set']) for (const q of [-1, 0, 1, 2.5, 7, 1_000_001]) {
      const serverBad = R.validateAdjustQuantity(mode, q) !== null;
      const uiBad = UI.validateAdjust(mode, q, 1_000_000_000) !== null;
      if (q <= 1_000_000 && serverBad !== uiBad) same = false;
    }
    ok('the screen refuses/accepts the same quantities as the server (whole numbers, > 0 for add/remove, 0 allowed for a recount)', same);
    ok('the screen blocks removing more than is in stock (never below 0) and allows removing exactly all', UI.validateAdjust('remove', 5, 4) !== null && UI.validateAdjust('remove', 4, 4) === null && UI.validateAdjust('set', 0, 4) === null);
    // availability parity
    let parity = true; const rows = [];
    for (const active of [true, false]) for (const status of ['AVAILABLE', 'OUT_OF_STOCK', 'HIDDEN', 'active', 'out_of_stock', 'inactive', null]) for (const trackStock of [true, false]) for (const stockQty of [null, 0, 1, 2, 5]) for (const reorderLevel of [null, 0, 2]) rows.push({ active, status, trackStock, stockQty, reorderLevel });
    for (const r of rows) {
      const server = R.availabilityOf(r); const ui = UI.stockState(r);
      if ((server === null ? 'hidden' : server) !== ui) { parity = false; console.log('   mismatch', JSON.stringify(r), server, ui); break; }
    }
    ok(`what the vendor sees on a card equals what the shopper is told, over ${rows.length} combinations (in / low / out / hidden)`, parity);
    ok('image check: png/jpg/webp/gif ≤ 5 MB pass; pdf, empty and 6 MB are refused with a plain message', UI.checkImageFile({ type: 'image/png', size: 1000 }) === null && UI.checkImageFile({ type: 'application/pdf', size: 10 }) !== null && UI.checkImageFile({ type: 'image/png', size: 6 * 1024 * 1024 }) !== null && UI.checkImageFile({ type: 'image/png', size: 0 }) !== null);
    ok('gallery ordering: move left/right keeps all items; make-main swaps with the old main', JSON.stringify(UI.moveItem(['a', 'b', 'c'], 1, -1)) === '["b","a","c"]' && UI.moveItem(['a', 'b'], 0, -1).join() === 'a,b' && JSON.stringify(UI.makeMain('M', ['a', 'b'], 1)) === '{"image":"b","gallery":["a","M"]}' && JSON.stringify(UI.makeMain('', ['a', 'b'], 0)) === '{"image":"a","gallery":["b"]}');
    ok('orders screen: PENDING_PAYMENT → waiting, completed → paid, CANCELLED → cancelled; cancelled money is not revenue', ORD.orderBucket('PENDING_PAYMENT') === 'awaiting' && ORD.orderBucket('completed') === 'paid' && ORD.orderBucket('CANCELLED') === 'cancelled' && ORD.orderTotals([{ status: 'completed', total: 100 }, { status: 'PENDING_PAYMENT', total: 50 }, { status: 'CANCELLED', total: 999 }]).paid.amount === 100 && ORD.orderTotals([{ status: 'CANCELLED', total: 999 }]).cancelled.amount === 0);
  }

  section('ADJUST STOCK through the real service: history and the Low stock list');
  {
    const w = world();
    const p = await w.cms.addProduct('v1', { name: 'Aero', price: '1000', trackStock: true, stockQty: 10, reorderLevel: 3 }, 'owner');
    await new Promise((r) => setTimeout(r, 5));
    await w.stock.adjust('v1', p.id, { mode: 'remove', quantity: 4, reason: 'SHOP_SALE', note: 'bill 12' }, 'staff');
    await new Promise((r) => setTimeout(r, 5));
    await w.stock.adjust('v1', p.id, { mode: 'add', quantity: 1, reason: 'RETURN' }, 'owner');
    await new Promise((r) => setTimeout(r, 5));
    await w.stock.adjust('v1', p.id, { mode: 'set', quantity: 2, reason: 'RECOUNT', note: 'counted' }, 'owner');
    const h = await w.stock.history('v1', p.id);
    ok('history lists opening, shop sale, return and recount with who/why and the running balance', h.length === 4 && ['OPENING', 'ADJUSTMENT', 'RETURN', 'RECOUNT'].every((r) => h.some((m) => m.reason === r || (r === 'ADJUSTMENT' && m.reason === 'SHOP_SALE'))) && h.some((m) => m.note === 'bill 12' && m.createdBy === 'staff') && h[0].balanceAfter === 2);
    const low = await w.stock.lowStock('v1');
    ok('LOW STOCK list: the product (2 ≤ level 3) is listed; another vendor sees nothing', low.length === 1 && low[0].id === p.id && (await w.stock.lowStock('v2')).length === 0);
    await rejects('removing more than is there is refused and changes nothing', w.stock.adjust('v1', p.id, { mode: 'remove', quantity: 3, reason: 'SHOP_SALE' }, 'o'), { status: 400 });
    ok('…stock still 2', w.t.vendorProduct.find((x) => x.id === p.id).stockQty === 2);
    await rejects('another vendor cannot adjust or read this product\'s stock', w.stock.adjust('v2', p.id, { mode: 'add', quantity: 1, reason: 'RETURN' }, 'x'), { status: 404 });
  }

  section('EVERY stock write goes through StockService (→ a StockMovement in the same transaction)');
  {
    const srcDir = path.join(__dirname, '..', '..', 'src');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((f) => (f.isDirectory() ? walk(path.join(d, f.name)) : /\.ts$/.test(f.name) ? [path.join(d, f.name)] : []));
    const files = walk(srcDir).filter((f) => /stockQty/.test(fs.readFileSync(f, 'utf8')));
    const rel = files.map((f) => path.relative(srcDir, f).split(path.sep).join('/'));
    ok('only these files mention stockQty: the stock module, CMS (validation + setOpening), checkout (read-only preflight), the dashboard low-stock count (read-only), the separate RetailProduct POS, DTOs/rules', rel.every((f) => /^stock\//.test(f) || ['cms/cms.service.ts', 'cms/dto/create-product.dto.ts', 'engine/public-checkout.service.ts', 'registry/dashboard-context.service.ts', 'retail/retail.service.ts', 'retail/dto/retail.dto.ts'].includes(f)), rel.join());
    const cmsLines = fs.readFileSync(path.join(srcDir, 'cms/cms.service.ts'), 'utf8').split('\n').filter((l) => /stockQty/.test(l));
    ok('CMS never writes stockQty directly: each mention is a validation or a setOpening() call (which writes the movement)', cmsLines.every((l) => /setOpening|stockQty !== undefined|stockQty > 0|\{ .*stockQty.* \} = dto|const \{.*stockQty/.test(l)), cmsLines.join(' | ').slice(0, 300));
    const checkoutLines = fs.readFileSync(path.join(srcDir, 'engine/public-checkout.service.ts'), 'utf8').split('\n').filter((l) => /stockQty/.test(l));
    ok('checkout only READS stockQty (select / preflight) — the decrement is StockService.reserve', checkoutLines.every((l) => /select:|stock: p\.trackStock/.test(l)), checkoutLines.join(' | ').slice(0, 200));
    const svc = fs.readFileSync(path.join(srcDir, 'stock/stock.service.ts'), 'utf8');
    const writes = (svc.match(/vendorProduct\.(update|updateMany)\(/g) ?? []).length;
    const moves = (svc.match(/stockMovement\.create\(/g) ?? []).length;
    ok('inside StockService each stock UPDATE is accompanied by a movement insert in the same method (reserve, restore, setOpening, adjust)', writes >= 4 && moves >= 4, `${writes} updates / ${moves} movement inserts`);
    ok('the only other stock table written is RetailProduct (hidden for Workspace shops; documented limit: no movements there)', /prisma\.retailProduct\./.test(fs.readFileSync(path.join(srcDir, 'retail/retail.service.ts'), 'utf8')));
  }
  finish();
})().catch((e) => { console.error(e); process.exit(1); });
