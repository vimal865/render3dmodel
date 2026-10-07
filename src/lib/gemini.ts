// Gemini integration: the two AI calls in the pipeline.
//
//   analyzeDesign()  -> gemini-3-flash-preview (cheap, fast, vision+JSON)
//   generateRender() -> gemini-3-pro-image-preview, "Nano Banana Pro"
//                        (the paid, high-quality image model)
//
// This is a fast-moving preview API. If a call starts failing, check
// https://ai.google.dev/gemini-api/docs first — model names and the
// response shape for image output are the most likely things to shift.

import { GoogleGenAI } from "@google/genai";
import type { AnalysisResult, PaletteSwatch } from "@/lib/types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ANALYSIS_MODEL = "gemini-3-flash-preview";
const RENDER_MODEL = "gemini-3-pro-image-preview"; // Nano Banana Pro

// Preview APIs fail transiently more often than stable ones. A single
// unlucky 503 shouldn't cost the user their render, but retrying a
// genuine bad-request forever just burns time and money — so only
// transient classes are retried.

const MAX_ATTEMPTS = 3;
const ANALYSIS_TIMEOUT_MS = 30_000;
const RENDER_TIMEOUT_MS = 90_000;

export class GeminiError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public cause?: unknown
  ) {
    super(message);
  }
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number") {
    // 429 rate limited, 5xx upstream trouble. 4xx otherwise means the
    // request itself is wrong and will fail identically on retry.
    return status === 429 || status >= 500;
  }
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("socket hang up") ||
    message.includes("network")
  );
}

async function withRetry<T>(
  label: string,
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fn(controller.signal);
    } catch (err) {
      lastError = err;

      const aborted = controller.signal.aborted;
      const retryable = aborted || isRetryable(err);

      if (!retryable || attempt === MAX_ATTEMPTS) {
        throw new GeminiError(
          aborted
            ? `${label} timed out after ${timeoutMs / 1000}s`
            : err instanceof Error
              ? err.message
              : `${label} failed`,
          retryable,
          err
        );
      }

      // Exponential backoff with jitter, so concurrent failures don't
      // retry in lockstep and hammer an already-struggling upstream.
      const backoff = 400 * 2 ** (attempt - 1) + Math.random() * 300;
      console.warn(
        `${label} attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying in ${Math.round(backoff)}ms`
      );
      await new Promise((r) => setTimeout(r, backoff));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new GeminiError(`${label} failed`, true, lastError);
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

const ANALYSIS_PROMPT = `You are an architectural visualization expert. Look at this
uploaded SketchUp viewport export (an untextured or lightly-textured 3D model
screenshot) and analyze it.

Respond with ONLY a single JSON object, no markdown fences, no commentary,
matching exactly this shape:

{
  "style": string,          // e.g. "Japandi Minimalism", "Industrial Loft"
  "spaceType": string,      // e.g. "Living Space", "Kitchen", "Exterior"
  "scores": {
    "perspective": number,  // 0-100, how well-composed the camera angle is
    "scale": number,        // 0-100, how believable proportions/scale are
    "layout": number,       // 0-100, spatial planning quality
    "concept": number       // 0-100, overall design concept strength
  },
  "palette": [
    { "label": "walls", "hex": "#RRGGBB" },
    { "label": "joinery", "hex": "#RRGGBB" },
    { "label": "flooring", "hex": "#RRGGBB" },
    { "label": "ceiling", "hex": "#RRGGBB" }
  ],
  "caption": string  // one evocative sentence about what makes the space work
}

Suggest a photorealistic finish palette appropriate to the detected style,
even though the uploaded model is untextured.`;

export async function analyzeDesign(
  imageBase64: string,
  mimeType: string
): Promise<AnalysisResult> {
  const response = await withRetry(
    "Design analysis",
    ANALYSIS_TIMEOUT_MS,
    (signal) =>
      ai.models.generateContent({
        model: ANALYSIS_MODEL,
        contents: [
          {
            role: "user",
            parts: [
              { text: ANALYSIS_PROMPT },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          abortSignal: signal,
        },
      })
  );

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned no analysis text");
  }

  return parseAnalysisResponse(text);
}

// Defensive parsing: the model is instructed to return clean JSON, but we
// validate shape and clamp ranges rather than trusting it blindly — same
// spirit as the structured-output validation pattern used elsewhere.
function parseAnalysisResponse(text: string): AnalysisResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    // Model occasionally wraps JSON in markdown fences despite instructions
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not parse analysis response as JSON");
    raw = JSON.parse(match[0]);
  }

  const obj = raw as Record<string, unknown>;
  const scoresObj = (obj.scores as Record<string, unknown>) ?? {};
  const clamp = (n: unknown) =>
    Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

  const palette: PaletteSwatch[] = Array.isArray(obj.palette)
    ? (obj.palette as Record<string, unknown>[])
        .filter((p) => typeof p.label === "string" && typeof p.hex === "string")
        .map((p) => ({ label: String(p.label), hex: String(p.hex) }))
    : [];

  return {
    style: typeof obj.style === "string" ? obj.style : "Contemporary",
    spaceType: typeof obj.spaceType === "string" ? obj.spaceType : "Interior",
    scores: {
      perspective: clamp(scoresObj.perspective),
      scale: clamp(scoresObj.scale),
      layout: clamp(scoresObj.layout),
      concept: clamp(scoresObj.concept),
    },
    palette: palette.length > 0 ? palette : DEFAULT_PALETTE,
    caption:
      typeof obj.caption === "string"
        ? obj.caption
        : "A thoughtfully composed space.",
  };
}

const DEFAULT_PALETTE: PaletteSwatch[] = [
  { label: "walls", hex: "#D8CFC0" },
  { label: "joinery", hex: "#3A3A3A" },
  { label: "flooring", hex: "#B08D63" },
  { label: "ceiling", hex: "#F5F3EE" },
];

// ---------------------------------------------------------------------------
// Render generation
// ---------------------------------------------------------------------------

export type GeneratedRender = {
  buffer: Buffer;
  mimeType: string;
};

function buildRenderPrompt(
  style: string,
  spaceType: string,
  finishes: PaletteSwatch[]
): string {
  const finishLines = finishes
    .map((f) => `- ${f.label}: ${f.hex}`)
    .join("\n");

  return `Transform this SketchUp viewport export into a photorealistic
architectural render. Preserve the exact geometry, camera angle, and
proportions of the uploaded model — do not redesign the layout.

Style: ${style}
Space type: ${spaceType}
Finish palette (apply these materials/colors):
${finishLines}

Render with realistic lighting, accurate material properties (reflectivity,
texture, shadow), and natural context (soft daylight unless the style
suggests otherwise). Output should look like a professional architectural
visualization ready to send to a client — not a sketch, not stylized.`;
}

export async function generateRender(
  imageBase64: string,
  mimeType: string,
  style: string,
  spaceType: string,
  finishes: PaletteSwatch[],
  resolution: "1K" | "2K" | "4K" = "2K"
): Promise<GeneratedRender> {
  const prompt = buildRenderPrompt(style, spaceType, finishes);

  const response = await withRetry("Render", RENDER_TIMEOUT_MS, (signal) =>
    ai.models.generateContent({
      model: RENDER_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { imageSize: resolution },
        abortSignal: signal,
      },
    })
  );

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini returned no image data for the render");
  }

  return {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType ?? "image/png",
  };
}
