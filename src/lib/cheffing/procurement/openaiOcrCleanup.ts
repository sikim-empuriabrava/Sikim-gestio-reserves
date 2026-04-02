import 'server-only';

import { z } from 'zod';

import { normalizeProcurementCanonicalUnit, type ProcurementCanonicalUnit, type ProcurementDocumentKind } from '@/lib/cheffing/procurement';

const DEFAULT_OPENAI_OCR_CLEANUP_MODEL = 'gpt-4.1-mini';

const cleanupLineSchema = z.object({
  line_number: z.number().int().min(1),
  raw_description: z.string().default(''),
  cleaned_description: z.string().nullable(),
  product_code: z.string().nullable(),
  boxes: z.number().nullable(),
  units: z.number().nullable(),
  quantity_interpreted: z.number().nullable(),
  unit_interpreted: z.string().nullable(),
  canonical_unit: z.string().nullable(),
  unit_price_interpreted: z.number().nullable(),
  line_total_interpreted: z.number().nullable(),
  ingredient_match: z
    .object({
      ingredient_id: z.string().nullable(),
      ingredient_name: z.string().nullable(),
      confidence: z.enum(['high', 'medium', 'low']),
      match_basis: z.string().nullable(),
      ambiguous: z.boolean(),
    })
    .nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  warnings: z.array(z.string()).default([]),
  reasoning_short: z.string().nullable(),
  source_trace: z.enum(['azure', 'openai', 'azure+openai']),
});

const openAiCleanupSchema = z.object({
  supplier_cleanup: z.object({
    cleaned_name: z.string().nullable(),
    cleaned_tax_id: z.string().nullable(),
    cleaned_email: z.string().nullable(),
    cleaned_phone: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    warnings: z.array(z.string()).default([]),
    source_trace: z.enum(['azure', 'openai', 'azure+openai']),
  }),
  document_cleanup: z.object({
    cleaned_document_number: z.string().nullable(),
    cleaned_document_date: z.string().nullable(),
    detected_currency: z.string().nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    warnings: z.array(z.string()).default([]),
    source_trace: z.enum(['azure', 'openai', 'azure+openai']),
  }),
  lines_cleanup: z.array(cleanupLineSchema),
  cleanup_meta: z.object({
    model: z.string(),
    version: z.string(),
    processed_at: z.string(),
    notes: z.array(z.string()).default([]),
  }),
  global_warnings: z.array(z.string()).default([]),
});

type OpenAiCleanupSchema = z.infer<typeof openAiCleanupSchema>;

type OpenAiResponsesOutput = {
  type?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
};

type OpenAiResponsesPayload = {
  output_text?: string;
  output?: OpenAiResponsesOutput[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

export type OpenAiOcrCleanupLine = Omit<z.infer<typeof cleanupLineSchema>, 'canonical_unit'> & {
  canonical_unit: ProcurementCanonicalUnit | null;
};

export type OpenAiOcrCleanupResult = Omit<OpenAiCleanupSchema, 'lines_cleanup'> & {
  lines_cleanup: OpenAiOcrCleanupLine[];
};

type CleanupInputLine = {
  line_number: number;
  raw_description: string;
  raw_quantity: number | null;
  raw_unit: string | null;
  raw_unit_price: number | null;
  raw_line_total: number | null;
  boxes: number | null;
  units: number | null;
  product_code: string | null;
  warning_notes: string | null;
};

type IngredientCandidate = { id: string; name: string };
type RetrievedSupplierCandidate = {
  id: string;
  trade_name: string;
  tax_id: string | null;
  score_hint: number;
  match_reasons: string[];
};
type RetrievedLineCandidate = {
  line_number: number;
  candidates: Array<{
    ingredient_id: string;
    ingredient_name: string;
    supplier_ref_context: {
      supplier_id: string;
      supplier_product_description: string;
      supplier_product_alias: string | null;
      reference_unit_code: string | null;
      reference_format_qty: number | null;
    } | null;
    score_hint: number;
    match_reasons: string[];
  }>;
};
type SupplierRefCandidate = {
  supplier_id: string;
  ingredient_id: string;
  supplier_product_description: string;
  supplier_product_alias: string | null;
  reference_unit_code: string | null;
  reference_format_qty: number | null;
};
type SupplierCandidate = {
  id: string;
  trade_name: string;
  tax_id: string | null;
};

export function shouldRunOpenAiOcrCleanup(): boolean {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const enabled = process.env.OPENAI_OCR_CLEANUP_ENABLED?.trim()?.toLowerCase();
  if (!apiKey) return false;
  if (!enabled) return true;
  return enabled === 'true' || enabled === '1' || enabled === 'yes';
}

export function getOpenAiOcrCleanupModel(): string {
  const model = process.env.OPENAI_OCR_CLEANUP_MODEL?.trim();
  return model || DEFAULT_OPENAI_OCR_CLEANUP_MODEL;
}

function extractResponseText(payload: OpenAiResponsesPayload): string {
  const directText = typeof payload.output_text === 'string' ? payload.output_text.trim() : '';
  if (directText) return directText;

  const outputText = payload.output
    ?.flatMap((entry) => entry.content ?? [])
    .filter((entry) => entry.type === 'output_text' && typeof entry.text === 'string')
    .map((entry) => entry.text?.trim() ?? '')
    .find((text) => text.length > 0);

  if (outputText) return outputText;

  throw new Error('OpenAI response did not contain parseable structured output');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableOpenAiStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function resolveRetryAfterMs(response: Response): number | null {
  const retryAfterValue = response.headers.get('Retry-After')?.trim();
  if (!retryAfterValue) return null;

  const retryAfterSeconds = Number(retryAfterValue);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.round(retryAfterSeconds * 1000);
  }

  const retryAfterDateMs = Date.parse(retryAfterValue);
  if (Number.isNaN(retryAfterDateMs)) return null;

  const nowMs = Date.now();
  const deltaMs = retryAfterDateMs - nowMs;
  return deltaMs > 0 ? deltaMs : null;
}

function buildHttpErrorMessage(status: number, model: string, responseBodyDetail: string | null): string {
  if (status === 401) return 'OpenAI API key rejected (401 Unauthorized).';
  if (status === 404) return `OpenAI model not found or unavailable: "${model}".`;
  if (status === 400) return `OpenAI request rejected for model "${model}" (400 Bad Request).`;
  if (status === 429) return `OpenAI rate-limit exceeded for model "${model}" (429 Too Many Requests).`;

  const detailSuffix = responseBodyDetail ? ` Detail: ${responseBodyDetail}` : '';
  return `OpenAI request failed for model "${model}" (${status}).${detailSuffix}`;
}

async function readResponseBodyDetail(response: Response): Promise<string | null> {
  const rawBody = await response.text();
  if (!rawBody.trim()) return null;

  try {
    const parsed = JSON.parse(rawBody) as OpenAiResponsesPayload;
    const errorMessage = parsed.error?.message?.trim();
    if (errorMessage) return errorMessage;
    return rawBody.slice(0, 400);
  } catch {
    return rawBody.slice(0, 400);
  }
}

export async function runOpenAiOcrCleanup(input: {
  documentKind: ProcurementDocumentKind;
  ocrRawText: string;
  lines: CleanupInputLine[];
  supplierCandidates: RetrievedSupplierCandidate[];
  lineCandidatesByLineNumber: RetrievedLineCandidate[];
  ingredientCandidatesFallback?: IngredientCandidate[];
  supplierCandidatesFallback?: SupplierCandidate[];
  supplierProductRefsFallback?: SupplierRefCandidate[];
}): Promise<OpenAiOcrCleanupResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY');
  const model = getOpenAiOcrCleanupModel();
  const backoffMsByAttempt = [1500, 3000, 6000] as const;

  const promptPayload = {
    document_kind: input.documentKind,
    ocr_raw_text: input.ocrRawText.slice(0, 28_000),
    lines: input.lines,
    supplier_candidates: input.supplierCandidates.slice(0, 5),
    line_candidates_by_line_number: input.lineCandidatesByLineNumber.map((entry) => ({
      line_number: entry.line_number,
      candidates: entry.candidates.slice(0, 8),
    })),
    ingredient_candidates_fallback: (input.ingredientCandidatesFallback ?? []).slice(0, 200),
    supplier_candidates_fallback: (input.supplierCandidatesFallback ?? []).slice(0, 80),
    supplier_product_refs_fallback: (input.supplierProductRefsFallback ?? []).slice(0, 250),
  };

  for (let attempt = 0; attempt < backoffMsByAttempt.length; attempt += 1) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content:
              'Eres un limpiador OCR para compras de restauración. NO validas de forma final. Solo limpias, interpretas y normalizas conservadoramente.',
          },
          {
            role: 'user',
            content:
              'Devuelve salida estructurada estricta para cleanup OCR. Mantén trazabilidad azure/openai.\n' +
              'Reglas: no inventar valores si no hay señal clara; ante ambigüedad añade warning; ingrediente_match solo high si evidencia fuerte.\n' +
              'supplier_id y validated_ingredient_id nunca se autoconfirman en este paso; solo sugerencias conservadoras.\n' +
              'No incluyas razonamiento largo, solo reasoning_short breve.\n\n' +
              JSON.stringify(promptPayload),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'ocr_cleanup_output',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                supplier_cleanup: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    cleaned_name: { type: ['string', 'null'] },
                    cleaned_tax_id: { type: ['string', 'null'] },
                    cleaned_email: { type: ['string', 'null'] },
                    cleaned_phone: { type: ['string', 'null'] },
                    confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 },
                    warnings: { type: 'array', items: { type: 'string' } },
                    source_trace: { type: 'string', enum: ['azure', 'openai', 'azure+openai'] },
                  },
                  required: ['cleaned_name', 'cleaned_tax_id', 'cleaned_email', 'cleaned_phone', 'confidence', 'warnings', 'source_trace'],
                },
                document_cleanup: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    cleaned_document_number: { type: ['string', 'null'] },
                    cleaned_document_date: { type: ['string', 'null'] },
                    detected_currency: { type: ['string', 'null'] },
                    confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 },
                    warnings: { type: 'array', items: { type: 'string' } },
                    source_trace: { type: 'string', enum: ['azure', 'openai', 'azure+openai'] },
                  },
                  required: ['cleaned_document_number', 'cleaned_document_date', 'detected_currency', 'confidence', 'warnings', 'source_trace'],
                },
                lines_cleanup: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      line_number: { type: 'integer', minimum: 1 },
                      raw_description: { type: 'string' },
                      cleaned_description: { type: ['string', 'null'] },
                      product_code: { type: ['string', 'null'] },
                      boxes: { type: ['number', 'null'] },
                      units: { type: ['number', 'null'] },
                      quantity_interpreted: { type: ['number', 'null'] },
                      unit_interpreted: { type: ['string', 'null'] },
                      canonical_unit: { type: ['string', 'null'] },
                      unit_price_interpreted: { type: ['number', 'null'] },
                      line_total_interpreted: { type: ['number', 'null'] },
                      ingredient_match: {
                        type: ['object', 'null'],
                        additionalProperties: false,
                        properties: {
                          ingredient_id: { type: ['string', 'null'] },
                          ingredient_name: { type: ['string', 'null'] },
                          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
                          match_basis: { type: ['string', 'null'] },
                          ambiguous: { type: 'boolean' },
                        },
                        required: ['ingredient_id', 'ingredient_name', 'confidence', 'match_basis', 'ambiguous'],
                      },
                      confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 },
                      warnings: { type: 'array', items: { type: 'string' } },
                      reasoning_short: { type: ['string', 'null'] },
                      source_trace: { type: 'string', enum: ['azure', 'openai', 'azure+openai'] },
                    },
                    required: [
                      'line_number',
                      'raw_description',
                      'cleaned_description',
                      'product_code',
                      'boxes',
                      'units',
                      'quantity_interpreted',
                      'unit_interpreted',
                      'canonical_unit',
                      'unit_price_interpreted',
                      'line_total_interpreted',
                      'ingredient_match',
                      'confidence',
                      'warnings',
                      'reasoning_short',
                      'source_trace',
                    ],
                  },
                },
                cleanup_meta: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    model: { type: 'string' },
                    version: { type: 'string' },
                    processed_at: { type: 'string' },
                    notes: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['model', 'version', 'processed_at', 'notes'],
                },
                global_warnings: { type: 'array', items: { type: 'string' } },
              },
              required: ['supplier_cleanup', 'document_cleanup', 'lines_cleanup', 'cleanup_meta', 'global_warnings'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const responseBodyDetail = await readResponseBodyDetail(response);
      if (isRetryableOpenAiStatus(response.status) && attempt < backoffMsByAttempt.length - 1) {
        const retryAfterMs = resolveRetryAfterMs(response);
        const waitMs = retryAfterMs ?? backoffMsByAttempt[attempt];
        await sleep(waitMs);
        continue;
      }
      throw new Error(buildHttpErrorMessage(response.status, model, responseBodyDetail));
    }

    const responsePayload = (await response.json()) as OpenAiResponsesPayload;
    const payloadText = extractResponseText(responsePayload);
    const parsed = openAiCleanupSchema.parse(JSON.parse(payloadText));

    return {
      ...parsed,
      lines_cleanup: parsed.lines_cleanup.map((line) => {
        const normalizedCanonical = normalizeProcurementCanonicalUnit(line.canonical_unit);
        return {
          ...line,
          canonical_unit: typeof normalizedCanonical === 'string' ? normalizedCanonical : null,
        };
      }),
    };
  }

  throw new Error(`OpenAI OCR cleanup exhausted retries for model "${model}".`);
}
