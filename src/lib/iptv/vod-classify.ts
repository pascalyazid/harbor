import type { IptvChannel } from "./types";
import { parseSeriesEpisode } from "./vod-title";

export type VodKind = "live" | "movie" | "series";

const VOD_EXT_RE = /\.(mkv|mp4|avi|m4v|mov|flv|wmv|mpg|mpeg|webm)(\?|$)/i;
const LIVE_EXT_RE = /\.(ts|m3u8)(\?|$)/i;
const MOVIE_GROUP_RE = /\b(vod|movie|movies|film|films|cinema|pel[ií]culas?|filme)\b/i;
const SERIES_GROUP_RE = /\b(serie|series|s[ée]ries|tv ?show|tv ?shows|staffel|temporada)\b/i;

export function classifyChannel(ch: IptvChannel): VodKind {
  const url = ch.url || "";
  const group = ch.group || "";
  const name = ch.name || "";
  const declared = (ch.attrs["tvg-type"] || ch.attrs["type"] || "").toLowerCase();

  if (declared === "movie") return "movie";
  if (declared === "series") return "series";

  if (/\/series\//i.test(url)) return "series";
  if (/\/movie\//i.test(url)) return "movie";
  if (/\/live\//i.test(url)) return "live";

  if (parseSeriesEpisode(name)) return "series";

  const vodExt = VOD_EXT_RE.test(url);
  const liveExt = LIVE_EXT_RE.test(url);

  if (SERIES_GROUP_RE.test(group) && !liveExt) return "series";
  if (MOVIE_GROUP_RE.test(group) && !liveExt) return "movie";

  if (vodExt && !liveExt) return "movie";
  return "live";
}
