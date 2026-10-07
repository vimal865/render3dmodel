import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { processUpload } from "@/lib/render-service";
import { QuotaError } from "@/lib/quota";
import { GeminiError } from "@/lib/gemini";
import {
  logEvent,
  startTimer,
  analysisCost,
} from "@/lib/activity-log";

// Analysis is a single Gemini call (a few seconds), but give real headroom
// on top of network variance. Well under Vercel's 60s Hobby ceiling.
export const maxDuration = 45;

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: Request) {
  const elapsed = startTimer();
  let userId: string | null = null;

  try {
    const user = await requireAuth();
    userId = user.id;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      await logEvent({
        event: "upload.rejected",
        userId,
        status: "denied",
        metadata: { reason: "unsupported_type", mimeType: file.type },
        request,
      });
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, or WebP." },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      await logEvent({
        event: "upload.rejected",
        userId,
        status: "denied",
        metadata: { reason: "too_large", sizeBytes: file.size },
        request,
      });
      return NextResponse.json(
        { error: "File too large — 15MB max." },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { upload, analysis } = await processUpload({
      userId: user.id,
      fileBuffer,
      mimeType: file.type,
    });

    await logEvent({
      event: "upload.analyzed",
      userId,
      resourceType: "upload",
      resourceId: upload.id,
      metadata: {
        mimeType: file.type,
        sizeBytes: file.size,
        style: analysis.style,
        spaceType: analysis.spaceType,
      },
      durationMs: elapsed(),
      estimatedCostUsd: analysisCost(),
      request,
    });

    return NextResponse.json({ upload, analysis });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof QuotaError) {
      await logEvent({
        event: "quota.denied",
        userId,
        status: "denied",
        metadata: { scope: "analysis" },
        errorMessage: err.message,
        request,
      });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof GeminiError) {
      // Don't leak upstream error text to the user — it's noisy and
      // occasionally reveals internals. Log the detail, show a plain
      // message that says what to do next.
      console.error("Analysis failed:", err.message, err.cause);
      await logEvent({
        event: "upload.failed",
        userId,
        status: "failure",
        metadata: { retryable: err.retryable },
        durationMs: elapsed(),
        errorMessage: err.message,
        request,
      });
      return NextResponse.json(
        {
          error: err.retryable
            ? "The AI service is busy right now. Try again in a moment."
            : "We couldn't read that image. Try a different export.",
        },
        { status: 503 }
      );
    }
    console.error("Upload/analysis failed:", err);
    await logEvent({
      event: "upload.failed",
      userId,
      status: "failure",
      durationMs: elapsed(),
      errorMessage: err instanceof Error ? err.message : "unknown",
      request,
    });
    return NextResponse.json(
      { error: "Something went wrong processing your upload." },
      { status: 500 }
    );
  }
}
