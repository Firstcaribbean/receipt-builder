'use client';

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useState } from 'react';
import { useReactToPrint } from 'react-to-print';

export function ExportButtons(): JSX.Element {
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const handlePrint = useReactToPrint({
    content: () => document.getElementById('receipt-preview')
  });

  async function handlePDF(): Promise<void> {
    const el = document.getElementById('receipt-preview');
    if (!el) {
      setError('Receipt preview is not ready.');
      return;
    }

    setIsExporting(true);
    setError('');

    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdfHeight = Math.max(1123, canvas.height / 2);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [794, pdfHeight] });

      pdf.addImage(imgData, 'PNG', 0, 0, 794, canvas.height / 2);
      pdf.save('receipt-template-sample.pdf');
    } catch (event) {
      setError(event instanceof Error ? event.message : 'PDF export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
        >
          Print
        </button>
        <button
          type="button"
          onClick={handlePDF}
          disabled={isExporting}
          className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExporting ? 'Exporting...' : 'Download PDF'}
        </button>
      </div>
      {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
