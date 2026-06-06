'use client';

import { useState } from 'react';
import { DynamicForm } from '@/components/DynamicForm';
import { ExportButtons } from '@/components/ExportButtons';
import { ReceiptPreview } from '@/components/ReceiptPreview';
import { UploadZone } from '@/components/UploadZone';
import { FormValues, ReceiptLayout, getEditableFields } from '@/lib/types';

type BuilderStep = 'upload' | 'analyzing' | 'builder';

export default function Home(): JSX.Element {
  const [step, setStep] = useState<BuilderStep>('upload');
  const [layout, setLayout] = useState<ReceiptLayout | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({});
  const [error, setError] = useState('');

  async function handleAnalyze(base64: string, mediaType: string): Promise<void> {
    setStep('analyzing');
    setError('');

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, mediaType })
      });
      const data = (await res.json()) as { layout?: ReceiptLayout; error?: string };

      if (!res.ok || data.error || !data.layout) {
        throw new Error(data.error || 'Analysis failed.');
      }

      const defaults: FormValues = {};
      getEditableFields(data.layout).forEach((field) => {
        defaults[field.id] = '';
      });

      setLayout(data.layout);
      setFormValues(defaults);
      setStep('builder');
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Something went wrong.');
      setStep('upload');
    }
  }

  function resetBuilder(): void {
    setStep('upload');
    setLayout(null);
    setFormValues({});
    setError('');
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-navy-900 px-5 py-4 text-white shadow-lg sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-normal">Receipt Template Builder</h1>
            <p className="mt-1 text-sm text-slate-300">Server-side analysis with live sample previews.</p>
          </div>
          {step === 'builder' ? (
            <button
              type="button"
              onClick={resetBuilder}
              className="rounded-lg border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Upload New Template
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <div className="mx-auto mt-5 max-w-xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {step === 'upload' ? <UploadZone onAnalyze={handleAnalyze} /> : null}

      {step === 'analyzing' ? (
        <div className="flex min-h-[64vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="h-14 w-14 rounded-full border-4 border-blue-600 border-t-transparent motion-safe:animate-spin" />
          <div>
            <p className="text-lg font-semibold text-slate-800">Analyzing your receipt layout...</p>
            <p className="mt-1 text-sm text-slate-500">Detecting fields, tables, images, colors, and sections.</p>
          </div>
        </div>
      ) : null}

      {step === 'builder' && layout ? (
        <div className="mx-auto grid max-w-[1440px] gap-6 p-4 sm:p-6 lg:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-auto">
            <DynamicForm layout={layout} values={formValues} onChange={setFormValues} />
            <ExportButtons />
          </aside>
          <section className="min-w-0 overflow-auto rounded-lg border border-slate-200 bg-slate-100 p-4 shadow-sm sm:p-6">
            <ReceiptPreview layout={layout} values={formValues} />
          </section>
        </div>
      ) : null}
    </main>
  );
}
