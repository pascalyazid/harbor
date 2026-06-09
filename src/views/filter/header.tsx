import { useEffect, useRef, useState } from "react";
import { Building2, Calendar, ChevronDown, Clock, Globe, Languages, Tag, Tv } from "lucide-react";
import { MOVIE_GENRES } from "@/lib/feed/tags";
import { useView, type MetaFilter } from "@/lib/view";
import { runtimeRange } from "./rails-config";

export function Header({ filter }: { filter: MetaFilter }) {
  const { kicker, title, subtitle, Icon } = describe(filter);
  return (
    <div className="relative px-12 pb-10 pt-28">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-elevated/70 text-ink-muted">
          <Icon size={16} strokeWidth={2} />
        </span>
        <span className="text-[12.5px] font-medium uppercase tracking-[0.22em] text-ink-subtle">
          {kicker}
        </span>
      </div>
      {filter.kind === "genre" ? (
        <GenreSwitcher activeName={title} mediaType={filter.mediaType} />
      ) : (
        <h1 className="mt-3 font-display text-[64px] font-medium leading-[0.95] tracking-tight text-ink">
          {title}
        </h1>
      )}
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">{subtitle}</p>
      {(filter.kind === "language" || filter.kind === "country") && (
        <MediaTypeToggle filter={filter} />
      )}
    </div>
  );
}

function MediaTypeToggle({ filter }: { filter: MetaFilter }) {
  const { openFilter } = useView();
  const set = (mediaType: "movie" | "tv") => {
    if (mediaType === filter.mediaType) return;
    openFilter({ ...filter, mediaType });
  };
  return (
    <div className="mt-5 inline-flex gap-1 rounded-full bg-elevated/50 p-1 ring-1 ring-edge-soft/60">
      {(["tv", "movie"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => set(m)}
          className={`rounded-full px-5 py-1.5 text-[13px] font-semibold transition-colors ${
            filter.mediaType === m
              ? "bg-ink text-canvas"
              : "text-ink-muted hover:bg-raised hover:text-ink"
          }`}
        >
          {m === "tv" ? "Shows" : "Movies"}
        </button>
      ))}
    </div>
  );
}

function GenreSwitcher({
  activeName,
  mediaType,
}: {
  activeName: string;
  mediaType: "movie" | "tv";
}) {
  const { openFilter } = useView();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  const names = Object.keys(MOVIE_GENRES);
  return (
    <div ref={wrapRef} className="relative mt-3 inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-3 text-left transition-colors"
      >
        <span className="font-display text-[64px] font-medium leading-[0.95] tracking-tight text-ink">
          {activeName}
        </span>
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-edge-soft text-ink-muted transition-[transform,background-color,color] ${
            open ? "rotate-180 bg-elevated text-ink" : "group-hover:bg-elevated/70 group-hover:text-ink"
          }`}
        >
          <ChevronDown size={18} strokeWidth={2.2} />
        </span>
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+12px)] z-30 grid max-h-[420px] w-[440px] grid-cols-2 gap-1 overflow-y-auto rounded-2xl border border-edge bg-surface/98 p-1.5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {names.map((name) => {
            const isActive = name === activeName;
            return (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setOpen(false);
                  openFilter({ kind: "genre", mediaType, name, id: MOVIE_GENRES[name] });
                }}
                className={`rounded-xl px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors ${
                  isActive
                    ? "bg-accent/15 text-accent"
                    : "text-ink-muted hover:bg-elevated hover:text-ink"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function describe(f: MetaFilter): {
  kicker: string;
  title: string;
  subtitle: string;
  Icon: typeof Tag;
} {
  const mediaWord = f.mediaType === "movie" ? "Movies" : "Shows";
  if (f.kind === "year") {
    return {
      kicker: f.mediaType === "movie" ? "Movies" : "TV Shows",
      title: `${f.value}`,
      subtitle: `Everything from ${f.value}, sorted across trending, top rated, and hidden gems.`,
      Icon: Calendar,
    };
  }
  if (f.kind === "runtime") {
    const range = runtimeRange(f.value);
    return {
      kicker: "Runtime",
      title: `Around ${f.value} min`,
      subtitle: `${mediaWord} between ${range.lo}-${range.hi} minutes. Pick a length, not a wall of options.`,
      Icon: Clock,
    };
  }
  if (f.kind === "studio") {
    return {
      kicker: "Studio",
      title: f.name,
      subtitle: `${mediaWord} produced by ${f.name}, ranked from biggest hits to overlooked gems.`,
      Icon: Building2,
    };
  }
  if (f.kind === "country") {
    return {
      kicker: "Country",
      title: f.name,
      subtitle: `${mediaWord} from ${f.name}: popular, acclaimed, and hidden alike.`,
      Icon: Globe,
    };
  }
  if (f.kind === "language") {
    return {
      kicker: "Language",
      title: f.name,
      subtitle: `${mediaWord} originally in ${f.name}, sorted across acclaim and hidden gems.`,
      Icon: Languages,
    };
  }
  if (f.kind === "network") {
    return {
      kicker: "Network",
      title: f.name,
      subtitle: `Series from ${f.name}: current hits, classics, and the deep cuts.`,
      Icon: Tv,
    };
  }
  return {
    kicker: f.mediaType === "movie" ? "Genre" : "TV Genre",
    title: f.name,
    subtitle: `The best ${f.name.toLowerCase()} ${mediaWord.toLowerCase()}, layered by mood. Browse trending, dive into a director's run, sort by decade, find quiet gems.`,
    Icon: Tag,
  };
}
