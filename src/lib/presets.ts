// Curated, hardcoded style + palette bundles for one-click render styling.
// A preset overrides `style` and `finishes` together; spaceType is never
// touched since it's a fact about the uploaded room, not a style choice.

import type { PaletteSwatch } from "@/lib/types";

export type RenderPreset = {
  id: string;
  name: string;
  style: string;
  palette: PaletteSwatch[];
};

export const PRESETS: RenderPreset[] = [
  {
    id: "japandi-minimalism",
    name: "Japandi Minimalism",
    style: "Japandi Minimalism",
    palette: [
      { label: "walls", hex: "#E4DED0" },
      { label: "joinery", hex: "#2E2C28" },
      { label: "flooring", hex: "#A9835A" },
      { label: "ceiling", hex: "#F6F4EF" },
    ],
  },
  {
    id: "scandinavian-light",
    name: "Scandinavian Light",
    style: "Scandinavian Light",
    palette: [
      { label: "walls", hex: "#F7F4EF" },
      { label: "joinery", hex: "#FFFFFF" },
      { label: "flooring", hex: "#D9C3A0" },
      { label: "ceiling", hex: "#FFFFFF" },
    ],
  },
  {
    id: "industrial-loft",
    name: "Industrial Loft",
    style: "Industrial Loft",
    palette: [
      { label: "walls", hex: "#8B7E70" },
      { label: "joinery", hex: "#2A2A2A" },
      { label: "flooring", hex: "#6E4E33" },
      { label: "ceiling", hex: "#4B4B4B" },
    ],
  },
  {
    id: "mid-century-modern",
    name: "Mid-Century Modern",
    style: "Mid-Century Modern",
    palette: [
      { label: "walls", hex: "#E4D9BE" },
      { label: "joinery", hex: "#8A4B2E" },
      { label: "flooring", hex: "#A9713F" },
      { label: "ceiling", hex: "#EFE7D2" },
    ],
  },
  {
    id: "mediterranean-coastal",
    name: "Mediterranean Coastal",
    style: "Mediterranean Coastal",
    palette: [
      { label: "walls", hex: "#F5F1E6" },
      { label: "joinery", hex: "#2E6B70" },
      { label: "flooring", hex: "#C97B4A" },
      { label: "ceiling", hex: "#FFFFFF" },
    ],
  },
  {
    id: "modern-farmhouse",
    name: "Modern Farmhouse",
    style: "Modern Farmhouse",
    palette: [
      { label: "walls", hex: "#F8F6F1" },
      { label: "joinery", hex: "#1C1C1C" },
      { label: "flooring", hex: "#8A6A47" },
      { label: "ceiling", hex: "#F8F6F1" },
    ],
  },
  {
    id: "art-deco-glamour",
    name: "Art Deco Glamour",
    style: "Art Deco Glamour",
    palette: [
      { label: "walls", hex: "#1E1A22" },
      { label: "joinery", hex: "#C6A15B" },
      { label: "flooring", hex: "#14100F" },
      { label: "ceiling", hex: "#2A2430" },
    ],
  },
  {
    id: "desert-modern",
    name: "Desert Modern",
    style: "Desert Modern",
    palette: [
      { label: "walls", hex: "#E3C9A8" },
      { label: "joinery", hex: "#7A4B32" },
      { label: "flooring", hex: "#C7A47C" },
      { label: "ceiling", hex: "#EFE3D0" },
    ],
  },
  {
    id: "parisian-classic",
    name: "Parisian Classic",
    style: "Parisian Classic",
    palette: [
      { label: "walls", hex: "#F0EAE0" },
      { label: "joinery", hex: "#FFFFFF" },
      { label: "flooring", hex: "#8C6239" },
      { label: "ceiling", hex: "#FFFFFF" },
    ],
  },
  {
    id: "urban-contemporary",
    name: "Urban Contemporary",
    style: "Urban Contemporary",
    palette: [
      { label: "walls", hex: "#D9D9D6" },
      { label: "joinery", hex: "#1A1A1A" },
      { label: "flooring", hex: "#4A4A4A" },
      { label: "ceiling", hex: "#F2F2F0" },
    ],
  },
  {
    id: "bohemian-eclectic",
    name: "Bohemian Eclectic",
    style: "Bohemian Eclectic",
    palette: [
      { label: "walls", hex: "#D98B5F" },
      { label: "joinery", hex: "#4C6B4F" },
      { label: "flooring", hex: "#A9784F" },
      { label: "ceiling", hex: "#F1E4D3" },
    ],
  },
  {
    id: "dark-academia",
    name: "Dark Academia Study",
    style: "Dark Academia Study",
    palette: [
      { label: "walls", hex: "#2E241B" },
      { label: "joinery", hex: "#1A1410" },
      { label: "flooring", hex: "#5C3A21" },
      { label: "ceiling", hex: "#3B2E22" },
    ],
  },
  {
    id: "tropical-resort-modern",
    name: "Tropical Resort Modern",
    style: "Tropical Resort Modern",
    palette: [
      { label: "walls", hex: "#F4F0E6" },
      { label: "joinery", hex: "#2F4F3E" },
      { label: "flooring", hex: "#8A6239" },
      { label: "ceiling", hex: "#F4F0E6" },
    ],
  },
  {
    id: "minimalist-monochrome",
    name: "Minimalist Monochrome",
    style: "Minimalist Monochrome",
    palette: [
      { label: "walls", hex: "#FFFFFF" },
      { label: "joinery", hex: "#1A1A1A" },
      { label: "flooring", hex: "#D6D6D6" },
      { label: "ceiling", hex: "#FFFFFF" },
    ],
  },
];
