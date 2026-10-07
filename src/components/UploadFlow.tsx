"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalysisResult, PaletteSwatch } from "@/lib/types";
import { PRESETS } from "@/lib/presets";

type Step = "upload" | "analyzing" | "review" | "rendering" | "result";
type Resolution = "1K" | "2K" | "4K";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function UploadFlow({
  remainingRenders,
}: {
  remainingRenders: number;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [style, setStyle] = useState("");
  const [finishes, setFinishes] = useState<PaletteSwatch[]>([]);
  const [resolution, setResolution] = useState<Resolution>("2K");
  const [renderId, setRenderId] = useState<string | null>(null);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(remainingRenders);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URLs hold the file in memory until explicitly revoked. Without
  // this, rendering several models in one session leaks every image.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function replacePreview(url: string | null) {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return url;
    });
  }

  async function handleFileSelected(file: File) {
    // Validate before uploading. The server checks these too, but making
    // the user wait for a 15MB upload only to be told the file is too
    // large is a poor trade when the check is free on the client.
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("That file type isn't supported. Use a JPG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setError(
        `That file is ${mb}MB. The limit is 15MB — try exporting at a smaller size.`
      );
      return;
    }

    setError(null);
    replacePreview(URL.createObjectURL(file));
    setStep("analyzing");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok)
        throw new Error(data.error ?? "We couldn't analyse that image.");

      setUploadId(data.upload.id);
      setAnalysis(data.analysis);
      setStyle(data.analysis.style);
      setFinishes(data.analysis.palette);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("upload");
    }
  }

  async function handleGenerateRender() {
    if (!uploadId || !analysis) return;
    setError(null);
    setStep("rendering");

    try {
      const res = await fetch("/api/renders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId,
          style,
          spaceType: analysis.spaceType,
          finishes,
          resolution,
        }),
      });
      const data = await res.json();

      if (!res.ok)
        throw new Error(data.error ?? "We couldn't generate that render.");

      setRenderId(data.render.id);
      setRenderUrl(data.render.url);
      setRemaining((n) => Math.max(0, n - 1));
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("review");
    }
  }

  // Goes back to the review step with the same upload, analysis, style,
  // finishes, and resolution still in place — for retrying a render that
  // came out badly, or trying a different preset without re-uploading.
  function regenerate() {
    setError(null);
    setStep("review");
  }

  function reset() {
    replacePreview(null);
    setStep("upload");
    setUploadId(null);
    setAnalysis(null);
    setStyle("");
    setFinishes([]);
    setRenderId(null);
    setRenderUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const busy = step === "analyzing" || step === "rendering";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* aria-live so screen readers announce errors that appear without
          a page change or a focus move. */}
      <div aria-live="polite" className="contents">
        {error && (
          <p
            role="alert"
            className="border border-signal/40 bg-signal/10 px-4 py-3 font-body text-sm text-signal"
          >
            {error}
          </p>
        )}
      </div>

      {step === "upload" && (
        <>
          <UploadZone
            fileInputRef={fileInputRef}
            onFileSelected={handleFileSelected}
            disabled={remaining === 0}
          />
          <QuotaNote remaining={remaining} />
        </>
      )}

      {step === "analyzing" && (
        <ProgressPanel
          previewUrl={previewUrl}
          label="AI DESIGN INTELLIGENCE"
          title="Reading geometry, style, and palette"
          detail="Usually takes a few seconds."
        />
      )}

      {step === "review" && analysis && (
        <>
          <ReviewPanel
            previewUrl={previewUrl}
            analysis={analysis}
            style={style}
            onStyleChange={setStyle}
            finishes={finishes}
            onFinishesChange={setFinishes}
            resolution={resolution}
            onResolutionChange={setResolution}
            onGenerate={handleGenerateRender}
            onStartOver={reset}
            disabled={remaining === 0}
          />
          <QuotaNote remaining={remaining} />
        </>
      )}

      {step === "rendering" && (
        <ProgressPanel
          previewUrl={previewUrl}
          label="RENDERING"
          title={`Generating your ${resolution} photoreal render`}
          detail="Usually takes 8-20 seconds. Keep this tab open."
        />
      )}

      {step === "result" && renderUrl && renderId && (
        <div className="registration-marks border border-blueprint-lighter bg-blueprint-light/60 p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={renderUrl}
            alt={`Photorealistic ${analysis?.spaceType ?? "architectural"} render in ${analysis?.style ?? "the detected"} style`}
            className="w-full border border-blueprint-lighter object-contain"
          />
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* Routed through our own origin: the download attribute is
                ignored on cross-origin URLs, so linking straight to the
                signed storage URL opens the image instead of saving it. */}
            <a
              href={`/api/renders/${renderId}/download`}
              className="bg-signal px-4 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90"
            >
              Download {resolution}
            </a>
            <button
              onClick={regenerate}
              disabled={remaining === 0}
              className="border border-blueprint-lighter px-4 py-2.5 font-display text-sm text-linework transition-colors hover:border-cyan-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              Regenerate
            </button>
            <button
              onClick={reset}
              className="border border-blueprint-lighter px-4 py-2.5 font-display text-sm text-linework transition-colors hover:border-cyan-accent"
            >
              Render another
            </button>
          </div>
          <QuotaNote remaining={remaining} />
        </div>
      )}

      {busy && (
        <p className="sr-only" role="status">
          Working. Please wait.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuotaNote({ remaining }: { remaining: number }) {
  if (remaining === 0) {
    return (
      <p className="font-tech text-xs text-signal">
        Daily render limit reached. It resets 24 hours after your first render
        today.
      </p>
    );
  }
  return (
    <p className="font-tech text-xs text-graphite">
      {remaining} render{remaining === 1 ? "" : "s"} left today
    </p>
  );
}

function ProgressPanel({
  previewUrl,
  label,
  title,
  detail,
}: {
  previewUrl: string | null;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="registration-marks border border-blueprint-lighter bg-blueprint-light/60 p-8 text-center">
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Your uploaded model"
          className="mx-auto mb-6 max-h-64 border border-blueprint-lighter object-contain"
        />
      )}
      <p className="font-tech text-xs tracking-widest text-cyan-accent">
        {label}
      </p>
      <p className="mt-2 font-display text-lg text-linework">{title}</p>
      <p className="mt-1 font-body text-sm text-graphite">{detail}</p>
      <div
        className="mx-auto mt-5 h-0.5 w-40 overflow-hidden bg-blueprint-lighter"
        aria-hidden="true"
      >
        <div className="loading-bar h-full w-1/3 bg-cyan-accent" />
      </div>
    </div>
  );
}

function UploadZone({
  fileInputRef,
  onFileSelected,
  disabled,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelected: (file: File) => void;
  disabled: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  function open() {
    if (!disabled) fileInputRef.current?.click();
  }

  return (
    // A div with onClick is invisible to keyboard and screen-reader users.
    // Given a button role, it needs the matching keyboard contract too.
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Upload your SketchUp viewport export"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        const file = e.dataTransfer.files?.[0];
        if (file) onFileSelected(file);
      }}
      onClick={open}
      className={`registration-marks blueprint-grid border p-16 text-center transition-colors focus:outline-none focus-visible:border-cyan-accent focus-visible:ring-2 focus-visible:ring-cyan-accent/50 ${
        disabled
          ? "cursor-not-allowed border-blueprint-lighter bg-blueprint-light/20 opacity-60"
          : dragging
            ? "cursor-pointer border-cyan-accent bg-blueprint-light"
            : "cursor-pointer border-blueprint-lighter bg-blueprint-light/40 hover:border-cyan-accent/60"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelected(file);
        }}
      />
      <p className="font-tech text-xs tracking-widest text-cyan-accent">
        UPLOAD · SKETCHUP EXPORT
      </p>
      <p className="mt-3 font-display text-xl font-semibold text-linework">
        {disabled ? "Daily limit reached" : "Drop your viewport export"}
      </p>
      <p className="mt-2 font-body text-sm text-graphite">
        {disabled
          ? "Come back tomorrow to render again."
          : "JPG, PNG, or WebP · any angle · up to 15MB"}
      </p>
    </div>
  );
}

type PresetOption = { id: string; label: string; palette: PaletteSwatch[] };

// A native <select> can't render colored swatches inside its <option>
// list, so this is a button + popover list we style ourselves — same
// interaction shape as a select, but each row can show its palette dots.
function PresetDropdown({
  selectedId,
  options,
  onSelect,
}: {
  selectedId: string;
  options: PresetOption[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === selectedId) ?? options[0];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 border border-blueprint-lighter bg-blueprint px-3 py-2 font-tech text-xs text-linework transition-colors hover:border-cyan-accent/60"
      >
        <PresetDots palette={selected.palette} />
        {selected.label}
        <span aria-hidden="true" className="text-graphite">
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Style presets"
          className="absolute z-10 mt-1 max-h-72 w-72 overflow-y-auto border border-blueprint-lighter bg-blueprint-light shadow-lg"
        >
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
                aria-selected={option.id === selectedId}
                onClick={() => {
                  onSelect(option.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left font-tech text-xs transition-colors ${
                  option.id === selectedId
                    ? "bg-blueprint text-linework"
                    : "text-graphite hover:bg-blueprint/60 hover:text-linework"
                }`}
              >
                <PresetDots palette={option.palette} />
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PresetDots({ palette }: { palette: PaletteSwatch[] }) {
  return (
    <span className="flex items-center gap-1" aria-hidden="true">
      {palette.map((swatch, i) => (
        <span
          key={`${swatch.label}-${i}`}
          className="h-2.5 w-2.5 rounded-full border border-blueprint-lighter/60"
          style={{ backgroundColor: swatch.hex }}
        />
      ))}
    </span>
  );
}

function ReviewPanel({
  previewUrl,
  analysis,
  style,
  onStyleChange,
  finishes,
  onFinishesChange,
  resolution,
  onResolutionChange,
  onGenerate,
  onStartOver,
  disabled,
}: {
  previewUrl: string | null;
  analysis: AnalysisResult;
  style: string;
  onStyleChange: (s: string) => void;
  finishes: PaletteSwatch[];
  onFinishesChange: (f: PaletteSwatch[]) => void;
  resolution: Resolution;
  onResolutionChange: (r: Resolution) => void;
  onGenerate: () => void;
  onStartOver: () => void;
  disabled: boolean;
}) {
  const scoreEntries = Object.entries(analysis.scores) as [
    keyof AnalysisResult["scores"],
    number,
  ][];
  const selectedPresetId = PRESETS.find((p) => p.style === style)?.id ?? "ai";

  return (
    <div className="registration-marks border border-blueprint-lighter bg-blueprint-light/60 p-6">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="Your uploaded model"
            className="h-full max-h-56 w-full border border-blueprint-lighter object-cover"
          />
        )}

        <div>
          <p className="font-tech text-xs tracking-widest text-cyan-accent">
            AI DESIGN INTELLIGENCE · ANALYSIS COMPLETE
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-linework">
            {analysis.style}
          </p>
          <p className="font-body text-sm text-graphite">{analysis.spaceType}</p>

          <dl className="mt-4 grid grid-cols-4 gap-3 font-tech text-xs">
            {scoreEntries.map(([label, value]) => (
              <div key={label}>
                <dt className="uppercase tracking-wide text-graphite">
                  {label}
                </dt>
                <dd className="mt-0.5 text-lg text-cyan-accent">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 font-body text-sm italic leading-relaxed text-linework/90">
            &ldquo;{analysis.caption}&rdquo;
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-blueprint-lighter pt-6">
        <p className="font-tech text-xs uppercase tracking-widest text-graphite">
          Style presets · style + palette, one click
        </p>
        <div className="mt-3">
          <PresetDropdown
            selectedId={selectedPresetId}
            options={[
              { id: "ai", label: `AI Suggested — ${analysis.style}`, palette: analysis.palette },
              ...PRESETS.map((preset) => ({
                id: preset.id,
                label: preset.name,
                palette: preset.palette,
              })),
            ]}
            onSelect={(id) => {
              if (id === "ai") {
                onStyleChange(analysis.style);
                onFinishesChange(analysis.palette);
                return;
              }
              const preset = PRESETS.find((p) => p.id === id);
              if (preset) {
                onStyleChange(preset.style);
                onFinishesChange(preset.palette);
              }
            }}
          />
        </div>
      </div>

      <div className="mt-6 border-t border-blueprint-lighter pt-6">
        <p className="font-tech text-xs uppercase tracking-widest text-graphite">
          Finish palette · edit before rendering
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {finishes.map((swatch, i) => (
            <div key={`${swatch.label}-${i}`} className="flex flex-col gap-1.5">
              <label
                htmlFor={`finish-${i}`}
                className="font-tech text-xs text-graphite"
              >
                {swatch.label}
              </label>
              <span className="flex items-center gap-2 border border-blueprint-lighter bg-blueprint px-2 py-1.5">
                <input
                  id={`finish-${i}`}
                  type="color"
                  value={swatch.hex}
                  onChange={(e) => {
                    const next = [...finishes];
                    next[i] = { ...next[i], hex: e.target.value };
                    onFinishesChange(next);
                  }}
                  className="h-5 w-5 cursor-pointer border-none bg-transparent p-0"
                />
                <span className="font-tech text-xs text-linework">
                  {swatch.hex}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-blueprint-lighter pt-6">
        <div className="flex items-center gap-3">
          <label
            htmlFor="resolution"
            className="font-tech text-xs uppercase tracking-wide text-graphite"
          >
            Resolution
          </label>
          <select
            id="resolution"
            value={resolution}
            onChange={(e) => onResolutionChange(e.target.value as Resolution)}
            className="border border-blueprint-lighter bg-blueprint px-2 py-1.5 font-tech text-xs text-linework"
          >
            <option value="1K">1K</option>
            <option value="2K">2K</option>
            <option value="4K">4K</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onStartOver}
            className="border border-blueprint-lighter px-4 py-2.5 font-display text-sm text-linework transition-colors hover:border-cyan-accent"
          >
            Start over
          </button>
          <button
            onClick={onGenerate}
            disabled={disabled}
            className="bg-signal px-5 py-2.5 font-display text-sm font-semibold text-blueprint transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve &amp; render
          </button>
        </div>
      </div>
    </div>
  );
}
