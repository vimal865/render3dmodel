// Orchestration layer for the upload -> analyze -> render pipeline.
//
// This is the "one function to swap" from the architecture plan: right now
// processUpload() and processRenderRequest() run synchronously inside the
// API route's request/response cycle (fine — Vercel allows up to 60s and
// the AI calls take well under that). If concurrent users or longer render
// times ever require an async queue (Redis/Upstash), only this file
// changes — publish a job here instead of awaiting generateRender()
// directly, and have a worker call the same Gemini functions.

import { createClient } from "@/lib/supabase/server";
import { analyzeDesign, generateRender } from "@/lib/gemini";
import { assertAnalysisQuota, assertRenderQuota } from "@/lib/quota";
import type {
  AnalysisResult,
  PaletteSwatch,
  UploadRecord,
  RenderRecord,
  RenderWithContext,
} from "@/lib/types";

function extFromMimeType(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  return "jpg";
}

export async function processUpload(params: {
  userId: string;
  fileBuffer: Buffer;
  mimeType: string;
}): Promise<{ upload: UploadRecord; analysis: AnalysisResult }> {
  // Check quota before spending anything — storage write included.
  await assertAnalysisQuota(params.userId);

  const supabase = await createClient();
  const uploadId = crypto.randomUUID();
  const storagePath = `${params.userId}/${uploadId}.${extFromMimeType(params.mimeType)}`;

  const { error: uploadError } = await supabase.storage
    .from("uploads")
    .upload(storagePath, params.fileBuffer, {
      contentType: params.mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: uploadRow, error: insertError } = await supabase
    .from("uploads")
    .insert({
      id: uploadId,
      user_id: params.userId,
      storage_path: storagePath,
      mime_type: params.mimeType,
      status: "uploaded",
    })
    .select()
    .single();
  if (insertError || !uploadRow) {
    throw new Error(`DB insert (uploads) failed: ${insertError?.message}`);
  }

  let analysis: AnalysisResult;
  try {
    analysis = await analyzeDesign(
      params.fileBuffer.toString("base64"),
      params.mimeType
    );
  } catch (err) {
    // Without this the storage object and the uploads row survive an
    // analysis failure with status stuck at "uploaded" — invisible to
    // the user, counting against their quota, and costing storage.
    await supabase.from("uploads").update({ status: "failed" }).eq("id", uploadId);
    await supabase.storage.from("uploads").remove([storagePath]);
    await supabase.from("uploads").delete().eq("id", uploadId);
    throw err;
  }

  const { error: analysisInsertError } = await supabase.from("analyses").insert({
    upload_id: uploadId,
    style: analysis.style,
    space_type: analysis.spaceType,
    scores: analysis.scores,
    palette: analysis.palette,
    caption: analysis.caption,
  });
  if (analysisInsertError) {
    // Non-fatal — the user still gets their result even if persisting it
    // failed. Worth alerting on in a real deployment.
    console.error("Failed to persist analysis:", analysisInsertError.message);
  }

  await supabase.from("uploads").update({ status: "analyzed" }).eq("id", uploadId);

  return { upload: uploadRow as UploadRecord, analysis };
}

export async function processRenderRequest(params: {
  userId: string;
  uploadId: string;
  style: string;
  spaceType: string;
  finishes: PaletteSwatch[];
  resolution?: "1K" | "2K" | "4K";
}): Promise<RenderRecord & { url: string }> {
  await assertRenderQuota(params.userId);

  const supabase = await createClient();

  const { data: uploadRow, error: fetchError } = await supabase
    .from("uploads")
    .select("*")
    .eq("id", params.uploadId)
    .eq("user_id", params.userId)
    .single();
  if (fetchError || !uploadRow) {
    throw new Error("Upload not found");
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("uploads")
    .download(uploadRow.storage_path);
  if (downloadError || !fileData) {
    throw new Error("Could not load the original upload for rendering");
  }

  const originalBuffer = Buffer.from(await fileData.arrayBuffer());
  // Prefer the mime type recorded at upload time. Supabase's download
  // blob frequently reports a generic type, and handing the wrong one to
  // Gemini alongside the bytes produces unpredictable results.
  const originalMimeType =
    uploadRow.mime_type || fileData.type || "image/png";
  const renderId = crypto.randomUUID();

  const { data: renderRow, error: insertError } = await supabase
    .from("renders")
    .insert({
      id: renderId,
      upload_id: params.uploadId,
      finishes: params.finishes,
      resolution: params.resolution ?? "2K",
      status: "pending",
    })
    .select()
    .single();
  if (insertError || !renderRow) {
    throw new Error(`DB insert (renders) failed: ${insertError?.message}`);
  }

  try {
    const result = await generateRender(
      originalBuffer.toString("base64"),
      originalMimeType,
      params.style,
      params.spaceType,
      params.finishes,
      params.resolution ?? "2K"
    );

    const storagePath = `${params.userId}/${renderId}.${extFromMimeType(result.mimeType)}`;

    const { error: uploadError } = await supabase.storage
      .from("renders")
      .upload(storagePath, result.buffer, {
        contentType: result.mimeType,
        upsert: false,
      });
    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from("renders")
      .update({ storage_path: storagePath, status: "complete" })
      .eq("id", renderId)
      .select()
      .single();
    if (updateError || !updatedRow) {
      throw new Error(`DB update (renders) failed: ${updateError?.message}`);
    }

    const { data: urlData } = await supabase.storage
      .from("renders")
      .createSignedUrl(storagePath, 60 * 60); // 1 hour — plenty for immediate download

    return { ...(updatedRow as RenderRecord), url: urlData?.signedUrl ?? "" };
  } catch (err) {
    await supabase
      .from("renders")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", renderId);
    throw err;
  }
}

// Recent renders for the profile page. Signed URLs are generated per-row
// because the storage buckets are private — there's no permanent public
// URL to store in the DB.
export async function listUserRenders(
  userId: string,
  limit = 12
): Promise<(RenderRecord & { url: string | null })[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("renders")
    .select("*, uploads!inner(user_id)")
    .eq("uploads.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to list renders:", error.message);
    return [];
  }

  const rows = (data ?? []) as (RenderRecord & { uploads?: unknown })[];

  return Promise.all(
    rows.map(async (row) => {
      if (!row.storage_path) return { ...row, url: null };
      const { data: urlData } = await supabase.storage
        .from("renders")
        .createSignedUrl(row.storage_path, 60 * 60);
      return { ...row, url: urlData?.signedUrl ?? null };
    })
  );
}

const RENDERS_PAGE_SIZE = 24;

// Full paginated history for the "My Renders" gallery page, enriched with
// style/space type from the parent upload's analysis. listUserRenders()
// above stays a separate, simpler query since the profile preview doesn't
// need pagination or analysis context.
export async function listUserRendersPaginated(
  userId: string,
  {
    page = 1,
    pageSize = RENDERS_PAGE_SIZE,
  }: { page?: number; pageSize?: number } = {}
): Promise<{
  renders: RenderWithContext[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const supabase = await createClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("renders")
    .select("*, uploads!inner(user_id, analyses(style, space_type))", {
      count: "exact",
    })
    .eq("uploads.user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Failed to list renders:", error.message);
    return { renders: [], totalCount: 0, page, pageSize, totalPages: 0 };
  }

  type Row = RenderRecord & {
    uploads?: { analyses?: { style: string; space_type: string }[] } | null;
  };
  const rows = (data ?? []) as Row[];

  const renders = await Promise.all(
    rows.map(async (row) => {
      const analysis = row.uploads?.analyses?.[0];
      const url = row.storage_path
        ? ((
            await supabase.storage
              .from("renders")
              .createSignedUrl(row.storage_path, 60 * 60)
          ).data?.signedUrl ?? null)
        : null;
      return {
        id: row.id,
        upload_id: row.upload_id,
        finishes: row.finishes,
        storage_path: row.storage_path,
        resolution: row.resolution,
        status: row.status,
        error_message: row.error_message,
        created_at: row.created_at,
        url,
        style: analysis?.style ?? null,
        spaceType: analysis?.space_type ?? null,
      };
    })
  );

  return {
    renders,
    totalCount: count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}
