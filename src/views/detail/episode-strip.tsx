import { Check, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DragStrip } from "@/components/drag-strip";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import type { Episode } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { SPOILER_TEXT_CLASS, SPOILER_THUMB_CLASS, type SpoilerMask } from "@/lib/spoilers";
import { useView } from "@/lib/view";

type Progress = { ratio: number; watched: boolean; startedAt: number };

export function EpisodeStrip({
  meta,
  episodes,
  progressFor,
  thumbnailFor,
  spoilerFor,
  onContextMenu,
}: {
  meta: Meta;
  episodes: Episode[];
  progressFor: (ep: Episode) => Progress;
  thumbnailFor: (ep: Episode) => string | undefined;
  spoilerFor?: (ep: Episode) => SpoilerMask;
  onContextMenu?: (e: React.MouseEvent, season: number, episode: number, watched: boolean) => void;
}) {
  return (
    <DragStrip itemCount={episodes.length}>
      {episodes.map((ep) => (
        <EpisodeStripCard
          key={ep.id}
          meta={meta}
          ep={ep}
          progress={progressFor(ep)}
          cinemetaThumbnail={thumbnailFor(ep)}
          spoiler={spoilerFor?.(ep)}
          onContextMenu={onContextMenu}
        />
      ))}
    </DragStrip>
  );
}

function EpisodeStripCard({
  meta,
  ep,
  progress,
  cinemetaThumbnail,
  spoiler,
  onContextMenu,
}: {
  meta: Meta;
  ep: Episode;
  progress: Progress;
  cinemetaThumbnail?: string;
  spoiler?: SpoilerMask;
  onContextMenu?: (e: React.MouseEvent, season: number, episode: number, watched: boolean) => void;
}) {
  const { openPicker } = useView();
  const { settings } = useSettings();
  const tmdbStill = ep.stillPath ? `https://image.tmdb.org/t/p/w300${ep.stillPath}` : undefined;
  const candidates = useMemo(
    () => [tmdbStill, cinemetaThumbnail].filter((u): u is string => !!u),
    [tmdbStill, cinemetaThumbnail],
  );
  const [imgIdx, setImgIdx] = useState(0);
  useEffect(() => {
    setImgIdx(0);
  }, [ep.id]);
  const still = candidates[imgIdx];
  return (
    <button
      data-ep={ep.episodeNumber}
      data-no-card-ring
      onContextMenu={(e) => onContextMenu?.(e, ep.seasonNumber, ep.episodeNumber, progress.watched)}
      onClick={() =>
        openPicker(
          meta,
          {
            season: ep.seasonNumber,
            episode: ep.episodeNumber,
            name: ep.name || undefined,
            still,
            overview: ep.overview || undefined,
          },
          { autoPlay: settings.instantPlay },
        )
      }
      className="group flex w-[244px] shrink-0 flex-col gap-2.5 text-left"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl">
        <div className={spoiler?.thumb ? SPOILER_THUMB_CLASS : undefined}>
          <Poster
            src={still}
            seed={String(ep.id)}
            ratio="landscape"
            className=""
            onError={() => setImgIdx((i) => i + 1)}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-canvas/40 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-canvas">
            <Play size={16} fill="currentColor" />
          </div>
        </div>
        <span className="absolute left-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
          {ep.episodeNumber}
        </span>
        {progress.watched && (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/22 text-emerald-200 ring-1 ring-emerald-400/40 backdrop-blur-sm">
            <Check size={12} strokeWidth={3} />
          </span>
        )}
        {progress.ratio > 0.01 && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-black/55">
            <div className="h-full bg-accent" style={{ width: `${Math.max(2, progress.ratio * 100)}%` }} />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-0.5">
        <span className={`truncate text-[13.5px] font-semibold text-ink ${spoiler?.title ? SPOILER_TEXT_CLASS : ""}`}>
          {ep.name || `Episode ${ep.episodeNumber}`}
        </span>
        <span className="text-[11.5px] text-ink-subtle">
          S{ep.seasonNumber} E{ep.episodeNumber}
          {ep.runtime ? ` · ${ep.runtime} min` : ""}
        </span>
      </div>
    </button>
  );
}
