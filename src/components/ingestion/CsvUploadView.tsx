import { useState } from 'react';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { validateAndParseCsvFile } from '../../services/csvParser';
import { downloadCsvIngestionTemplate } from '../../services/reportExport';
import { CsvValidationSummary } from '../../types/absa';

export function CsvUploadView() {
  const [summary, setSummary] = useState<CsvValidationSummary | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    try {
      const result = await validateAndParseCsvFile(file);
      setSummary(result);
    } finally {
      setIsParsing(false);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Template Download */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold text-slate-900">
            Batch CSV Review Ingestion & Schema Validator
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Upload a UTF-8 CSV file containing a <code className="font-mono">review_text</code>{' '}
            column (plus optional <code className="font-mono">review_id</code> and{' '}
            <code className="font-mono">domain</code> columns). Files are validated locally before
            batch inference is connected.
          </p>
        </div>

        <button
          type="button"
          onClick={downloadCsvIngestionTemplate}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Download CSV Template</span>
        </button>
      </section>

      {/* Upload Dropzone */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <label className="flex flex-col items-center justify-center border border-dashed border-slate-300 hover:border-blue-500 rounded-lg py-10 px-6 cursor-pointer transition-colors bg-slate-50/50">
          <Upload className="w-6 h-6 text-slate-400 mb-3" aria-hidden="true" />
          <span className="text-sm font-medium text-slate-900">
            {isParsing ? 'Parsing and validating CSV...' : 'Select a .csv file to validate'}
          </span>
          <span className="text-xs text-slate-500 mt-1">
            Maximum file size: 5 MB · Required header: review_text (or text / review)
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileSelected}
            disabled={isParsing}
            className="sr-only"
          />
        </label>
      </section>

      {/* Empty State before upload */}
      {!summary && (
        <section className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
          <FileSpreadsheet className="w-6 h-6 text-slate-400 mx-auto" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-900">No CSV Batch Loaded</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Download the sample template above or select your own review dataset to verify header
            matching, character length constraints, and row-level parsing diagnostics.
          </p>
        </section>
      )}

      {/* Validation Fatal Error */}
      {summary && summary.fatalError && (
        <section
          role="alert"
          className="bg-rose-50 border border-rose-200 rounded-xl p-5 flex items-start gap-3 text-rose-900"
        >
          <AlertCircle className="w-5 h-5 text-rose-700 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-sm">CSV Validation Failed — {summary.fileName}</p>
            <p>{summary.fatalError}</p>
            {summary.detectedColumns.length > 0 && (
              <p className="font-mono text-rose-800 pt-1">
                Detected headers: {summary.detectedColumns.join(', ')}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Validated CSV Preview */}
      {summary && !summary.fatalError && (
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  {summary.fileName} — Parsed Batch Preview
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                  {summary.validRows} valid rows · {summary.invalidRows} invalid rows ·{' '}
                  {(summary.fileSizeBytes / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            <span className="text-xs text-slate-500">
              Batch inference pending model connection
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <th className="py-2.5 px-6 whitespace-nowrap">Row</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Review ID</th>
                  <th className="py-2.5 px-4 whitespace-nowrap">Domain</th>
                  <th className="py-2.5 px-4">Review Text</th>
                  <th className="py-2.5 px-6 whitespace-nowrap">Validation Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.rows.slice(0, 50).map((row) => (
                  <tr key={row.rowNumber} className="hover:bg-slate-50">
                    <td className="py-3 px-6 font-mono text-slate-500 tabular-nums">
                      {row.rowNumber}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {row.reviewId}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">{row.domain}</td>
                    <td className="py-3 px-4 text-slate-800 max-w-lg">
                      <p className="line-clamp-2 leading-relaxed">
                        {row.reviewText || '(empty)'}
                      </p>
                    </td>
                    <td className="py-3 px-6 whitespace-nowrap">
                      {row.isValid ? (
                        <span className="text-emerald-700 font-medium">Valid</span>
                      ) : (
                        <span className="text-rose-700 font-medium">{row.validationError}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
