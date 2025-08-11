import { Rotation, Video } from "./api";

export function extractFilename(video: Video) {
  return video.path.split("/").pop() || video.path;
}

export function formatSize(bytes: number): string {
  const k = 1000;
  if (bytes < k) {
    return `${bytes} B`;
  }
  const kb = bytes / k;
  if (kb < k) {
    return `${kb.toFixed(1)} kB`;
  }
  const mb = kb / k;
  if (mb < k) {
    return `${mb.toFixed(1)} MB`;
  }
  const gb = mb / k;
  if (gb < k) {
    return `${gb.toFixed(1)} GB`;
  }
  const tb = gb / k;
  return `${tb.toFixed(1)} TB`;
}

const secFmt = new Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "second",
  unitDisplay: "narrow",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function formatSeconds(seconds: number): string {
  return secFmt.format(seconds);
}

export function formatHms(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const hours = Math.floor(mins / 60);
  return `${hours.toString().padStart(2, "0")}:${(mins % 60)
    .toString()
    .padStart(2, "0")}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export const rotToAngle: Record<Rotation, number> = {
  Unrotated: 0,
  Neg90: -90,
  Pos90: 90,
  Neg180: 180,
};
