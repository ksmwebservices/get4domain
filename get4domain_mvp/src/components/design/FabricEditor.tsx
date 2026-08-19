'use client';

// In-app design editor built on Fabric.js (MIT, free, no key/subscription).
// Browser-only — always loaded via next/dynamic ssr:false.
//
// Two modes on the same canvas:
//  - admin  : add/position text & image objects, tag objects as data fields, Save
//             → returns the Fabric scene JSON + the derived field list.
//  - vendor : load a template, tagged fields prefill from profile/form data, drag/
//             edit freely, export PNG/PDF.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, Textbox, FabricImage, type FabricObject } from 'fabric';
import { jsPDF } from 'jspdf';
import { api } from '@/lib/api';

// Fabric objects carry our custom placeholder tags. Kept out of Fabric's types.
type Tagged = FabricObject & { fieldKey?: string; fieldLabel?: string };
const SERIALIZE_PROPS = ['fieldKey', 'fieldLabel'];

// Common data-field names admin can tag objects with.
const FIELD_SUGGESTIONS = ['business_name', 'person_name', 'designation', 'offer_text', 'phone', 'email', 'address', 'website', 'logo'];

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

export default function FabricEditor({ mode, width, height, scene, prefill, fileName = 'design', onSave, onClose }: FabricEditorProps) {
  const elRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<Canvas | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeTag, setActiveTag] = useState<string>(''); // selected object's fieldKey
  const [hasSelection, setHasSelection] = useState(false);

  // Scale the on-screen canvas to fit the dialog while keeping full-res coordinates.
  const dispScale = Math.min(1, 520 / width, 460 / height);

  useEffect(() => {
    if (!elRef.current || canvasRef.current) return;
    const canvas = new Canvas(elRef.current, { width, height, backgroundColor: '#ffffff', preserveObjectStacking: true });
    canvasRef.current = canvas;
    canvas.setDimensions({ width: width * dispScale, height: height * dispScale }, { cssOnly: true });

    const syncSelection = () => {
      const a = canvas.getActiveObject() as Tagged | undefined;
      setHasSelection(!!a);
      setActiveTag((a?.fieldKey as string) ?? '');
    };
    canvas.on('selection:created', syncSelection);
    canvas.on('selection:updated', syncSelection);
    canvas.on('selection:cleared', () => { setHasSelection(false); setActiveTag(''); });

    const init = async () => {
      if (scene) {
        await canvas.loadFromJSON(scene);
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

  const addText = () => {
    const c = canvasRef.current; if (!c) return;
    const t = new Textbox('New text', { left: width * 0.15, top: height * 0.15, width: Math.round(width * 0.5), fontSize: Math.round(height * 0.05), fill: '#111827', fontFamily: 'Arial' });
    c.add(t); c.setActiveObject(t); c.requestRenderAll();
  };

  const addImageFromUrl = async (url: string) => {
    const c = canvasRef.current; if (!c || !url) return;
    setBusy(true);
    try {
      const img = await FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
      const scale = Math.min((width * 0.4) / (img.width || 1), (height * 0.4) / (img.height || 1), 1);
      img.set({ left: width * 0.1, top: height * 0.1, scaleX: scale, scaleY: scale });
      c.add(img); c.setActiveObject(img); c.requestRenderAll();
    } catch { /* bad URL / CORS — ignore */ } finally { setBusy(false); }
  };

  const uploadImage = async (file: File) => {
    setBusy(true);
    try { const r = await api.uploadImage(file); if (r.data?.url) await addImageFromUrl(r.data.url); }
    catch { /* upload failed */ } finally { setBusy(false); }
  };

  const deleteSelected = () => {
    const c = canvasRef.current; if (!c) return;
    c.getActiveObjects().forEach((o) => c.remove(o));
    c.discardActiveObject(); c.requestRenderAll();
    setHasSelection(false); setActiveTag('');
  };

  const applyTag = (key: string) => {
    const c = canvasRef.current; if (!c) return;
    const a = c.getActiveObject() as Tagged | undefined; if (!a) return;
    if (key) a.set({ fieldKey: key, fieldLabel: key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) });
    else { a.set({ fieldKey: undefined, fieldLabel: undefined }); }
    setActiveTag(key);
  };

  const collectJson = useCallback(() => {
    const c = canvasRef.current; if (!c) return null;
    const editorJson = c.toObject(SERIALIZE_PROPS) as Record<string, unknown>;
    const seen = new Set<string>();
    const fields: EditorField[] = [];
    for (const obj of c.getObjects() as Tagged[]) {
      if (obj.fieldKey && !seen.has(obj.fieldKey)) {
        seen.add(obj.fieldKey);
        fields.push({ key: obj.fieldKey, label: (obj.fieldLabel as string) || obj.fieldKey });
      }
    }
    return { editorJson, fields };
  }, []);

  const save = () => {
    const data = collectJson(); if (!data || !onSave) return;
    onSave({ ...data, width, height });
  };

  const downloadPNG = () => {
    const c = canvasRef.current; if (!c) return;
    const url = c.toDataURL({ format: 'png', multiplier: 1 });
    const a = document.createElement('a'); a.href = url; a.download = `${fileName}.png`; a.click();
  };

  const downloadPDF = () => {
    const c = canvasRef.current; if (!c) return;
    const url = c.toDataURL({ format: 'png', multiplier: 1 });
    const pdf = new jsPDF({ orientation: width >= height ? 'landscape' : 'portrait', unit: 'px', format: [width, height] });
    pdf.addImage(url, 'PNG', 0, 0, width, height);
    pdf.save(`${fileName}.pdf`);
  };

  const btn = 'rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

  return (
    <div className="flex max-h-[82vh] flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-1 pb-3">
        {mode === 'admin' && (
          <>
            <button className={btn} onClick={addText}>+ Text</button>
            <label className={`${btn} cursor-pointer`}>+ Image
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }} />
            </label>
            <button className={btn} disabled={!hasSelection} onClick={deleteSelected}>Delete</button>
            <div className="mx-1 h-5 w-px bg-slate-200" />
            <span className="text-xs text-slate-500">Data field:</span>
            <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs disabled:opacity-50" disabled={!hasSelection} value={activeTag} onChange={(e) => applyTag(e.target.value)}>
              <option value="">— none —</option>
              {FIELD_SUGGESTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button className={btn} disabled={busy} onClick={downloadPNG}>PNG</button>
          <button className={btn} disabled={busy} onClick={downloadPDF}>PDF</button>
          {mode === 'admin' && onSave && <button className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700" onClick={save}>Save template</button>}
          <button className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700" onClick={onClose}>Close</button>
        </div>
      </div>

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
