import { SampleReviewRecord } from '../types/absa';
import { buildSampleAspectSummary } from '../data/sampleDataset';

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Exports a structured academic inspection JSON report of the sample dataset.
 * Explicitly labels all records as Sample Preview Data so it cannot be mistaken
 * for trained SemEval-2014 evaluation output.
 */
export function exportSampleJsonReport(reviews: SampleReviewRecord[]): void {
  const aspectSummary = buildSampleAspectSummary(reviews);
  const payload = {
    reportTitle: 'AspectIQ — Sample Dataset Inspection Report',
    dataProvenance: 'SAMPLE_PREVIEW_DATA_NOT_TRAINED_MODEL_OUTPUT',
    generatedAt: new Date().toISOString(),
    notes: [
      'All reviews and aspect annotations in this export are illustrative sample data.',
      'No ML/DL model training or SemEval-2014 benchmark evaluation has been executed yet.',
    ],
    sampleSummary: {
      totalSampleReviews: reviews.length,
      totalSampleAspectMentions: aspectSummary.reduce((sum, row) => sum + row.totalMentions, 0),
      aspectBreakdown: aspectSummary,
    },
    records: reviews.map((r) => ({
      id: r.id,
      domain: r.domain,
      productOrVenue: r.productOrVenue,
      isSampleData: r.isSampleData,
      reviewText: r.reviewText,
      sampleAspects: r.prediction.aspects.map((a) => ({
        aspectTerm: a.aspectTerm,
        aspectCategory: a.aspectCategory,
        polarity: a.polarity,
      })),
    })),
  };

  triggerDownload(
    'aspectiq-sample-inspection-report.json',
    JSON.stringify(payload, null, 2),
    'application/json;charset=utf-8'
  );
}

/**
 * Downloads a valid UTF-8 CSV template for testing the batch review ingestion pipeline.
 */
export function downloadCsvIngestionTemplate(): void {
  const csvRows = [
    'review_id,domain,review_text',
    'REV-001,Electronics,"The camera sensor performs wonderfully at dusk, though battery life drains fast during 4K recording."',
    'REV-002,Restaurants,"Food quality was vibrant and fresh, and our server checked on us promptly despite a busy patio."',
    'REV-003,Electronics,"The matte display minimizes glare effectively, while speaker volume remains average for video calls."',
  ];

  triggerDownload('aspectiq-review-upload-template.csv', csvRows.join('\n'), 'text/csv;charset=utf-8');
}
