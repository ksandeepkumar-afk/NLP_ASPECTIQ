import { AspectSpanPrediction, GeminiExplanationPayload } from '../types/absa';

export interface ExplanationRequest {
  reviewText: string;
  aspects: AspectSpanPrediction[];
}

/**
 * Dedicated explanation service contract.
 * Keeps Gemini natural-language interpretability strictly separate from
 * ML/DL aspect extraction and polarity classification models.
 */
export interface ExplanationService {
  readonly isConnected: boolean;
  generateAspectExplanation(request: ExplanationRequest): Promise<GeminiExplanationPayload>;
}

class StagedGeminiExplanationService implements ExplanationService {
  public readonly isConnected = false;

  async generateAspectExplanation(request: ExplanationRequest): Promise<GeminiExplanationPayload> {
    if (!request.reviewText.trim() || request.aspects.length === 0) {
      return {
        source: 'GeminiExplanationLayer',
        status: 'error',
        summary: null,
        rationaleByAspect: [],
        disclaimer: 'Cannot generate an explanation without review text and extracted aspects.',
      };
    }

    return {
      source: 'GeminiExplanationLayer',
      status: 'not_connected',
      summary: null,
      rationaleByAspect: [],
      disclaimer:
        'Gemini explanation layer is staged and kept separate from model predictions. ' +
        'Server-side /api/explain integration will be added once live model predictions are connected.',
    };
  }
}

export const geminiExplanationService: ExplanationService = new StagedGeminiExplanationService();
