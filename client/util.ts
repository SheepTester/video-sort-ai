import { Rotation } from "./api";

export function extractFilename(path: string) {
  return path.split("/").pop() || path;
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

export function formatSeconds(seconds: number): string {
  const formatter = new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: "second",
    unitDisplay: "narrow",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(seconds);
}

export const rotToAngle: Record<Rotation, number> = {
  Unrotated: 0,
  Neg90: -90,
  Pos90: 90,
  Neg180: 180,
};
