import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { b3Error } from '../b3-settings/b3-errors';
import { KeyedQueue } from '../common/keyed-queue';
import { OtpPepper } from '../directory/pepper';
import { EntitlementsService } from '../plans/entitlements/entitlements.service';
import { addressHash, maskAddress } from '../requests-orders/core/messaging-core';
import { RequestsStore } from '../requests-orders/requests.store';
import { ActivityService } from '../v3-activity/activity.service';
import { TakedownPort } from '../v3-trust/trust.ports';
import { LifecycleStore } from '../vendor-lifecycle/lifecycle.store';
import { buildDocument, chooseSupply, decideDocumentKind, DocLineIn, docMessageText, financialYearKey, isStateCode, normaliseInvoicePrefix, stateCodeOfGstin, validateGstin } from './core/doc-core';
import { amountString, isPayCode, methodLabel, payCodeFrom } from './core/pay-core';
import { DocCodeTaken, DocumentRow, DocumentsStore, TaxProfileRow } from './documents.store';
import { MessageSenderPort, PdfPort } from './documents.ports';
import { PaymentsStore } from './payments.store';

const invalid = (msg: string): BadRequestException => new BadRequestException(b3Error('PAY_REQUEST_INVALID', msg));
const docNotFound = (): NotFoundException => new NotFoundException(b3Error('PAY_REQUEST_NOT_FOUND', 'That document does not exist.'));
const plain404 = (): NotFoundException => new NotFoundException('Not found');
const text = (v: unknown, min: number, max: number): string | null => { if (typeof v !== 'string') return null; const t = v.trim().replace(/\s+/g, ' '); return t.length >= min && t.length <= max ? t : null; };
const docQueue = new KeyedQueue();

/**
 * The vendor's receipts and invoices (slice 5.17d). One document per payment, made automatically once the vendor has marked it paid and safe to ask for again. The type follows the vendor's GST
 * setting; the number comes from a gap-free series; the document is sent by WhatsApp and e-mail as a public link through the message port (a fake in this build). A fault here NEVER undoes a
 * payment: the caller keeps the payment and the document can be made again.
 */
@Injectable()
export class DocumentsService {
  clock: () => Date = () => new Date();
  random: () => Uint8Array = () => randomBytes(24);

  constructor(
    private readonly store: DocumentsStore, private readonly payments: PaymentsStore, private readonly requests: RequestsStore, private readonly lifecycle: LifecycleStore, private readonly ents: EntitlementsService,
    private readonly sender: MessageSenderPort, private readonly pdf: PdfPort, private readonly pepper: OtpPepper, @Inject('PUBLIC_DOC_URL') private readonly docUrl: string,
    @Optional() private readonly activity?: ActivityService, @Optional() private readonly takedowns?: TakedownPort,
  ) {}

  private async record(vendorId: string, actionKey: string, id: string | null, summary: Record<string, unknown>, actorId: string | null = null): Promise<void> {
    await this.activity?.record({ vendorId, actor: actorId ? { type: 'VENDOR', id: actorId } : { type: 'SYSTEM', id: null }, actionKey, entityType: 'vendor_document', entityId: id, summary });
  }

  // ── the tax profile ──
  async getProfile(vendorId: string): Promise<TaxProfileRow> {
    return (await this.store.getProfile(vendorId)) ?? { vendorId, gstRegistered: false, gstin: null, stateCode: null, legalName: null, address: null, compositionScheme: false, invoicePrefix: 'INV' };
  }

  async saveProfile(vendorId: string, b: { gstRegistered?: unknown; gstin?: unknown; stateCode?: unknown; legalName?: unknown; address?: unknown; compositionScheme?: unknown; invoicePrefix?: unknown }, actorId: string | null): Promise<TaxProfileRow> {
    const cur = await this.getProfile(vendorId);
    const registered = b.gstRegistered === undefined ? cur.gstRegistered : b.gstRegistered === true;
    if (b.gstRegistered !== undefined && typeof b.gstRegistered !== 'boolean') throw invalid('gstRegistered: true or false');
    let gstin: string | null = b.gstin === undefined ? cur.gstin : null; let stateCode: string | null = b.stateCode === undefined ? cur.stateCode : null;
    if (b.gstin !== undefined && b.gstin !== null && b.gstin !== '') { const g = validateGstin(b.gstin); if (!g.ok) throw invalid('gstin: not a valid GSTIN'); gstin = g.gstin; }
    if (b.stateCode !== undefined && b.stateCode !== null && b.stateCode !== '') { if (!isStateCode(b.stateCode)) throw invalid('stateCode: not a valid state code'); stateCode = b.stateCode; }
    if (registered) { if (!gstin) throw invalid('gstin: required when registered for GST'); stateCode = stateCodeOfGstin(gstin); } else { gstin = null; }
    const legalName = b.legalName === undefined ? cur.legalName : (b.legalName === null || b.legalName === '' ? null : text(b.legalName, 2, 120));
    if (b.legalName !== undefined && b.legalName !== null && b.legalName !== '' && !legalName) throw invalid('legalName: 2 to 120 characters');
    const address = b.address === undefined ? cur.address : (b.address === null || b.address === '' ? null : text(b.address, 5, 300));
    if (b.address !== undefined && b.address !== null && b.address !== '' && !address) throw invalid('address: 5 to 300 characters');
    if (registered && (!legalName || !address)) throw invalid('legalName and address: required when registered for GST');
    const composition = registered ? (b.compositionScheme === undefined ? cur.compositionScheme : b.compositionScheme === true) : false;
    if (b.compositionScheme !== undefined && typeof b.compositionScheme !== 'boolean') throw invalid('compositionScheme: true or false');
    const invoicePrefix = b.invoicePrefix === undefined ? cur.invoicePrefix : normaliseInvoicePrefix(b.invoicePrefix);
    if (!invoicePrefix) throw invalid('invoicePrefix: up to 6 capital letters or digits');
    const saved = await this.store.saveProfile({ vendorId, gstRegistered: registered, gstin, stateCode, legalName, address, compositionScheme: composition, invoicePrefix });
    const changed = (['gstRegistered', 'gstin', 'stateCode', 'legalName', 'address', 'compositionScheme', 'invoicePrefix'] as const).filter((k) => saved[k] !== cur[k]);
    if (changed.length) await this.record(vendorId, 'tax_profile.updated', null, { changed }, actorId);   // field names only, never the values
    return saved;
  }

  // ── making a document ──
  /** Idempotent: a second call for the same payment returns the first document and sends nothing. A tax invoice that cannot be built exactly (no tax rate for a payment with no order) is NOT made: the payment stays and an activity row says why. */
  async createForPayment(vendorId: string, payRequestId: string): Promise<{ doc: DocumentRow | null; created: boolean; reason?: 'NEEDS_TAX_RATE' | 'NO_PAYMENT' }> {
    const pr = await this.payments.byId(payRequestId, vendorId); const payment = pr ? await this.payments.paymentOf(payRequestId, vendorId) : null;
    if (!pr || !payment) return { doc: null, created: false, reason: 'NO_PAYMENT' };
    const existing = await this.store.byPayment(payment.id, vendorId); if (existing) return { doc: existing, created: false };
    const profile = await this.getProfile(vendorId);
    const tier = (await this.ents.resolve(vendorId)).track?.toLowerCase() === 'professional' ? 'PROFESSIONAL' : 'OTHER';
    const kind = decideDocumentKind({ gstRegistered: profile.gstRegistered, composition: profile.compositionScheme, tier });
    let lines: DocLineIn[]; let customerState: string | null = null; let customerEmail: string | null = null;
    const order = pr.orderId ? await this.requests.getOrder(pr.orderId, vendorId) : null;
    if (order) {
      lines = order.items.map((i) => { const t = i.tax as { percent?: number; taxPaise?: number; discountPaise?: number }; return { name: i.name, qty: i.qty, taxablePaise: i.unitPaise * i.qty - (t.discountPaise ?? 0), taxPercent: t.percent ?? 0, taxPaise: t.taxPaise ?? 0 }; });
      const sc = (order.order.shipping as { stateCode?: unknown }).stateCode; customerState = isStateCode(sc) ? sc : null;
      customerEmail = (await this.requests.getRequest(order.order.requestId, vendorId))?.customerEmail ?? null;
    } else lines = [{ name: pr.note ?? 'Payment received', qty: 1, taxablePaise: payment.amountPaise, taxPercent: 0, taxPaise: 0 }];
    const supply = chooseSupply(profile.stateCode, customerState);
    let built = buildDocument({ kind, lines, supply, paidPaise: payment.amountPaise });
    if (!built && kind !== 'TAX_INVOICE') built = buildDocument({ kind, lines: [{ name: 'Payment received', qty: 1, taxablePaise: payment.amountPaise, taxPercent: 0, taxPaise: 0 }], supply, paidPaise: payment.amountPaise });
    if (!built || (kind === 'TAX_INVOICE' && !order)) { await this.record(vendorId, 'document.needs_tax_rate', null, { paymentId: payment.id }); return { doc: null, created: false, reason: 'NEEDS_TAX_RATE' }; }
    const vendor = await this.lifecycle.vendor(vendorId);
    const snapshot = { customerName: pr.customerName, stateCode: customerState, vendor: { businessName: vendor?.businessName ?? '', legalName: profile.legalName, address: profile.address, gstin: profile.gstin, stateCode: profile.stateCode } };
    const flags = { assumedIntraState: kind === 'TAX_INVOICE' && supply.assumed, paymentMethod: payment.method, vendorRecorded: payment.vendorRecorded };
    const tax = { taxablePaise: built.taxablePaise, taxPaise: built.taxPaise, cgstPaise: built.cgstPaise, sgstPaise: built.sgstPaise, igstPaise: built.igstPaise, supply: supply.type };
    let r: { doc: DocumentRow; created: boolean } | null = null;
    for (let i = 0; i < 3 && !r; i++) {
      try { r = await docQueue.run(`doc:${vendorId}`, () => this.store.createDocument({ vendorId, kind, prefix: profile.invoicePrefix, periodKey: financialYearKey(payment.confirmedAt), paymentId: payment.id, customerSnapshot: snapshot, items: built!.lines, tax, totalPaise: built!.totalPaise, publicCode: payCodeFrom(this.random()), flags })); }
      catch (e) { if (!(e instanceof DocCodeTaken)) throw e; }
    }
    if (!r) throw new ConflictException(b3Error('PAY_REQUEST_INVALID', 'Try again.'));
    if (!r.created) return { doc: r.doc, created: false };
    await this.record(vendorId, 'document.issued', r.doc.id, { kind, assumedIntraState: flags.assumedIntraState });
    let doc = r.doc;
    try { const p = await this.pdf.render({ vendorId, number: doc.number }); doc = (await this.store.setSend(doc.id, vendorId, { pdfRef: p.ref })) ?? doc; } catch { /* the document stands; the PDF can be asked for again */ }
    doc = await this.deliver(doc, { phone: pr.customerPhone, email: customerEmail }, vendor?.businessName ?? '');
    return { doc, created: true };
  }

  /** WhatsApp and e-mail with the public link. The text names the business, the kind, the number and the amount; nothing about the case, the file or the person beyond that. One outbox row per channel and attempt (idempotent). */
  private async deliver(doc: DocumentRow, to: { phone: string | null; email: string | null }, businessName: string): Promise<DocumentRow> {
    const link = `${this.docUrl}/${doc.publicCode}`; const msg = docMessageText({ businessName, kind: doc.kind, number: doc.number, amountText: amountString(doc.totalPaise) ?? '', link });
    const pepper = this.pepper.value(); const out: { whatsappStatus?: 'SENT_SANDBOX' | 'FAILED' | 'SKIPPED'; emailStatus?: 'SENT_SANDBOX' | 'FAILED' | 'SKIPPED' } = {};
    for (const [channel, address] of [['WHATSAPP', to.phone], ['EMAIL', to.email]] as const) {
      const field = channel === 'WHATSAPP' ? 'whatsappStatus' : 'emailStatus';
      if (!address) { out[field] = 'SKIPPED'; continue; }
      const key = `doc:${doc.id}:${channel}:${doc.resendCount}`;
      const row = await this.store.addOutbox({ vendorId: doc.vendorId, channel, templateKey: 'vendor_document_link', toHash: addressHash(channel, address, pepper), toMasked: maskAddress(channel, address), payload: { text: msg, number: doc.number }, idempotencyKey: key });
      if (!row.created) continue;   // already sent for this attempt
      const status = await this.sender.send({ channel, to: address, text: msg, idempotencyKey: key });
      await this.store.setOutboxStatus(row.id, status); out[field] = status;
    }
    return (await this.store.setSend(doc.id, doc.vendorId, out)) ?? doc;
  }

  // ── the owner's side ──
  async list(vendorId: string, skip: number, take: number) { const r = await this.store.list(vendorId, skip, take); return { items: r.items.map((d) => this.ownerView(d)), total: r.total }; }
  async get(vendorId: string, id: string) { const d = await this.store.byId(id, vendorId); if (!d) throw docNotFound(); return this.ownerView(d); }
  async download(vendorId: string, id: string) {
    const d = await this.store.byId(id, vendorId); if (!d) throw docNotFound();
    const p = await this.pdf.render({ vendorId, number: d.number }); if (d.pdfRef !== p.ref) await this.store.setSend(d.id, vendorId, { pdfRef: p.ref });
    return { number: d.number, pdfRef: p.ref, mode: p.mode, publicUrl: `${this.docUrl}/${d.publicCode}` };
  }
  /** Sends the link again (a new attempt number, so the idempotent outbox sends it). The contact comes from the payment request and its order. */
  async resend(vendorId: string, id: string, actorId: string | null) {
    const d = await this.store.byId(id, vendorId); if (!d) throw docNotFound();
    const pr = await this.payments.requestOfPayment(d.paymentId, vendorId); const vendor = await this.lifecycle.vendor(vendorId);
    let email: string | null = null; if (pr?.orderId) { const o = await this.requests.getOrder(pr.orderId, vendorId); email = o ? (await this.requests.getRequest(o.order.requestId, vendorId))?.customerEmail ?? null : null; }
    const bumped = (await this.store.setSend(id, vendorId, { bumpResend: true })) ?? d;
    const doc = await this.deliver(bumped, { phone: pr?.customerPhone ?? null, email }, vendor?.businessName ?? '');
    await this.record(vendorId, 'document.resent', id, {}, actorId);
    return this.ownerView(doc);
  }
  private ownerView(d: DocumentRow) {
    return { id: d.id, kind: d.kind, number: d.number, totalPaise: d.totalPaise, amountText: amountString(d.totalPaise), items: d.items, tax: d.tax, customerName: d.customerSnapshot.customerName ?? null, paymentMethod: methodLabel(typeof d.flags.paymentMethod === 'string' ? d.flags.paymentMethod : 'UPI'), flags: d.flags, whatsappStatus: d.whatsappStatus, emailStatus: d.emailStatus, resendCount: d.resendCount, publicUrl: `${this.docUrl}/${d.publicCode}`, createdAt: d.createdAt };
  }

  // ── the public document page ──
  /** What a customer needs to read their receipt: the business, the document, the lines and the totals. No phone number, no e-mail address. ONE plain 404 for anything that must reveal nothing. */
  async publicView(code: string) {
    if (!isPayCode(code)) throw plain404();
    const d = await this.store.byCode(code); if (!d) throw plain404();
    const vendor = await this.lifecycle.vendor(d.vendorId);
    if (!vendor || (await this.lifecycle.isRemoved(d.vendorId))) throw plain404();
    if (this.takedowns && (await this.takedowns.activeForVendor(d.vendorId))) throw plain404();
    const v = (d.customerSnapshot.vendor ?? {}) as { businessName?: string; legalName?: string | null; address?: string | null; gstin?: string | null };
    return { kind: d.kind, number: d.number, issuedAt: d.createdAt, business: { name: v.businessName ?? vendor.businessName, legalName: v.legalName ?? null, address: v.address ?? null, gstin: d.kind === 'TAX_INVOICE' || d.kind === 'BILL_OF_SUPPLY' ? v.gstin ?? null : null }, customerName: d.customerSnapshot.customerName ?? null, paymentMethod: methodLabel(typeof d.flags.paymentMethod === 'string' ? d.flags.paymentMethod : 'UPI'), items: d.items, tax: d.tax, totalPaise: d.totalPaise, amountText: amountString(d.totalPaise), assumedIntraState: d.flags.assumedIntraState === true };
  }
}
