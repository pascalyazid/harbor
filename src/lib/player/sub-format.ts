import type { TrackInfo } from "./bridge";

export function isAssTrack(track: TrackInfo | null | undefined): boolean {
  if (!track) return false;
  const codec = (track.codec ?? "").toUpperCase();
  if (
    codec.includes("ASS") ||
    codec.includes("SSA") ||
    codec.includes("SUBSTATION") ||
    codec.includes("SUB STATION")
  ) {
    return true;
  }
  const title = (track.title ?? "").toLowerCase();
  return /\.(ass|ssa)$/.test(title);
}
