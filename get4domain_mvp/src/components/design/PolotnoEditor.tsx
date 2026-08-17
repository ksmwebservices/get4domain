'use client';

// In-app Polotno design editor. Browser-only — always loaded via next/dynamic with
// ssr:false. Production use requires a valid Polotno subscription; the publishable
// key comes from Admin → Integrations → Design Editor (GET /design/config).
import { useEffect, useMemo, useRef, useState } from 'react';
import { createStore } from 'polotno/model/store';
import { PolotnoContainer, SidePanelWrap, WorkspaceWrap } from 'polotno';
import { Toolbar } from 'polotno/toolbar/toolbar';
import { ZoomButtons } from 'polotno/toolbar/zoom-buttons';
import { SidePanel } from 'polotno/side-panel';
import { Workspace } from 'polotno/canvas/workspace';
import '@blueprintjs/core/lib/css/blueprint.css';

interface PolotnoEditorProps {
  apiKey: string;
  scene: Record<string, unknown>;
  prefill?: Record<string, string>;
  fileName?: string;
  onClose: () => void;
}

// Minimal shape of the bits of the Polotno store we touch (the SDK is untyped here).
interface StoreElement { name?: string; type?: string; set: (attrs: Record<string, unknown>) => void }
interface StorePage { children: StoreElement[] }
interface PolotnoStore {
  loadJSON: (json: unknown) => void;
  pages: StorePage[];
  toDataURL: (opts?: Record<string, unknown>) => Promise<string> | string;
  saveAsImage: (opts: Record<string, unknown>) => Promise<void>;
  saveAsPDF: (opts: Record<string, unknown>) => Promise<void>;
  waitLoading: () => Promise<void>;
}

export default function PolotnoEditor({ apiKey, scene, prefill, fileName = 'design', onClose }: PolotnoEditorProps) {
  const store = useMemo(() => createStore({ key: apiKey, showCredit: true }) as unknown as PolotnoStore, [apiKey]);
  const loadedRef = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    store.loadJSON(scene);
    // Prefill placeholder elements by name → vendor value.
    if (prefill) {
      for (const page of store.pages) {
        for (const el of page.children) {
          if (el.name && prefill[el.name] != null && el.type === 'text') {
            el.set({ text: prefill[el.name] });
          }
        }
      }
    }
  }, [store, scene, prefill]);

  const downloadPNG = async () => {
    setBusy(true);
    try { await store.saveAsImage({ fileName: `${fileName}.png` }); } finally { setBusy(false); }
  };
  const downloadPDF = async () => {
    setBusy(true);
    try { await store.saveAsPDF({ fileName: `${fileName}.pdf` }); } finally { setBusy(false); }
  };

  return (
    <div className="flex h-[80vh] flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-sm font-semibold text-slate-700">Design editor</span>
        <div className="flex items-center gap-2">
          <button onClick={downloadPNG} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Download PNG</button>
          <button onClick={downloadPDF} disabled={busy} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">Download PDF</button>
          <button onClick={onClose} className="rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700">Close</button>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <PolotnoContainer style={{ width: '100%', height: '100%' }}>
          <SidePanelWrap>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <SidePanel store={store as any} />
          </SidePanelWrap>
          <WorkspaceWrap>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Toolbar store={store as any} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Workspace store={store as any} />
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <ZoomButtons store={store as any} />
          </WorkspaceWrap>
        </PolotnoContainer>
      </div>
    </div>
  );
}
