/**
 * AspectIQ 2.0 — Deterministic Evaluation Metrics Engine
 * Computes genuine classification and span extraction metrics without fabrication.
 */

export interface ClassificationEvaluationReport {
  labels: string[];
  accuracy: number;
  precisionMacro: number;
  recallMacro: number;
  f1Macro: number;
  confusionMatrix: number[][];
}

export function computeClassificationMetrics(
  yTrue: string[],
  yPred: string[],
  labelOrder?: string[]
): ClassificationEvaluationReport {
  if (yTrue.length === 0 || yTrue.length !== yPred.length) {
    return {
      labels: labelOrder ?? [],
      accuracy: 0,
      precisionMacro: 0,
      recallMacro: 0,
      f1Macro: 0,
      confusionMatrix: [],
    };
  }

  const labels =
    labelOrder && labelOrder.length > 0
      ? labelOrder
      : Array.from(new Set([...yTrue, ...yPred])).sort();

  const labelIdx = new Map(labels.map((l, idx) => [l, idx]));
  const matrix: number[][] = Array.from({ length: labels.length }, () =>
    new Array<number>(labels.length).fill(0)
  );

  let correct = 0;
  for (let i = 0; i < yTrue.length; i += 1) {
    const t = labelIdx.get(yTrue[i]);
    const p = labelIdx.get(yPred[i]);
    if (t !== undefined && p !== undefined) {
      matrix[t][p] += 1;
      if (t === p) correct += 1;
    }
  }

  let precisionSum = 0;
  let recallSum = 0;
  let f1Sum = 0;
  let activeClasses = 0;

  for (let c = 0; c < labels.length; c += 1) {
    const tp = matrix[c][c];
    let fp = 0;
    let fn = 0;
    for (let other = 0; other < labels.length; other += 1) {
      if (other !== c) {
        fp += matrix[other][c];
        fn += matrix[c][other];
      }
    }

    const support = tp + fn;
    const predCount = tp + fp;
    if (support === 0 && predCount === 0) continue;

    activeClasses += 1;
    const prec = predCount > 0 ? tp / predCount : 0;
    const rec = support > 0 ? tp / support : 0;
    const f1 = prec + rec > 0 ? (2 * prec * rec) / (prec + rec) : 0;

    precisionSum += prec;
    recallSum += rec;
    f1Sum += f1;
  }

  const denom = Math.max(1, activeClasses);
  return {
    labels,
    accuracy: Number(((correct / yTrue.length) * 100).toFixed(2)),
    precisionMacro: Number(((precisionSum / denom) * 100).toFixed(2)),
    recallMacro: Number(((recallSum / denom) * 100).toFixed(2)),
    f1Macro: Number(((f1Sum / denom) * 100).toFixed(2)),
    confusionMatrix: matrix,
  };
}

export function computeSpanExtractionMetrics(
  goldAspectsPerItem: string[][],
  predAspectsPerItem: string[][]
): { precision: number; recall: number; f1Score: number } {
  let tp = 0;
  let fp = 0;
  let fn = 0;

  const count = Math.min(goldAspectsPerItem.length, predAspectsPerItem.length);
  for (let i = 0; i < count; i += 1) {
    const goldSet = new Set(goldAspectsPerItem[i].map((s) => s.trim().toLowerCase()).filter(Boolean));
    const predSet = new Set(predAspectsPerItem[i].map((s) => s.trim().toLowerCase()).filter(Boolean));

    for (const p of predSet) {
      if (goldSet.has(p)) tp += 1;
      else fp += 1;
    }
    for (const g of goldSet) {
      if (!predSet.has(g)) fn += 1;
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    precision: Number((precision * 100).toFixed(2)),
    recall: Number((recall * 100).toFixed(2)),
    f1Score: Number((f1Score * 100).toFixed(2)),
  };
}
