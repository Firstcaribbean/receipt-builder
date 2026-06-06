'use client';

import JsBarcode from 'jsbarcode';
import { CSSProperties, useEffect, useMemo } from 'react';
import { FormValues, ReceiptField, ReceiptLayout, getEditableFields } from '@/lib/types';

interface ReceiptPreviewProps {
  layout: ReceiptLayout;
  values: FormValues;
}

interface PreviewGroup {
  id: string;
  position: string;
  fields: ReceiptField[];
}

const GRID_TEMPLATE_AREAS = `
  "top-left top-center top-right"
  "left center right"
  "table table table"
  "bottom-left bottom-center bottom-right"
  "footer footer footer"
`;

export function ReceiptPreview({ layout, values }: ReceiptPreviewProps): JSX.Element {
  const fields = useMemo(() => getEditableFields(layout), [layout]);
  const groups = useMemo(() => groupFields(layout, fields), [layout, fields]);

  useEffect(() => {
    const svg = document.getElementById('barcode');
    const sourceValue = layout.barcode.sourceField ? values[layout.barcode.sourceField] : '';

    if (!svg || !layout.barcode.exists) return;
    svg.innerHTML = '';

    if (!sourceValue) return;

    JsBarcode(svg, `SAMPLE-${sourceValue}`, {
      format: 'CODE128',
      displayValue: false,
      height: 52,
      margin: 0,
      lineColor: layout.colors.text
    });
  }, [layout.barcode.exists, layout.barcode.sourceField, layout.colors.text, values]);

  const sheetStyle: CSSProperties = {
    backgroundColor: layout.colors.background,
    color: layout.colors.text,
    borderColor: layout.colors.border,
    fontFamily: layout.font.family
  };

  return (
    <article
      id="receipt-preview"
      className="relative mx-auto min-h-[1123px] w-[794px] overflow-hidden border bg-white p-10 shadow-receipt"
      style={sheetStyle}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] whitespace-nowrap text-[72px] font-black tracking-normal text-red-700/10">
        SAMPLE TEMPLATE
      </div>
      <div className="absolute right-[-58px] top-6 z-20 w-56 rotate-45 bg-red-700 py-2 text-center text-xs font-black uppercase tracking-widest text-white">
        Sample
      </div>

      <div className="relative z-10 flex min-h-[1038px] flex-col">
        <header className="mb-7 text-center">
          <h2 className="break-words font-black leading-tight tracking-normal" style={{ fontSize: layout.font.headerSize }}>
            {layout.title || 'Receipt Template'}
          </h2>
          {layout.layout ? <p className="mx-auto mt-2 max-w-xl text-xs opacity-60">{layout.layout}</p> : null}
        </header>

        <div
          className="grid flex-1 grid-cols-3 items-start gap-x-5 gap-y-5"
          style={{ gridTemplateAreas: GRID_TEMPLATE_AREAS, fontSize: layout.font.bodySize }}
        >
          {groups.map((group) => (
            <section
              key={group.id}
              className={sectionClass(group.position)}
              style={{ gridArea: areaFromPosition(group.position), borderColor: layout.colors.border }}
            >
              {group.fields.map((field) => renderField(field, values))}
            </section>
          ))}

          {layout.tables.length ? (
            <div className="grid gap-4" style={{ gridArea: 'table' }}>
              {layout.tables.map((table) => (
                <table key={table.id} className="w-full border-collapse text-left" style={{ borderColor: layout.colors.border }}>
                  <thead>
                    <tr>
                      {(table.columns.length ? table.columns : table.rowFields).map((column) => (
                        <th key={column} className="border px-3 py-2 font-black" style={{ borderColor: layout.colors.border }}>
                          {fieldLabel(column, fields)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {tableCellIds(table.columns, table.rowFields).map((fieldId, index) => (
                        <td key={`${table.id}-${fieldId}-${index}`} className="border px-3 py-2" style={{ borderColor: layout.colors.border }}>
                          {fieldId ? values[fieldId] || placeholderFor(fieldId, fields) : ''}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              ))}
            </div>
          ) : null}

          {layout.barcode.exists ? (
            <div className="grid justify-items-center gap-2" style={{ gridArea: areaFromPosition(layout.barcode.position || 'bottom-center') }}>
              <svg id="barcode" className="h-16 w-72 max-w-full" aria-label="Sample barcode" />
              <p className="max-w-72 break-words text-center text-[11px] opacity-70">
                {layout.barcode.sourceField ? values[layout.barcode.sourceField] || 'Barcode value' : 'Barcode value'}
              </p>
            </div>
          ) : null}

          {layout.footer.exists || layout.footer.text ? (
            <footer className="border-t pt-3 text-center text-xs opacity-75" style={{ gridArea: 'footer', borderColor: layout.colors.border }}>
              {layout.footer.text}
            </footer>
          ) : null}
        </div>

        <div className="mt-auto border-t pt-4 text-center text-[11px] font-black uppercase tracking-wider text-red-700" style={{ borderColor: layout.colors.border }}>
          Sample template only. Not a tax receipt, payment record, or reimbursement document.
        </div>
      </div>
    </article>
  );
}

function renderField(field: ReceiptField, values: FormValues): JSX.Element {
  if (field.type === 'image') {
    return (
      <div key={field.id} className="mb-3 inline-grid min-h-24 w-32 place-items-center overflow-hidden border bg-white/20 text-center text-xs font-bold">
        {values[field.id] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={values[field.id]} alt={field.label} className="h-full max-h-28 w-full object-contain" />
        ) : (
          field.label
        )}
      </div>
    );
  }

  return (
    <div key={field.id} className={`mb-2 grid gap-1 ${fieldStyleClass(field)} ${fieldSizeClass(field)}`}>
      <span className="font-bold opacity-70">{field.label}</span>
      <span className="min-h-5 break-words">{values[field.id] || placeholderFor(field.id, [field])}</span>
    </div>
  );
}

function groupFields(layout: ReceiptLayout, fields: ReceiptField[]): PreviewGroup[] {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const used = new Set<string>();
  const groups: PreviewGroup[] = [];

  layout.sections.forEach((section) => {
    const sectionFields = section.fields.map((fieldId) => fieldMap.get(fieldId)).filter(Boolean) as ReceiptField[];
    if (!sectionFields.length) return;

    sectionFields.forEach((field) => used.add(field.id));
    groups.push({ id: section.id, position: section.position, fields: sectionFields });
  });

  fields.forEach((field) => {
    if (used.has(field.id)) return;
    const key = `fallback-${field.position}`;
    const existing = groups.find((group) => group.id === key);

    if (existing) {
      existing.fields.push(field);
    } else {
      groups.push({ id: key, position: field.position, fields: [field] });
    }
  });

  return groups;
}

function tableCellIds(columns: string[], rowFields: string[]): string[] {
  const length = Math.max(columns.length, rowFields.length, 1);
  return Array.from({ length }, (_, index) => rowFields[index] ?? '');
}

function fieldLabel(value: string, fields: ReceiptField[]): string {
  return fields.find((field) => field.id === value)?.label ?? value;
}

function placeholderFor(fieldId: string, fields: ReceiptField[]): string {
  const field = fields.find((item) => item.id === fieldId);
  if (!field) return '';
  if (field.type === 'date') return 'YYYY-MM-DD';
  if (field.type === 'number') return '0.00';
  if (field.type === 'tel') return '000-000-0000';
  if (field.type === 'email') return 'name@example.com';
  return '';
}

function areaFromPosition(position: string): string {
  const normalized = position.toLowerCase().replace(/_/g, '-');
  if (normalized.includes('top') && normalized.includes('left')) return 'top-left';
  if (normalized.includes('top') && normalized.includes('right')) return 'top-right';
  if (normalized.includes('top') || normalized.includes('header')) return 'top-center';
  if (normalized.includes('bottom') && normalized.includes('left')) return 'bottom-left';
  if (normalized.includes('bottom') && normalized.includes('right')) return 'bottom-right';
  if (normalized.includes('bottom') || normalized.includes('barcode')) return 'bottom-center';
  if (normalized.includes('footer')) return 'footer';
  if (normalized.includes('table') || normalized.includes('middle')) return 'table';
  if (normalized.includes('right')) return 'right';
  if (normalized.includes('center')) return 'center';
  return 'left';
}

function sectionClass(position: string): string {
  const area = areaFromPosition(position);
  const alignment = area.includes('right') ? 'text-right' : area.includes('center') ? 'text-center' : 'text-left';
  return `min-h-12 ${alignment}`;
}

function fieldStyleClass(field: ReceiptField): string {
  if (field.style === 'bold') return 'font-black';
  if (field.style === 'italic') return 'italic';
  return 'font-normal';
}

function fieldSizeClass(field: ReceiptField): string {
  if (field.size === 'large') return 'text-lg';
  if (field.size === 'small') return 'text-xs';
  return 'text-sm';
}
