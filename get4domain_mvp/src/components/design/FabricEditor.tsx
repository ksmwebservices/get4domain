'use client';

// In-app design editor built on Fabric.js (MIT, free, no key/subscription).
// Browser-only — always loaded via next/dynamic ssr:false.
//
// Two modes on the same canvas:
//  - admin  : add/position text, image & icon objects, tag objects as data fields,
//             Save → returns the Fabric scene JSON + the derived field list.
//  - vendor : load a template, tagged fields prefill from profile/form data, drag/
//             edit freely, export PNG/PDF.
// Object-editing controls (fonts, colours, stroke, alignment, icons, image, canvas
// background) are available in BOTH modes; only data-field tagging is admin-only.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, Textbox, FabricImage, Group, loadSVGFromString, util, type FabricObject } from 'fabric';
import { jsPDF } from 'jspdf';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Phone, Mail, MapPin, Globe, Clock, Calendar, Send, MessageCircle, Smartphone,
  Instagram, Facebook, Twitter, Linkedin, Youtube,
  ShoppingCart, ShoppingBag, Tag, Gift, Percent, CreditCard, Truck, Package,
  Star, Heart, Sparkles, Award, BadgeCheck, Crown, Flame, Zap, ThumbsUp, CheckCircle, Check,
  Utensils, Coffee, Car, Plane, Home as HomeIcon, Building2, Camera, Scissors, Dumbbell,
  Stethoscope, GraduationCap, Wrench, Leaf, Music, Palette as PaletteIcon,
  ArrowRight, Circle, Square, Triangle,
  type LucideIcon,
} from 'lucide-react';
import { api } from '@/lib/api';

// Fabric objects carry our custom placeholder tags. Kept out of Fabric's types.
type Tagged = FabricObject & { fieldKey?: string; fieldLabel?: string; fontWeight?: string; fontStyle?: string; fontFamily?: string; fontSize?: number; textAlign?: string; text?: string };
const SERIALIZE_PROPS = ['fieldKey', 'fieldLabel'];

const FIELD_SUGGESTIONS = ['business_name', 'person_name', 'designation', 'offer_text', 'phone', 'email', 'address', 'website', 'logo'];
const FONTS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'Comic Sans MS'];
const PALETTE = ['#111827', '#ffffff', '#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#6366f1', '#ec4899'];

// Text style presets — just font-size(%)/weight/colour combos applied on insert.
type PresetKey = 'heading' | 'subheading' | 'body' | 'cta';
const TEXT_PRESETS: Record<PresetKey, { label: string; sizePct: number; weight: string; fill: string }> = {
  heading: { label: 'Heading', sizePct: 0.075, weight: 'bold', fill: '#111827' },
  subheading: { label: 'Subheading', sizePct: 0.05, weight: '600', fill: '#374151' },
  body: { label: 'Body', sizePct: 0.032, weight: 'normal', fill: '#374151' },
  cta: { label: 'CTA', sizePct: 0.042, weight: 'bold', fill: '#d97706' },
};

const ICONS: { name: string; Icon: LucideIcon }[] = [
  { name: 'phone', Icon: Phone }, { name: 'mail email', Icon: Mail }, { name: 'map pin location', Icon: MapPin },
  { name: 'globe web', Icon: Globe }, { name: 'clock time', Icon: Clock }, { name: 'calendar date', Icon: Calendar },
  { name: 'send', Icon: Send }, { name: 'message chat', Icon: MessageCircle }, { name: 'smartphone mobile', Icon: Smartphone },
  { name: 'instagram', Icon: Instagram }, { name: 'facebook', Icon: Facebook }, { name: 'twitter x', Icon: Twitter },
  { name: 'linkedin', Icon: Linkedin }, { name: 'youtube', Icon: Youtube },
  { name: 'cart', Icon: ShoppingCart }, { name: 'bag shopping', Icon: ShoppingBag }, { name: 'tag price', Icon: Tag },
  { name: 'gift', Icon: Gift }, { name: 'percent discount offer', Icon: Percent }, { name: 'card payment', Icon: CreditCard },
  { name: 'truck delivery', Icon: Truck }, { name: 'package box', Icon: Package },
  { name: 'star', Icon: Star }, { name: 'heart love', Icon: Heart }, { name: 'sparkles', Icon: Sparkles },
  { name: 'award', Icon: Award }, { name: 'badge check verified', Icon: BadgeCheck }, { name: 'crown premium', Icon: Crown },
  { name: 'flame hot fire', Icon: Flame }, { name: 'zap flash', Icon: Zap }, { name: 'thumbs up like', Icon: ThumbsUp },
  { name: 'check circle', Icon: CheckCircle }, { name: 'check tick', Icon: Check },
  { name: 'utensils food restaurant', Icon: Utensils }, { name: 'coffee cafe', Icon: Coffee }, { name: 'car', Icon: Car },
  { name: 'plane travel flight', Icon: Plane }, { name: 'home house', Icon: HomeIcon }, { name: 'building office', Icon: Building2 },
  { name: 'camera photo', Icon: Camera }, { name: 'scissors salon', Icon: Scissors }, { name: 'dumbbell gym fitness', Icon: Dumbbell },
  { name: 'stethoscope clinic health', Icon: Stethoscope }, { name: 'graduation education', Icon: GraduationCap },
  { name: 'wrench tools', Icon: Wrench }, { name: 'leaf nature eco', Icon: Leaf }, { name: 'music', Icon: Music },
  { name: 'palette art', Icon: PaletteIcon },
  { name: 'arrow right', Icon: ArrowRight }, { name: 'circle', Icon: Circle }, { name: 'square', Icon: Square }, { name: 'triangle', Icon: Triangle },
];

export interface EditorField { key: string; label: string }

interface FabricEditorProps {
  mode: 'admin' | 'vendor';
  width: number;
  height: number;
  scene?: Record<string, unknown> | null;
  prefill?: Record<string, string>;
  fileName?: string;
  onSave?: (data: { editorJson: Record<string, unknown>; fields: EditorField[]; width: number; height: number }) => void;
  onClose: () => void;
}

interface SelState {
  isText: boolean;
  isGroup: boolean;
  fill: string; stroke: string; strokeWidth: number;
  fontFamily: string; fontSize: number; bold: boolean; italic: boolean; textAlign: string;
}

export default function FabricEditor({ mode, width, height, scene, prefill, fileName = 'design', onSave, onClose }: FabricEditorProps) {
  const elRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imgErr, setImgErr] = useState('');
  const [activeTag, setActiveTag] = useState('');
  const [sel, setSel] = useState<SelState | null>(null);
  const [bg, setBg] = useState('#ffffff');
  const [preset, setPreset] = useState<PresetKey>('body');
  const [iconOpen, setIconOpen] = useState(false);
  const [iconQuery, setIconQuery] = useState('');

  const dispScale = Math.min(1, 560 / width, 460 / height);

  const readActive = useCallback(() => {
    const c = canvasRef.current; const a = c?.getActiveObject() as Tagged | undefined;
    if (!a) { setSel(null); setActiveTag(''); return; }
    setActiveTag((a.fieldKey as string) ?? '');
    const isText = a.type === 'Textbox' || a.type === 'IText' || a.type === 'Text' || 'text' in a;
    setSel({
      isText,
      isGroup: a.type === 'Group',
      fill: typeof a.fill === 'string' ? a.fill : '#111827',
      stroke: typeof a.stroke === 'string' ? a.stroke : '#000000',
      strokeWidth: (a.strokeWidth as number) ?? 0,
      fontFamily: a.fontFamily ?? 'Arial',
      fontSize: Math.round(a.fontSize ?? 40),
      bold: a.fontWeight === 'bold' || a.fontWeight === '700',
      italic: a.fontStyle === 'italic',
      textAlign: a.textAlign ?? 'left',
    });
  }, []);

  useEffect(() => {
    if (!elRef.current || canvasRef.current) return;
    const canvas = new Canvas(elRef.current, { width, height, backgroundColor: '#ffffff', preserveObjectStacking: true });
    canvasRef.current = canvas;
    canvas.setDimensions({ width: width * dispScale, height: height * dispScale }, { cssOnly: true });

    canvas.on('selection:created', readActive);
    canvas.on('selection:updated', readActive);
    canvas.on('selection:cleared', () => { setSel(null); setActiveTag(''); });
    canvas.on('object:modified', readActive);

    const init = async () => {
      if (scene) {
        await canvas.loadFromJSON(scene);
        const sceneBg = (scene as { background?: string }).background;
        if (typeof sceneBg === 'string') setBg(sceneBg);
        if (mode === 'vendor' && prefill) {
          for (const obj of canvas.getObjects() as Tagged[]) {
            const key = obj.fieldKey;
            if (key && prefill[key] != null && prefill[key] !== '' && 'text' in obj) {
              (obj as unknown as Textbox).set({ text: prefill[key] });
            }
          }
        }
        canvas.requestRenderAll();
      }
      setReady(true);
    };
    void init();

    return () => { canvas.dispose(); canvasRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Object mutation helpers ────────────────────────────────────────────────
  const getActive = () => canvasRef.current?.getActiveObject() as Tagged | undefined;
  const applyProps = (props: Record<string, unknown>, cascadeToGroup = false) => {
    const c = canvasRef.current; const a = getActive(); if (!c || !a) return;
    if (cascadeToGroup && a.type === 'Group' && a instanceof Group) a.getObjects().forEach((o) => o.set(props));
    else a.set(props);
    c.requestRenderAll(); readActive();
  };
  // Recolour: text/shape → fill; icon (group of strokes) → stroke on children.
  const recolor = (color: string) => {
    const a = getActive(); if (!a) return;
    if (a.type === 'Group') applyProps({ stroke: color }, true);
    else applyProps({ fill: color });
  };

  // ── Add tools ──────────────────────────────────────────────────────────────
  const addText = () => {
    const c = canvasRef.current; if (!c) return;
    const p = TEXT_PRESETS[preset];
    const t = new Textbox(p.label, { left: width * 0.12, top: height * 0.12, width: Math.round(width * 0.6), fontSize: Math.round(height * p.sizePct), fontWeight: p.weight, fill: p.fill, fontFamily: 'Arial' });
    c.add(t); c.setActiveObject(t); c.requestRenderAll(); readActive();
  };

  const addImageFromUrl = async (url: string) => {
    const c = canvasRef.current; if (!c || !url) return;
    // crossOrigin lets the cross-origin (API-hosted) image export without tainting
    // the canvas — the backend reflects CORS (origin:true) so this is allowed.
    const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
    const scale = Math.min((width * 0.4) / (img.width || 1), (height * 0.4) / (img.height || 1), 1);
    img.set({ left: width * 0.1, top: height * 0.1, scaleX: scale, scaleY: scale });
    c.add(img); c.setActiveObject(img); c.requestRenderAll(); readActive();
  };

  const uploadImage = async (file: File) => {
    setBusy(true); setImgErr('');
    try {
      const r = await api.uploadImage(file);
      if (r.data?.url) await addImageFromUrl(r.data.url);
      else setImgErr('Upload returned no URL.');
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : 'Image upload failed.');
    } finally { setBusy(false); }
  };

  const addIcon = async (Icon: LucideIcon) => {
    const c = canvasRef.current; if (!c) return;
    setBusy(true);
    try {
      const svg = renderToStaticMarkup(<Icon color="#111827" size={64} strokeWidth={2} absoluteStrokeWidth />);
      const { objects } = await loadSVGFromString(svg);
      const valid = (objects ?? []).filter(Boolean) as FabricObject[];
      if (!valid.length) return;
      const obj = valid.length > 1 ? util.groupSVGElements(valid) : valid[0];
      const target = Math.min(width, height) * 0.15;
      const s = target / (obj.width || 64);
      obj.set({ left: width * 0.12, top: height * 0.12, scaleX: s, scaleY: s });
      c.add(obj); c.setActiveObject(obj); c.requestRenderAll(); readActive();
      setIconOpen(false); setIconQuery('');
    } finally { setBusy(false); }
  };

  const deleteSelected = () => {
    const c = canvasRef.current; if (!c) return;
    c.getActiveObjects().forEach((o) => c.remove(o));
    c.discardActiveObject(); c.requestRenderAll(); setSel(null); setActiveTag('');
  };

  // ── Alignment ──────────────────────────────────────────────────────────────
  const centerH = () => { const c = canvasRef.current; const a = getActive(); if (!c || !a) return; c.centerObjectH(a); a.setCoords(); c.requestRenderAll(); };
  const centerV = () => { const c = canvasRef.current; const a = getActive(); if (!c || !a) return; c.centerObjectV(a); a.setCoords(); c.requestRenderAll(); };

  // ── Canvas background ──────────────────────────────────────────────────────
  const setBackground = (color: string) => { const c = canvasRef.current; if (!c) return; c.set('backgroundColor', color); c.requestRenderAll(); setBg(color); };

  // ── Data-field tagging (admin only) ────────────────────────────────────────
  const applyTag = (key: string) => {
    const a = getActive(); if (!a) return;
    if (key) a.set({ fieldKey: key, fieldLabel: key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) });
    else a.set({ fieldKey: undefined, fieldLabel: undefined });
    setActiveTag(key);
  };

  // ── Save / export ──────────────────────────────────────────────────────────
  const save = () => {
    const c = canvasRef.current; if (!c || !onSave) return;
    const editorJson = c.toObject(SERIALIZE_PROPS) as Record<string, unknown>;
    const seen = new Set<string>(); const fields: EditorField[] = [];
    for (const obj of c.getObjects() as Tagged[]) {
      if (obj.fieldKey && !seen.has(obj.fieldKey)) { seen.add(obj.fieldKey); fields.push({ key: obj.fieldKey, label: (obj.fieldLabel as string) || obj.fieldKey }); }
    }
    onSave({ editorJson, fields, width, height });
  };
  const downloadPNG = () => { const c = canvasRef.current; if (!c) return; const a = document.createElement('a'); a.href = c.toDataURL({ format: 'png', multiplier: 1 }); a.download = `${fileName}.png`; a.click(); };
  const downloadPDF = () => {
    const c = canvasRef.current; if (!c) return;
    const pdf = new jsPDF({ orientation: width >= height ? 'landscape' : 'portrait', unit: 'px', format: [width, height] });
    pdf.addImage(c.toDataURL({ format: 'png', multiplier: 1 }), 'PNG', 0, 0, width, height); pdf.save(`${fileName}.pdf`);
  };

  const btn = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
  const chip = 'rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50';
  const iconResults = ICONS.filter((i) => i.name.includes(iconQuery.trim().toLowerCase())).slice(0, 60);

  return (
    <div className="relative flex max-h-[84vh] flex-col">
      {/* Toolbar — add tools + canvas bg + export/save */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-1 pb-2">
        <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" value={preset} onChange={(e) => setPreset(e.target.value as PresetKey)} title="Text style for new text">
          {Object.entries(TEXT_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button className={btn} onClick={addText}>+ Text</button>
        <label className={`${btn} cursor-pointer`}>+ Image
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
        </label>
        <button className={btn} onClick={() => setIconOpen((v) => !v)}>+ Icon</button>
        <button className={btn} disabled={!sel} onClick={deleteSelected}>Delete</button>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <label className="flex items-center gap-1.5 text-xs text-slate-500">Background
          <input type="color" value={bg} onChange={(e) => setBackground(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-slate-200" />
        </label>
        {busy && <span className="text-xs text-slate-400">Working…</span>}
        <div className="ml-auto flex items-center gap-2">
          <button className={btn} onClick={downloadPNG}>PNG</button>
          <button className={btn} onClick={downloadPDF}>PDF</button>
          {mode === 'admin' && onSave && <button className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700" onClick={save}>Save template</button>}
          <button className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700" onClick={onClose}>Close</button>
        </div>
      </div>
      {imgErr && <p className="px-1 pt-1 text-xs text-error-600">{imgErr}</p>}

      {/* Properties panel — shown when an object is selected */}
      {sel && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-1 py-2">
          {sel.isText && (
            <>
              <select className="rounded-md border border-slate-200 px-2 py-1 text-xs" value={sel.fontFamily} onChange={(e) => applyProps({ fontFamily: e.target.value })}>
                {FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
              </select>
              <input type="number" min={6} max={400} value={sel.fontSize} onChange={(e) => applyProps({ fontSize: Number(e.target.value) || sel.fontSize })} className="w-16 rounded-md border border-slate-200 px-2 py-1 text-xs" title="Font size" />
              <button className={`${chip} ${sel.bold ? 'bg-slate-200 font-bold' : ''}`} onClick={() => applyProps({ fontWeight: sel.bold ? 'normal' : 'bold' })} title="Bold"><b>B</b></button>
              <button className={`${chip} ${sel.italic ? 'bg-slate-200' : ''}`} onClick={() => applyProps({ fontStyle: sel.italic ? 'normal' : 'italic' })} title="Italic"><i>I</i></button>
              <div className="mx-0.5 h-5 w-px bg-slate-200" />
              <button className={chip} onClick={() => applyProps({ textAlign: 'left' })} title="Align left">⯇</button>
              <button className={chip} onClick={() => applyProps({ textAlign: 'center' })} title="Align center">≡</button>
              <button className={chip} onClick={() => applyProps({ textAlign: 'right' })} title="Align right">⯈</button>
              <div className="mx-0.5 h-5 w-px bg-slate-200" />
            </>
          )}
          <span className="text-xs text-slate-500">Colour</span>
          {PALETTE.map((c) => (
            <button key={c} onClick={() => recolor(c)} className="h-5 w-5 rounded-full border border-slate-300" style={{ background: c }} title={c} />
          ))}
          <input type="color" value={sel.fill} onChange={(e) => recolor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-slate-200" title="Custom colour" />
          <div className="mx-0.5 h-5 w-px bg-slate-200" />
          <label className="flex items-center gap-1 text-xs text-slate-500">Stroke
            <input type="color" value={sel.stroke} onChange={(e) => applyProps({ stroke: e.target.value }, true)} className="h-6 w-8 cursor-pointer rounded border border-slate-200" />
          </label>
          <input type="number" min={0} max={40} value={sel.strokeWidth} onChange={(e) => applyProps({ strokeWidth: Number(e.target.value) || 0 }, true)} className="w-14 rounded-md border border-slate-200 px-2 py-1 text-xs" title="Stroke width" />
          <div className="mx-0.5 h-5 w-px bg-slate-200" />
          <button className={chip} onClick={centerH} title="Centre horizontally">⊹ H</button>
          <button className={chip} onClick={centerV} title="Centre vertically">⊹ V</button>
          {mode === 'admin' && (
            <>
              <div className="mx-0.5 h-5 w-px bg-slate-200" />
              <span className="text-xs text-slate-500">Data field</span>
              <select className="rounded-md border border-slate-200 px-2 py-1 text-xs" value={activeTag} onChange={(e) => applyTag(e.target.value)}>
                <option value="">— none —</option>
                {FIELD_SUGGESTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </>
          )}
        </div>
      )}

      {/* Icon picker popover */}
      {iconOpen && (
        <div className="absolute left-1 top-12 z-20 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <input autoFocus placeholder="Search icons…" value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-primary-400 focus:outline-none" />
          <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
            {iconResults.map(({ name, Icon }) => (
              <button key={name} onClick={() => addIcon(Icon)} title={name.split(' ')[0]} className="flex h-9 items-center justify-center rounded-lg text-slate-600 hover:bg-primary-50 hover:text-primary-600">
                <Icon className="h-4 w-4" />
              </button>
            ))}
            {iconResults.length === 0 && <p className="col-span-6 py-4 text-center text-xs text-slate-400">No icons match “{iconQuery}”.</p>}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
        <div className="shadow-lg" style={{ width: width * dispScale, height: height * dispScale }}>
          <canvas ref={elRef} />
        </div>
      </div>
      {!ready && <p className="py-2 text-center text-xs text-slate-400">Loading editor…</p>}
      {mode === 'admin' && <p className="px-1 pt-2 text-xs text-slate-400">Tip: select an object and tag it as a data field (e.g. business_name) so it prefills for vendors.</p>}
    </div>
  );
}
