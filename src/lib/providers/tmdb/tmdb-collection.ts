import type { Meta } from "../../cinemeta";
import { get, IMG } from "./tmdb-client";

export type TmdbCollection = {
  id: number;
  name: string;
  overview: string;
  poster?: string;
  backdrop?: string;
  parts: Meta[];
};

const cache = new Map<number, Promise<TmdbCollection | null>>();

export function tmdbCollection(key: string, id: number): Promise<TmdbCollection | null> {
  if (!key || !Number.isFinite(id)) return Promise.resolve(null);
  const existing = cache.get(id);
  if (existing) return existing;
  const promise = run(key, id);
  cache.set(id, promise);
  return promise;
}

async function run(key: string, id: number): Promise<TmdbCollection | null> {
  const raw = await get<any>(key, `collection/${id}`);
  if (!raw) return null;
  const parts: Meta[] = (raw.parts ?? [])
    .map(
      (p: any): Meta => ({
        id: `tmdb:movie:${p.id}`,
        type: "movie",
        name: p.title ?? p.name ?? "",
        poster: p.poster_path ? `${IMG}/w342${p.poster_path}` : undefined,
        background: p.backdrop_path ? `${IMG}/w780${p.backdrop_path}` : undefined,
        description: p.overview,
        releaseInfo: (p.release_date ?? "").slice(0, 4) || undefined,
        releaseDate: p.release_date || undefined,
        imdbRating: p.vote_average > 0 ? Number(p.vote_average).toFixed(1) : undefined,
      }),
    )
    .sort((a: Meta, b: Meta) => (a.releaseDate ?? "zzz").localeCompare(b.releaseDate ?? "zzz"));
  return {
    id: raw.id,
    name: raw.name ?? "",
    overview: raw.overview ?? "",
    poster: raw.poster_path ? `${IMG}/w342${raw.poster_path}` : undefined,
    backdrop: raw.backdrop_path ? `${IMG}/original${raw.backdrop_path}` : undefined,
    parts,
  };
}
