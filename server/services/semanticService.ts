/**
 * AspectIQ 2.0 — Semantic Search & Topic Discovery Service
 * Uses @google/genai gemini-embedding-2 embeddings + cosine similarity + deterministic
 * k-means cosine clustering + approximate topic labeling.
 */

import { Type } from '@google/genai';
import { defaultStatementProvider } from './geminiNlpProvider.ts';
import type { OverallSentiment } from './inferenceProvider.ts';

const EMBEDDING_MODEL = 'gemini-embedding-2';
const LABEL_MODEL = 'gemini-3.1-flash-lite';

export interface SemanticDocumentInput {
  statementId: string;
  text: string;
  overallSentiment: OverallSentiment;
}

export interface SemanticSearchMatch {
  statementId: string;
  text: string;
  overallSentiment: OverallSentiment;
  similarityScore: number;
}

export interface TopicClusterResult {
  clusterId: string;
  approximateLabel: string;
  statementCount: number;
  representativeExamples: Array<{
    statementId: string;
    text: string;
    overallSentiment: OverallSentiment;
  }>;
  sentimentDistribution: Record<OverallSentiment, number>;
  disclaimer: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

function normalizeVector(v: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < v.length; i += 1) {
    norm += v[i] * v[i];
  }
  const denom = Math.sqrt(norm);
  if (denom === 0) return v;
  return v.map((val) => val / denom);
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const ai = defaultStatementProvider.getClient();
  const vectors: number[][] = new Array(texts.length);
  const CONCURRENCY = 8;

  for (let i = 0; i < texts.length; i += CONCURRENCY) {
    const slice = texts.slice(i, i + CONCURRENCY);
    const sliceVectors = await Promise.all(
      slice.map(async (text) => {
        const result = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: text,
        });
        const values = result.embeddings?.[0]?.values ?? [];
        if (values.length === 0) {
          throw new Error('Embedding model returned an empty vector.');
        }
        return normalizeVector(values);
      })
    );
    for (let j = 0; j < sliceVectors.length; j += 1) {
      vectors[i + j] = sliceVectors[j];
    }
  }

  return vectors;
}

export async function runSemanticSearch(params: {
  query: string;
  documents: SemanticDocumentInput[];
  topK?: number;
}): Promise<{
  query: string;
  embeddingModel: string;
  matches: SemanticSearchMatch[];
}> {
  const docs = params.documents.slice(0, 200);
  if (docs.length === 0) {
    return { query: params.query, embeddingModel: EMBEDDING_MODEL, matches: [] };
  }

  const allVectors = await embedTexts([params.query, ...docs.map((d) => d.text)]);
  const queryVec = allVectors[0] ?? [];
  const docVecs = allVectors.slice(1);

  const scored: SemanticSearchMatch[] = docs.map((doc, idx) => ({
    statementId: doc.statementId,
    text: doc.text,
    overallSentiment: doc.overallSentiment,
    similarityScore: Number(cosineSimilarity(queryVec, docVecs[idx] ?? []).toFixed(4)),
  }));

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  const topK = Math.max(1, Math.min(params.topK ?? 10, scored.length));

  return {
    query: params.query,
    embeddingModel: EMBEDDING_MODEL,
    matches: scored.slice(0, topK),
  };
}

/**
 * Deterministic k-means over unit-normalized gemini-embedding-2 vectors
 * followed by concise cluster labeling.
 */
export async function runTopicClustering(params: {
  documents: SemanticDocumentInput[];
}): Promise<{
  embeddingModel: string;
  clusters: TopicClusterResult[];
}> {
  const docs = params.documents.slice(0, 150);
  if (docs.length === 0) {
    return { embeddingModel: EMBEDDING_MODEL, clusters: [] };
  }

  const vectors = await embedTexts(docs.map((d) => d.text));
  const k = Math.min(Math.max(2, Math.round(Math.sqrt(docs.length / 2))), 6, docs.length);
  const dim = vectors[0]?.length ?? 0;

  if (dim === 0) {
    return { embeddingModel: EMBEDDING_MODEL, clusters: [] };
  }

  // Deterministic initialization via evenly spaced indices
  const centroids: number[][] = [];
  for (let c = 0; c < k; c += 1) {
    const idx = Math.floor((c * docs.length) / k);
    centroids.push([...(vectors[idx] ?? [])]);
  }

  const assignments = new Array<number>(docs.length).fill(0);
  for (let iter = 0; iter < 12; iter += 1) {
    let changed = false;
    for (let i = 0; i < docs.length; i += 1) {
      let bestCluster = 0;
      let bestSim = -Infinity;
      for (let c = 0; c < k; c += 1) {
        const sim = cosineSimilarity(vectors[i], centroids[c]);
        if (sim > bestSim) {
          bestSim = sim;
          bestCluster = c;
        }
      }
      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }
    if (!changed && iter > 0) break;

    for (let c = 0; c < k; c += 1) {
      const sum = new Array<number>(dim).fill(0);
      let count = 0;
      for (let i = 0; i < docs.length; i += 1) {
        if (assignments[i] === c) {
          count += 1;
          for (let d = 0; d < dim; d += 1) {
            sum[d] += vectors[i][d] ?? 0;
          }
        }
      }
      if (count > 0) {
        centroids[c] = normalizeVector(sum);
      }
    }
  }

  // Group documents per cluster, ordering representatives closest to centroid
  const grouped = new Map<number, Array<{ doc: SemanticDocumentInput; simToCentroid: number }>>();
  for (let i = 0; i < docs.length; i += 1) {
    const c = assignments[i];
    const list = grouped.get(c) ?? [];
    list.push({
      doc: docs[i],
      simToCentroid: cosineSimilarity(vectors[i], centroids[c]),
    });
    grouped.set(c, list);
  }

  const nonEmptyClusters = Array.from(grouped.entries())
    .map(([clusterIdx, items]) => {
      items.sort((a, b) => b.simToCentroid - a.simToCentroid);
      const counts: Record<OverallSentiment, number> = {
        Positive: 0,
        Negative: 0,
        Neutral: 0,
        Mixed: 0,
      };
      for (const item of items) {
        counts[item.doc.overallSentiment] += 1;
      }
      return {
        clusterIdx,
        items,
        counts,
      };
    })
    .sort((a, b) => b.items.length - a.items.length);

  // Generate approximate topic labels for the discovered clusters
  const ai = defaultStatementProvider.getClient();
  const labelInput = nonEmptyClusters.map((c, idx) => ({
    clusterId: `TOPIC-${idx + 1}`,
    samples: c.items.slice(0, 4).map((x) => x.doc.text),
  }));

  const labelMap = new Map<string, string>();
  try {
    const resp = await ai.models.generateContent({
      model: LABEL_MODEL,
      contents: [
        'Provide a concise 2-5 word approximate topic label for each cluster of statements.',
        JSON.stringify(labelInput),
      ].join('\n\n'),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ['clusterId', 'label'],
            properties: {
              clusterId: { type: Type.STRING },
              label: { type: Type.STRING },
            },
          },
        },
      },
    });
    const parsedLabels = JSON.parse((resp.text ?? '[]').trim()) as Array<{
      clusterId?: string;
      label?: string;
    }>;
    for (const item of parsedLabels) {
      if (item.clusterId && item.label) {
        labelMap.set(item.clusterId, item.label.trim());
      }
    }
  } catch {
    // Fallback to generic numbered cluster label if labeling fails
  }

  const clusters: TopicClusterResult[] = nonEmptyClusters.map((c, idx) => {
    const clusterId = `TOPIC-${idx + 1}`;
    return {
      clusterId,
      approximateLabel: labelMap.get(clusterId) ?? `Topic Cluster ${idx + 1}`,
      statementCount: c.items.length,
      representativeExamples: c.items.slice(0, 3).map((x) => ({
        statementId: x.doc.statementId,
        text: x.doc.text,
        overallSentiment: x.doc.overallSentiment,
      })),
      sentimentDistribution: c.counts,
      disclaimer:
        'Approximate cluster label inferred from embedding proximity; clusters are exploratory groupings rather than verified ground truth.',
    };
  });

  return {
    embeddingModel: EMBEDDING_MODEL,
    clusters,
  };
}
