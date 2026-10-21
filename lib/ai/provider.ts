import { z } from "zod";

export interface AICompletionOptions<T> {
  prompt: string;
  systemPrompt?: string;
  schema: z.ZodType<T>;
  promptVersion?: string;
  temperature?: number;
  fallbackMock?: () => T;
}

export interface AICompletionResult<T> {
  data: T;
  promptVersion: string;
  provider: string;
  model: string;
}

/**
 * Normalizes and cleans raw LLM response text that may contain markdown JSON code blocks.
 */
function cleanJsonMarkdown(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Calls Google Gemini REST API for structured JSON generation.
 */
async function callGemini(
  apiKey: string,
  systemPrompt: string | undefined,
  userPrompt: string,
  model = "gemini-1.5-flash"
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [
    ...(systemPrompt
      ? [
          {
            role: "user",
            parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}` }],
          },
          {
            role: "model",
            parts: [{ text: "Understood. I will strictly output valid JSON complying with your instructions." }],
          },
        ]
      : []),
    {
      role: "user",
      parts: [{ text: userPrompt }],
    },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error("Gemini returned empty candidate response.");
    }

    return candidateText;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls Anthropic Claude REST API for structured JSON generation.
 */
async function callClaude(
  apiKey: string,
  systemPrompt: string | undefined,
  userPrompt: string,
  model = "claude-3-haiku-20240307"
): Promise<string> {
  const url = "https://api.anthropic.com/v1/messages";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0.1,
        system: systemPrompt || "You are an expert fact-checking AI. Always reply in strictly valid JSON.",
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const candidateText = data?.content?.[0]?.text;
    if (!candidateText) {
      throw new Error("Claude returned empty response.");
    }

    return candidateText;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Unified AI completion function with Zod validation, retry-once logic,
 * and seamless mock fallback support.
 */
export async function generateStructuredCompletion<T>(
  options: AICompletionOptions<T>
): Promise<AICompletionResult<T>> {
  const { prompt, systemPrompt, schema, promptVersion = "v1", fallbackMock } = options;

  const provider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  const useMocks = process.env.USE_MOCKS === "true";
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  const hasValidKey =
    (provider === "gemini" && !!geminiKey) ||
    (provider === "claude" && !!anthropicKey);

  // Use mock fallback if explicitly requested or API keys are missing
  if (useMocks || !hasValidKey) {
    if (fallbackMock) {
      const mockData = fallbackMock();
      const parsed = schema.parse(mockData);
      return {
        data: parsed,
        promptVersion,
        provider: "mock-provider",
        model: "mock-deterministic-v1",
      };
    }
    throw new Error(
      `No API key configured for provider '${provider}' and no mock fallback provided.`
    );
  }

  const model = provider === "claude" ? "claude-3-haiku-20240307" : "gemini-1.5-flash";

  // Attempt 1: Call Provider
  let rawResponse: string;
  try {
    if (provider === "claude" && anthropicKey) {
      rawResponse = await callClaude(anthropicKey, systemPrompt, prompt, model);
    } else if (geminiKey) {
      rawResponse = await callGemini(geminiKey, systemPrompt, prompt, model);
    } else {
      throw new Error(`Unsupported provider '${provider}'.`);
    }
  } catch (err) {
    console.warn(`[AI Provider] Primary API call failed:`, err);
    if (fallbackMock) {
      console.log(`[AI Provider] Falling back to structured mock data.`);
      return {
        data: schema.parse(fallbackMock()),
        promptVersion,
        provider: `${provider}-fallback`,
        model: `${model}-fallback`,
      };
    }
    throw err;
  }

  // Parse Attempt 1
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanJsonMarkdown(rawResponse));
  } catch {
    parsedJson = null;
  }

  let validation = schema.safeParse(parsedJson);

  // Attempt 2 (Retry Once if Zod validation failed, per Rule 2.2.2)
  if (!validation.success) {
    console.warn(
      `[AI Provider] Output validation failed on first attempt. Retrying once with error feedback...`
    );
    const retryPrompt = `${prompt}\n\nIMPORTANT: Your previous output failed JSON validation: ${validation.error.message}. Return ONLY strictly compliant JSON matching the requested schema.`;

    try {
      if (provider === "claude" && anthropicKey) {
        rawResponse = await callClaude(anthropicKey, systemPrompt, retryPrompt, model);
      } else if (geminiKey) {
        rawResponse = await callGemini(geminiKey, systemPrompt, retryPrompt, model);
      }
      parsedJson = JSON.parse(cleanJsonMarkdown(rawResponse));
      validation = schema.safeParse(parsedJson);
    } catch (retryErr) {
      console.error(`[AI Provider] Retry call failed:`, retryErr);
    }

    if (!validation.success) {
      if (fallbackMock) {
        console.warn(`[AI Provider] Second attempt validation failed. Using graceful fallback mock.`);
        return {
          data: schema.parse(fallbackMock()),
          promptVersion,
          provider: `${provider}-mock-fallback`,
          model,
        };
      }
      throw new Error(`LLM output validation failed after retry: ${validation.error.message}`);
    }
  }

  return {
    data: validation.data,
    promptVersion,
    provider,
    model,
  };
}

/**
 * Generates a normalized 128-dimensional embedding vector for semantic deduplication.
 * Uses deterministic token hashing and character n-gram distribution for universal compatibility.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const DIMENSIONS = 128;
  const vector = new Array<number>(DIMENSIONS).fill(0);

  if (!text || text.trim().length === 0) {
    return vector;
  }

  const clean = text.toLowerCase().trim();
  const words = clean.split(/\s+/);

  // Word token hashing
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = (hash << 5) - hash + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % DIMENSIONS;
    vector[idx] += 1.0;
  }

  // Character tri-gram distribution (for multilingual typo & phonetic resistance)
  for (let i = 0; i < clean.length - 2; i++) {
    const trigram = clean.slice(i, i + 3);
    let hash = 0;
    for (let j = 0; j < 3; j++) {
      hash = (hash * 31 + trigram.charCodeAt(j)) | 0;
    }
    const idx = Math.abs(hash) % DIMENSIONS;
    vector[idx] += 0.5;
  }

  // L2-Normalize vector so dot-product equals cosine similarity
  let norm = 0;
  for (let i = 0; i < DIMENSIONS; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < DIMENSIONS; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }
  }

  return vector;
}

/**
 * Computes cosine similarity between two embedding vectors (0 to 1).
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return Math.max(0, Math.min(1, dotProduct / denom));
}
