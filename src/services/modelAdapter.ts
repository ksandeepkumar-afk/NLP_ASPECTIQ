import { ModelPredictionPayload, ReviewDomain } from '../types/absa';
import { validateSingleReviewInput } from './csvParser';

export interface InferenceRequest {
  reviewText: string;
  domain: ReviewDomain;
  modelId: string;
}

export interface InferenceResponse {
  ok: boolean;
  prediction: ModelPredictionPayload | null;
  statusMessage: string;
  errorCode?: 'VALIDATION_ERROR' | 'MODEL_NOT_CONNECTED';
}

/**
 * Abstract adapter interface for trained ABSA models.
 * Phase 2 implementation will route requests to the Python/FastAPI or server-side
 * ML inference backend (e.g., SVM, BiLSTM, BERT, DeBERTa-v3 trained on SemEval-2014).
 */
export interface ABSAModelAdapter {
  readonly isLiveInferenceConnected: boolean;
  predictAspects(request: InferenceRequest): Promise<InferenceResponse>;
}

/**
 * Staged Phase 1 adapter: validates input strictly and returns an explicit
 * unimplemented status rather than fabricating ML predictions.
 */
class StagedABSAModelAdapter implements ABSAModelAdapter {
  public readonly isLiveInferenceConnected = false;

  async predictAspects(request: InferenceRequest): Promise<InferenceResponse> {
    const validation = validateSingleReviewInput(request.reviewText);
    if (!validation.valid) {
      return {
        ok: false,
        prediction: null,
        errorCode: 'VALIDATION_ERROR',
        statusMessage: validation.error ?? 'Invalid review input.',
      };
    }

    return {
      ok: false,
      prediction: null,
      errorCode: 'MODEL_NOT_CONNECTED',
      statusMessage:
        `Input validated (${request.reviewText.trim().length} chars, domain: ${request.domain}). ` +
        `Live inference for model "${request.modelId}" is not implemented yet. ` +
        `Connect a trained SemEval-2014 model endpoint to generate real aspect predictions.`,
    };
  }
}

export const absaModelAdapter: ABSAModelAdapter = new StagedABSAModelAdapter();
