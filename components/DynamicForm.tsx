'use client';

import { useMemo } from 'react';
import { FormValues, ReceiptField, ReceiptLayout, getEditableFields } from '@/lib/types';

interface DynamicFormProps {
  layout: ReceiptLayout;
  values: FormValues;
  onChange: (values: FormValues) => void;
}

interface FieldGroup {
  id: string;
  position: string;
  fields: ReceiptField[];
}

export function DynamicForm({ layout, values, onChange }: DynamicFormProps): JSX.Element {
  const fields = useMemo(() => getEditableFields(layout), [layout]);
  const groups = useMemo(() => groupFields(layout, fields), [fields, layout]);

  function updateValue(id: string, value: string): void {
    onChange({ ...values, [id]: value });
  }

  async function updateImage(id: string, file: File | null): Promise<void> {
    if (!file) {
      updateValue(id, '');
      return;
    }

    updateValue(id, await fileToDataUrl(file));
  }

  return (
    <form className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-base font-bold text-slate-950">Input Form</h2>
        <p className="mt-1 text-sm text-slate-500">{fields.length} editable fields detected.</p>
      </div>

      <div className="grid gap-3 p-4">
        {groups.length ? (
          groups.map((group) => (
            <details key={group.id} open className="rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-700">
                {formatPosition(group.position)}
              </summary>
              <div className="grid gap-4 border-t border-slate-100 p-4">
                {group.fields.map((field) => (
                  <label key={field.id} htmlFor={`field-${field.id}`} className="grid gap-2 text-sm font-semibold text-slate-800">
                    <span>{field.label}</span>
                    {field.type === 'image' ? (
                      <ImageInput field={field} value={values[field.id] ?? ''} onChange={updateImage} />
                    ) : (
                      <input
                        id={`field-${field.id}`}
                        type={field.type}
                        inputMode={field.type === 'number' ? 'decimal' : undefined}
                        value={values[field.id] ?? ''}
                        onChange={(event) => updateValue(field.id, event.target.value)}
                        className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        placeholder={field.label}
                      />
                    )}
                  </label>
                ))}
              </div>
            </details>
          ))
        ) : (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No editable fields were detected.</p>
        )}
      </div>
    </form>
  );
}

interface ImageInputProps {
  field: ReceiptField;
  value: string;
  onChange: (id: string, file: File | null) => Promise<void>;
}

function ImageInput({ field, value, onChange }: ImageInputProps): JSX.Element {
  return (
    <div className="grid gap-3">
      <input
        id={`field-${field.id}`}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => onChange(field.id, event.target.files?.[0] ?? null)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
      />
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt={`${field.label} preview`}
          className="h-20 w-20 rounded-lg border border-slate-200 bg-slate-50 object-contain"
        />
      ) : null}
    </div>
  );
}

function groupFields(layout: ReceiptLayout, fields: ReceiptField[]): FieldGroup[] {
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const used = new Set<string>();
  const groups: FieldGroup[] = [];

  layout.sections.forEach((section) => {
    const sectionFields = section.fields.map((fieldId) => fieldMap.get(fieldId)).filter(Boolean) as ReceiptField[];

    if (sectionFields.length) {
      sectionFields.forEach((field) => used.add(field.id));
      groups.push({
        id: section.id,
        position: section.position,
        fields: sectionFields
      });
    }
  });

  fields.forEach((field) => {
    if (used.has(field.id)) return;
    const existing = groups.find((group) => group.id === `fallback-${field.position}`);

    if (existing) {
      existing.fields.push(field);
    } else {
      groups.push({
        id: `fallback-${field.position}`,
        position: field.position,
        fields: [field]
      });
    }
  });

  return groups;
}

function formatPosition(position: string): string {
  return (
    position
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) || 'Fields'
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.readAsDataURL(file);
  });
}
