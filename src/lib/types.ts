// Shared types for the upload -> analyze -> render pipeline.
// Keeping these in one file makes it easy to see the whole data shape
// at a glance, and to update DB + API + UI together when it changes.

export type PaletteSwatch = {
  label: string; // e.g. "walls", "joinery", "flooring", "ceiling"
  hex: string; // e.g. "#D8CFC0"
};

export type DesignScores = {
  perspective: number; // 0-100
  scale: number; // 0-100
  layout: number; // 0-100
  concept: number; // 0-100
};

// What Gemini Vision returns for an uploaded viewport export.
export type AnalysisResult = {
  style: string; // e.g. "Japandi Minimalism"
  spaceType: string; // e.g. "Living Space"
  scores: DesignScores;
  palette: PaletteSwatch[];
  caption: string; // one evocative sentence describing the space
};

export type UploadRecord = {
  id: string;
  user_id: string;
  storage_path: string;
  status: "uploaded" | "analyzed" | "failed";
  created_at: string;
};

export type AnalysisRecord = {
  id: string;
  upload_id: string;
  style: string;
  space_type: string;
  scores: DesignScores;
  palette: PaletteSwatch[];
  caption: string;
  created_at: string;
};

export type RenderRecord = {
  id: string;
  upload_id: string;
  finishes: PaletteSwatch[];
  storage_path: string | null;
  resolution: "1K" | "2K" | "4K";
  status: "pending" | "complete" | "failed";
  error_message: string | null;
  created_at: string;
};

// A render row enriched with its parent upload's analysis (style/space
// type) and a signed download URL, for the full renders gallery page.
export type RenderWithContext = RenderRecord & {
  url: string | null;
  style: string | null;
  spaceType: string | null;
};

// What the client sends when it's ready to generate the final render.
export type RenderRequestBody = {
  uploadId: string;
  style: string;
  spaceType: string;
  finishes: PaletteSwatch[];
  resolution?: "1K" | "2K" | "4K";
};
