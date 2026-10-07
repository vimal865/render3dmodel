import { NextResponse } from "next/server";
import {
  requireAuth,
  AuthError,
  getProfile,
  updateProfile,
} from "@/lib/auth";
import { logEvent } from "@/lib/activity-log";

export async function GET() {
  try {
    const user = await requireAuth();
    const profile = await getProfile(user.id);
    return NextResponse.json({ profile, email: user.email });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Profile load failed:", err);
    return NextResponse.json(
      { error: "Could not load profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAuth();
    const body = await request.json();

    // Only these two fields are user-editable. Anything else in the body
    // is ignored rather than trusted — id and created_at must never be
    // settable from the client.
    const clean = (value: unknown, max: number): string | null => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed.slice(0, max);
    };

    const profile = await updateProfile(user.id, {
      display_name: clean(body.display_name, 80),
      studio_name: clean(body.studio_name, 120),
    });

    await logEvent({
      event: "profile.updated",
      userId: user.id,
      resourceType: "profile",
      resourceId: user.id,
      // Field names only, not values -- the log records that a change
      // happened, not the contents of the user's profile.
      metadata: {
        fieldsChanged: Object.keys(body ?? {}).filter((k) =>
          ["display_name", "studio_name"].includes(k)
        ),
      },
      request,
    });

    return NextResponse.json({ profile });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Profile update failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save profile" },
      { status: 500 }
    );
  }
}
