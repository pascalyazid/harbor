import { Check, Play } from "lucide-react";
import { DragStrip } from "@/components/drag-strip";
import { Poster } from "@/components/poster";
import type { Meta } from "@/lib/cinemeta";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useSettings } from "@/lib/settings";
import { SPOILER_TEXT_CLASS, SPOILER_THUMB_CLASS, type SpoilerMask } from "@/lib/spoilers";
import { useView } from "@/lib/view";

type Progress = { ratio: number; watched: boolean; startedAt: number };

export function AnimeEpisodeStrip({
  meta,
  episodes,
  progressFor,
  spoilerFor,
  onContextMenu,
}: {
  meta: Meta;
  episodes: KitsuEpisode[];
  progressFor: (ep: KitsuEpisode) => Progress;
  spoilerFor?: (ep: KitsuEpisode) => SpoilerMask;
  onContextMenu?: (e: React.MouseEvent, season: number, episode: number, watched: boolean) => void;
}) {
  return (
    <DragStrip itemCount={episodes.length}>
      {episodes.map((ep) => (
        <AnimeEpisodeStripCard
          key={ep.id}
          meta={meta}
          ep={ep}
          progress={progressFor(ep)}
          spoiler={spoilerFor?.(ep)}
          onContextMenu={onContextMenu}
        />
      ))}
    </DragStrip>
  );
}

function AnimeEpisodeStripCard({
  meta,
  ep,
  progress,
  spoiler,
  onContextMenu,
}: {
  meta: Meta;
  ep: KitsuEpisode;
  progress: Progress;
  spoiler?: SpoilerMask;
  onContextMenu?: (e: React.MouseEvent, season: number, episode: number, watched: boolean) => void;
}) {
  const { openPicker } = useView();
  const { settings } = useSettings();
  return (
    <button
      data-ep={ep.number}
      data-no-card-ring
      onContextMenu={(e) => onContextMenu?.(e, ep.seasonNumber || 1, ep.number, progress.watched)}
      onClick={() =>
        openPicker(
          meta,
          {
            season: ep.seasonNumber || 1,
            episode: ep.number,
            name: ep.title,
            still: ep.thumbnail ?? undefined,
            overview: ep.synopsis || undefined,
            kitsuStreamId: ep.streamId,
            imdbId: ep.imdbId,
            imdbSeason: ep.imdbSeason,
            imdbEpisode: ep.imdbEpisode,
          },
          { autoPlay: settings.instantPlay },
        )
      }
      className="group flex w-[244px] shrink-0 flex-col gap-2.5 text-left"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl">
        <div className={spoiler?.thumb ? SPOILER_THUMB_CLASS : undefined}>
          <Poster src={ep.thumbnail ?? undefined} seed={String(ep.id)} ratio="landscape" className="" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-canvas/40 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-canvas">
            <Play size={16} fill="currentColor" />
          </div>
        </div>
        <span className="absolute left-2 top-2 rounded-md bg-canvas/95 px-1.5 py-0.5 text-[11px] font-semibold text-ink">
          {ep.number}
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
          {ep.title || `Episode ${ep.number}`}
        </span>
        <span className="text-[11.5px] text-ink-subtle">
          E{ep.number}
          {ep.length ? ` · ${ep.length} min` : ""}
        </span>
      </div>
    </button>
  );
}
