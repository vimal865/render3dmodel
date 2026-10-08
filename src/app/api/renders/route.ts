import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { processRenderRequest } from "@/lib/render-service";
import { QuotaError } from "@/lib/quota";
import { GeminiError } from "@/lib/gemini";
import { logEvent, startTimer, renderCost } from "@/lib/activity-log";
import type { RenderRequestBody } from "@/lib/types";

// Flash image generation runs a few seconds; 45s leaves headroom for a
// retry while staying under Vercel's 60s Hobby ceiling.
export const maxDuration = 45;

export async function POST(request: Request) {
  const elapsed = startTimer();
  let userId: string | null = null;
  let body: RenderRequestBody | null = null;

  try {
    const user = await requireAuth();
    userId = user.id;
    body = await request.json();
    if (!body) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (!body.uploadId || !body.style || !Array.isArray(body.finishes)) {
      return NextResponse.json(
        { error: "uploadId, style, and finishes are required" },
        { status: 400 }
      );
    }

    await logEvent({
      event: "render.requested",
      userId,
      resourceType: "upload",
      resourceId: body.uploadId,
      metadata: {
        style: body.style,
        resolution: body.resolution ?? "2K",
        finishCount: body.finishes.length,
        mode: body.baseRenderId ? "recolor" : "render",
      },
      request,
    });

    const render = await processRenderRequest({
      userId: user.id,
      uploadId: body.uploadId,
      style: body.style,
      spaceType: body.spaceType ?? "Interior",
      finishes: body.finishes,
      resolution: body.resolution ?? "2K",
      baseRenderId: body.baseRenderId,
    });

    await logEvent({
      event: "render.completed",
      userId,
      resourceType: "render",
      resourceId: render.id,
      metadata: {
        uploadId: body.uploadId,
        style: body.style,
        resolution: render.resolution,
      },
      durationMs: elapsed(),
      estimatedCostUsd: renderCost(render.resolution),
      request,
    });

    return NextResponse.json({ render });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof QuotaError) {
      await logEvent({
        event: "quota.denied",
        userId,
        status: "denied",
        metadata: { scope: "render", resolution: body?.resolution ?? "2K" },
        errorMessage: err.message,
        request,
      });
      return NextResponse.json(
        { error: err.message },
        {
          status: err.status,
          headers: err.retryAfterSeconds
            ? { "Retry-After": String(err.retryAfterSeconds) }
            : undefined,
        }
      );
    }
    if (err instanceof GeminiError) {
      console.error("Render failed:", err.message, err.cause);
      await logEvent({
        event: "render.failed",
        userId,
        status: "failure",
        resourceType: "upload",
        resourceId: body?.uploadId ?? null,
        metadata: {
          retryable: err.retryable,
          resolution: body?.resolution ?? "2K",
        },
        durationMs: elapsed(),
        errorMessage: err.message,
        request,
      });
      return NextResponse.json(
        {
          error: err.retryable
            ? "The AI service is busy right now. Your render wasn't charged — try again in a moment."
            : "That render couldn't be generated. Try adjusting the finishes.",
        },
        { status: 503 }
      );
    }
    console.error("Render generation failed:", err);
    await logEvent({
      event: "render.failed",
      userId,
      status: "failure",
      resourceType: "upload",
      resourceId: body?.uploadId ?? null,
      durationMs: elapsed(),
      errorMessage: err instanceof Error ? err.message : "unknown",
      request,
    });
    return NextResponse.json(
      { error: "Something went wrong generating your render." },
      { status: 500 }
    );
  }
}
