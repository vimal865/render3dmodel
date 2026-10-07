// Same-origin download endpoint.
//
// The HTML `download` attribute is silently ignored on cross-origin URLs.
// Linking straight to a Supabase signed URL therefore opens the image in
// a tab instead of saving it — which breaks the last step of the core
// user journey, on every browser, without any error to explain it.
//
// Streaming the file through our own origin restores the attribute and
// lets us set a sensible filename at the same time.

import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/activity-log";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/renders/[id]/download">
) {
  try {
    const user = await requireAuth();
    const { id } = await ctx.params;

    const supabase = await createClient();

    // The join enforces ownership: RLS already restricts this, but the
    // explicit filter means a mistake in policy config can't quietly
    // expose another user's render.
    const { data: render, error } = await supabase
      .from("renders")
      .select("id, storage_path, resolution, created_at, uploads!inner(user_id)")
      .eq("id", id)
      .eq("uploads.user_id", user.id)
      .maybeSingle();

    if (error || !render?.storage_path) {
      return NextResponse.json({ error: "Render not found" }, { status: 404 });
    }

    const { data: file, error: downloadError } = await supabase.storage
      .from("renders")
      .download(render.storage_path);

    if (downloadError || !file) {
      return NextResponse.json(
        { error: "Could not read the render file" },
        { status: 500 }
      );
    }

    const ext = render.storage_path.split(".").pop() ?? "png";
    const stamp = new Date(render.created_at).toISOString().slice(0, 10);
    const filename = `renderdrop-${stamp}-${render.resolution}.${ext}`;

    await logEvent({
      event: "render.downloaded",
      userId: user.id,
      resourceType: "render",
      resourceId: render.id,
      metadata: { resolution: render.resolution, filename },
      request,
    });

    return new NextResponse(file, {
      headers: {
        "Content-Type": file.type || "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Download failed:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}
