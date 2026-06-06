'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileRejection, useDropzone } from 'react-dropzone';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface UploadZoneProps {
  onAnalyze: (base64: string, mediaType: string) => Promise<void>;
}

export function UploadZone({ onAnalyze }: UploadZoneProps): JSX.Element {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [isReading, setIsReading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    setError('');

    if (rejectedFiles.length) {
      setFile(null);
      setError('Use a PNG, JPG, or PDF file under 10 MB.');
      return;
    }

    setFile(acceptedFiles[0] ?? null);
  }, []);

  const accept = useMemo(
    () => ({
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    }),
    []
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    noClick: true,
    onDrop
  });

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreviewUrl('');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  async function handleAnalyze(): Promise<void> {
    if (!file) {
      setError('Choose a template file first.');
      return;
    }

    setIsReading(true);
    setError('');

    try {
      const dataUrl = await fileToDataUrl(file);
      const base64 = dataUrl.split(',').pop() ?? '';
      await onAnalyze(base64, file.type);
    } catch (event) {
      setError(event instanceof Error ? event.message : 'Could not read that file.');
    } finally {
      setIsReading(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-receipt sm:p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-normal text-slate-950">Upload Template</h2>
          <p className="mt-2 text-sm text-slate-500">Upload a receipt image or PDF as a design template.</p>
        </div>

        <div
          {...getRootProps()}
          className={`grid min-h-[270px] place-items-center rounded-lg border-2 border-dashed p-6 text-center transition ${
            isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-blue-400'
          }`}
        >
          <input {...getInputProps()} />
          <div className="grid justify-items-center gap-3">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Selected template preview"
                className="h-28 w-40 rounded-lg border border-slate-200 bg-white object-contain"
              />
            ) : (
              <div className="grid h-24 w-20 place-items-center rounded-lg border border-slate-300 bg-white text-sm font-black text-slate-800">
                {file?.type === 'application/pdf' ? 'PDF' : 'FILE'}
              </div>
            )}
            <div>
              <p className="font-semibold text-slate-900">Drop PNG, JPG, or PDF here</p>
              <p className="mt-1 max-w-md break-words text-sm text-slate-500">{file ? file.name : 'No file selected'}</p>
            </div>
            <button
              type="button"
              onClick={open}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Browse File
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!file || isReading}
            onClick={handleAnalyze}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isReading ? 'Preparing File...' : 'Analyze Template'}
          </button>
        </div>
      </div>
    </section>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
