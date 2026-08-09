import { type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
}

// Static classes so Tailwind's content scanner keeps them (no dynamic strings).
const alignClass: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

/** Borderless-row table with hover highlight, matching the v2.0 design tokens. */
export default function DataTable<T>({ columns, rows, rowKey, onRowClick, empty }: DataTableProps<T>) {
  if (rows.length === 0 && empty) {
    return <div>{empty}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-full border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 ${alignClass[col.align ?? 'left']} text-[11px] font-semibold uppercase tracking-wide text-slate-500`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`group border-b border-slate-100 ${
                onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''
              } transition-colors`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-sm text-slate-700 ${alignClass[col.align ?? 'left']} ${col.className ?? ''}`}
                >
                  {col.render ? col.render(row) : (row as Record<string, ReactNode>)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
