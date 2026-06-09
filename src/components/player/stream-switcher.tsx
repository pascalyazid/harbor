import { Boxes, ChevronDown, Filter, Gauge, Languages, Loader2, MousePointerClick, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddonLogo, resolveAddonLogo } from "@/components/addon-logo";
import { FlagStack } from "@/components/flag";
import { FormatBadge, streamBadges, type BadgeKind } from "@/components/format-badge";
import { Tooltip } from "./transport/tooltip";
import { fetchInstalledAddons } from "@/lib/addon-store";
import { userAddons, type Addon } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import { peekPickerCache, subscribePickerCache } from "@/lib/picker-cache";
import { useSettings } from "@/lib/settings";
import type { ScoredStream } from "@/lib/streams/types";
import { addonInstanceKey, buildAddonOptions } from "@/views/play-picker/picker-utils";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";

function isHiddenAddon(addonId: string, addonName?: string): boolean {
  const id = (addonId || "").toLowerCase();
  const name = (addonName || "").toLowerCase();
  return id.includes("watchhub") || name.includes("watchhub");
}

type QualityKey =
  | "all"
  | "4K"
  | "1080p"
  | "720p"
  | "480p"
  | "SD"
  | "telecine"
  | "telesync"
  | "cam";

const QUALITY_ORDER: Exclude<QualityKey, "all">[] = [
  "4K",
  "1080p",
  "720p",
  "480p",
  "SD",
  "telecine",
  "telesync",
  "cam",
];

const QUALITY_LABEL: Record<Exclude<QualityKey, "all">, string> = {
  "4K": "4K UHD",
  "1080p": "1080p",
  "720p": "720p",
  "480p": "480p",
  SD: "SD",
  telecine: "Telecine",
  telesync: "Telesync",
  cam: "CAM",
};

const QUALITY_BADGE: Record<Exclude<QualityKey, "all">, BadgeKind> = {
  "4K": "4k-uhd",
  "1080p": "1080p",
  "720p": "720p",
  "480p": "480p",
  SD: "sd",
  telecine: "telecine",
  telesync: "telesync",
  cam: "cam",
};

function qualityKey(stream: ScoredStream): Exclude<QualityKey, "all"> {
  if (stream.source === "CAM") return "cam";
  if (stream.source === "TS" || stream.source === "HDTS") return "telesync";
  if (stream.source === "TC") return "telecine";
  if (stream.resolution === "4K") return "4K";
  if (stream.resolution === "1080p") return "1080p";
  if (stream.resolution === "720p") return "720p";
  if (stream.resolution === "480p") return "480p";
  return "SD";
}

export function StreamSwitcher({
  open,
  onClose,
  onPick,
  resolvingKey,
  currentUrl,
  debridSlugs,
  meta,
  episode,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (stream: ScoredStream) => void;
  resolvingKey: string | null;
  currentUrl: string;
  debridSlugs: string[];
  meta: Meta;
  episode?: PlayEpisode;
}) {
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const baseLangs = settings.preferredLanguages ?? [];
  const isAnimeRequest =
    typeof meta.id === "string" && (meta.id.startsWith("kitsu:") || meta.id.startsWith("mal:"));
  const preferredLangs = useMemo(() => {
    const codes = settings.preferredAudioLangs ?? [];
    const animeAdd = isAnimeRequest ? ["Japanese"] : [];
    const all = [...baseLangs, ...codes, ...animeAdd];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const lang of all) {
      const code = normalizeLangCode(lang);
      if (!isAnimeRequest && code === "ja") continue;
      if (seen.has(code)) continue;
      seen.add(code);
      out.push(lang);
    }
    return out;
  }, [baseLangs, settings.preferredAudioLangs, isAnimeRequest]);
  const [cache, setCache] = useState(() => peekPickerCache(meta, episode));
  const [addonLogos, setAddonLogos] = useState<Map<string, string | null>>(new Map());
  const [addonRank, setAddonRank] = useState<Map<string, number>>(new Map());
  const [filterToPreferred, setFilterToPreferred] = useState(
    settings.requirePreferredLanguage === true && preferredLangs.length > 0,
  );

  useEffect(
    () => subscribePickerCache(() => setCache(peekPickerCache(meta, episode))),
    [meta, episode],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const installed = await fetchInstalledAddons().catch(() => [] as Addon[]);
      const stremio = authKey ? await userAddons(authKey).catch(() => [] as Addon[]) : [];
      if (cancelled) return;
      const m = new Map<string, string | null>();
      const r = new Map<string, number>();
      const merged = [...installed, ...stremio];
      const seenId = new Set<string>();
      let idx = 0;
      for (const a of merged) {
        const id = a.manifest?.id;
        if (!id) continue;
        if (!seenId.has(id)) {
          seenId.add(id);
          r.set(id, idx++);
        }
        m.set(id, resolveAddonLogo(a.manifest.logo, a.transportUrl));
      }
      setAddonLogos(m);
      setAddonRank(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, authKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const keptStreams = useMemo<ScoredStream[]>(() => cache?.result.picker.all ?? [], [cache]);
  const rejectedStreams = useMemo<ScoredStream[]>(
    () =>
      (cache?.result.rejected ?? []).map((r) => ({
        ...r.stream,
        score: 0,
        reasons: [{ signal: `filtered:${r.reason}`, delta: 0 }],
        tier: "ROUGH" as const,
      })),
    [cache],
  );
  const [showFiltered, setShowFiltered] = useState(false);
  const allStreams = useMemo<ScoredStream[]>(
    () => (showFiltered ? [...keptStreams, ...rejectedStreams] : keptStreams),
    [keptStreams, rejectedStreams, showFiltered],
  );
  const cachedStreams = useMemo(
    () =>
      allStreams.filter(
        (s) =>
          s.url != null ||
          debridSlugs.some(
            (slug) => s.cached[slug as keyof typeof s.cached] || s.inLibrary[slug as keyof typeof s.inLibrary],
          ),
      ),
    [allStreams, debridSlugs],
  );
  const [cachedOnly, setCachedOnly] = useState(false);
  const baseList = cachedOnly && debridSlugs.length > 0 && cachedStreams.length > 0 ? cachedStreams : allStreams;
  const [addonFilter, setAddonFilter] = useState<string>("all");
  const [addonMenuOpen, setAddonMenuOpen] = useState(false);
  const [qualityFilter, setQualityFilter] = useState<QualityKey>("all");
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const qualityOptions = useMemo(() => {
    const counts = new Map<Exclude<QualityKey, "all">, number>();
    for (const s of allStreams) {
      const k = qualityKey(s);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return QUALITY_ORDER.filter((q) => (counts.get(q) ?? 0) > 0).map((q) => ({
      id: q,
      name: QUALITY_LABEL[q],
      count: counts.get(q) ?? 0,
      badge: QUALITY_BADGE[q],
    }));
  }, [allStreams]);
  useEffect(() => {
    if (qualityFilter !== "all" && !qualityOptions.some((o) => o.id === qualityFilter)) {
      setQualityFilter("all");
    }
  }, [qualityOptions, qualityFilter]);
  const addonOptions = useMemo(() => buildAddonOptions(allStreams), [allStreams]);
  useEffect(() => {
    if (addonFilter !== "all" && !addonOptions.some((o) => o.id === addonFilter)) {
      setAddonFilter("all");
    }
  }, [addonOptions, addonFilter]);
  const addonFilteredList = useMemo(() => {
    let list: ScoredStream[];
    if (addonFilter !== "all") {
      list = baseList.filter((s) => addonInstanceKey(s) === addonFilter);
    } else {
      list = baseList.filter((s) => !isHiddenAddon(s.addonId, s.addonName));
    }
    if (qualityFilter !== "all") {
      list = list.filter((s) => qualityKey(s) === qualityFilter);
    }
    if (addonFilter === "all") {
      list = list.slice().sort((a, b) => {
        const ar = addonRank.get(a.addonId) ?? 9999;
        const br = addonRank.get(b.addonId) ?? 9999;
        return ar - br;
      });
    }
    return list;
  }, [baseList, addonFilter, qualityFilter, addonRank]);
  const matchedStreams = useMemo(
    () =>
      preferredLangs.length === 0
        ? addonFilteredList
        : addonFilteredList.filter((s) => streamMatchesLangs(s, preferredLangs)),
    [addonFilteredList, preferredLangs],
  );
  const list = filterToPreferred && preferredLangs.length > 0 ? matchedStreams : addonFilteredList;
  const [showCount, setShowCount] = useState(80);
  useEffect(() => {
    setShowCount(80);
  }, [addonFilter, qualityFilter, filterToPreferred, cachedOnly, list.length]);
  const hiddenCount = addonFilteredList.length - matchedStreams.length;
  const uncachedHidden = allStreams.length - cachedStreams.length;
  const activeAddonName =
    addonFilter === "all" ? "All addons" : addonOptions.find((o) => o.id === addonFilter)?.name ?? addonFilter;
  void cache?.meta.name;
  void cache?.episode;

  if (!open) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[60] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex h-full max-h-[82vh] w-full max-w-[880px] flex-col overflow-hidden rounded-[8px] border border-edge bg-elevated/98 shadow-[0_28px_72px_-20px_rgba(0,0,0,0.85)] animate-in fade-in slide-in-from-bottom-2 duration-150 backdrop-blur-xl">
        <header className="flex items-center justify-between gap-4 border-b border-edge-soft px-6 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-ink-subtle">
              Switch stream
            </span>
            <span className="text-[14px] font-medium text-ink">
              {cache ? `${list.length} sources available` : "No sources cached"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {rejectedStreams.length > 0 && (
              <Tooltip label="Show sources hidden by the trust filter" side="bottom">
                <button
                  onClick={() => setShowFiltered((v) => !v)}
                  className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-[11.5px] font-semibold tracking-[0.04em] transition-colors ${
                    showFiltered
                      ? "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
                      : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
                  }`}
                  aria-pressed={showFiltered}
                >
                  <Filter size={11} strokeWidth={2.2} />
                  {showFiltered ? "Flagged shown" : `Show flagged (${rejectedStreams.length})`}
                </button>
              </Tooltip>
            )}
            {debridSlugs.length > 0 && uncachedHidden > 0 && (
              <button
                onClick={() => setCachedOnly((v) => !v)}
                className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-[11.5px] font-semibold tracking-[0.04em] transition-colors ${
                  cachedOnly
                    ? "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
                    : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
                }`}
                aria-pressed={cachedOnly}
              >
                <Zap size={11} fill={cachedOnly ? "currentColor" : "none"} strokeWidth={2.2} />
                {cachedOnly ? `Cached only (${uncachedHidden})` : "Cached only"}
              </button>
            )}
            {addonOptions.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setAddonMenuOpen((v) => !v)}
                  className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-[11.5px] font-semibold tracking-[0.04em] transition-colors ${
                    addonFilter !== "all"
                      ? "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
                      : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={addonMenuOpen}
                >
                  <Boxes size={13} strokeWidth={2.2} />
                  <span className="max-w-[140px] truncate">{activeAddonName}</span>
                  <ChevronDown
                    size={12}
                    strokeWidth={2.4}
                    className={`transition-transform duration-200 ${addonMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {addonMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 max-h-72 w-64 overflow-y-auto rounded-md border border-edge bg-elevated p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]">
                    <button
                      onClick={() => {
                        setAddonFilter("all");
                        setAddonMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-raised ${
                        addonFilter === "all" ? "text-ink font-semibold" : "text-ink-muted"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-raised text-ink-subtle">
                        <Boxes size={14} strokeWidth={2.2} />
                      </span>
                      <span className="flex-1 truncate">All addons</span>
                      <span className="text-[11px] tabular-nums text-ink-subtle">{allStreams.length}</span>
                    </button>
                    {addonOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setAddonFilter(opt.id);
                          setAddonMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-raised ${
                          addonFilter === opt.id ? "text-ink font-semibold" : "text-ink-muted"
                        }`}
                      >
                        <span className="shrink-0">
                          <AddonLogo
                            addonId={opt.id}
                            addonName={opt.name}
                            manifestLogo={addonLogos.get(opt.id) ?? null}
                            size="md"
                          />
                        </span>
                        <span className="flex-1 truncate">{opt.name}</span>
                        <span className="text-[11px] tabular-nums text-ink-subtle">{opt.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {qualityOptions.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setQualityMenuOpen((v) => !v)}
                  className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-[11.5px] font-semibold tracking-[0.04em] transition-colors ${
                    qualityFilter !== "all"
                      ? "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
                      : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
                  }`}
                  aria-haspopup="listbox"
                  aria-expanded={qualityMenuOpen}
                >
                  {qualityFilter === "all" ? (
                    <Gauge size={13} strokeWidth={2.2} />
                  ) : (
                    <FormatBadge kind={QUALITY_BADGE[qualityFilter as Exclude<QualityKey, "all">]} size="sm" />
                  )}
                  <span className="max-w-[120px] truncate">
                    {qualityFilter === "all"
                      ? "Any quality"
                      : QUALITY_LABEL[qualityFilter as Exclude<QualityKey, "all">]}
                  </span>
                  <ChevronDown
                    size={12}
                    strokeWidth={2.4}
                    className={`transition-transform duration-200 ${qualityMenuOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {qualityMenuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1.5 w-56 overflow-y-auto rounded-md border border-edge bg-elevated p-1.5 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]">
                    <button
                      onClick={() => {
                        setQualityFilter("all");
                        setQualityMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-raised ${
                        qualityFilter === "all" ? "text-ink font-semibold" : "text-ink-muted"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-raised text-ink-subtle">
                        <Gauge size={14} strokeWidth={2.2} />
                      </span>
                      <span className="flex-1 truncate">Any quality</span>
                      <span className="text-[11px] tabular-nums text-ink-subtle">{allStreams.length}</span>
                    </button>
                    {qualityOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setQualityFilter(opt.id);
                          setQualityMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[12.5px] transition-colors hover:bg-raised ${
                          qualityFilter === opt.id ? "text-ink font-semibold" : "text-ink-muted"
                        }`}
                      >
                        <span className="flex h-7 shrink-0 items-center justify-center">
                          <FormatBadge kind={opt.badge} size="sm" />
                        </span>
                        <span className="flex-1 truncate">{opt.name}</span>
                        <span className="text-[11px] tabular-nums text-ink-subtle">{opt.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {preferredLangs.length > 0 && hiddenCount > 0 && (
              <button
                onClick={() => setFilterToPreferred((v) => !v)}
                className={`flex h-9 items-center gap-2 rounded-md px-3.5 text-[11.5px] font-semibold tracking-[0.04em] transition-colors ${
                  filterToPreferred
                    ? "bg-elevated text-ink ring-1 ring-edge hover:bg-raised"
                    : "bg-raised text-ink-muted hover:bg-elevated hover:text-ink"
                }`}
                aria-pressed={filterToPreferred}
              >
                <Languages size={13} strokeWidth={2.2} />
                {filterToPreferred
                  ? `${abbreviateLanguages(preferredLangs)} only · ${hiddenCount} hidden`
                  : `Show ${abbreviateLanguages(preferredLangs)} only`}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-raised text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              aria-label="Close"
            >
              <X size={16} strokeWidth={2.2} />
            </button>
          </div>
        </header>

        {!cache || list.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-8 py-12 text-center text-[13.5px] text-ink-muted">
            Sources are not cached for this title. Open the picker page to refresh.
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-none [&::-webkit-scrollbar-thumb]:border-4 [&::-webkit-scrollbar-thumb]:border-solid [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-ink/25 [&::-webkit-scrollbar-thumb]:bg-clip-padding [&::-webkit-scrollbar-thumb:hover]:bg-ink/40">
            {list.slice(0, showCount).map((s, i) => (
              <SwitcherRow
                key={`${s.addonId}-${s.infoHash ?? s.url ?? i}`}
                stream={s}
                addonLogo={addonLogos.get(s.addonId) ?? null}
                onPick={() => onPick(s)}
                resolving={resolvingKey === streamKey(s)}
                divider={i > 0}
                isCurrent={s.url != null && s.url === currentUrl}
              />
            ))}
            {list.length > showCount && (
              <li className="border-t border-edge-soft/60 px-4 py-3">
                <button
                  onClick={() => setShowCount((n) => n + 80)}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-raised px-4 py-2.5 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
                >
                  Load more
                  <span className="text-[11px] tabular-nums text-ink-subtle">
                    {list.length - showCount} hidden
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}

        <footer className="flex items-center justify-between gap-4 border-t border-edge-soft px-6 py-2.5">
          <span className="flex items-center gap-2 text-[12px] text-ink-subtle">
            <MousePointerClick size={13} strokeWidth={2.2} />
            Click any source to swap in place
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-ink-subtle">
            <kbd className="inline-flex h-[18px] items-center justify-center rounded-[5px] border border-edge bg-raised px-1.5 font-sans text-[10.5px] font-semibold tracking-normal text-ink-muted">
              Esc
            </kbd>
            to close
          </span>
        </footer>
      </div>
    </div>
  );
}

function streamKey(s: ScoredStream): string {
  return s.infoHash ?? s.url ?? `${s.addonId}:${s.title ?? ""}`;
}

const FLAG_EMOJI_RX = /[\u{1F1E6}-\u{1F1FF}]{2}/gu;
function stripFlagEmoji(s: string): string {
  return s.replace(FLAG_EMOJI_RX, "").replace(/\s{2,}/g, " ").trim();
}

function SwitcherRow({
  stream,
  addonLogo,
  onPick,
  resolving,
  divider,
  isCurrent,
}: {
  stream: ScoredStream;
  addonLogo: string | null;
  onPick: () => void;
  resolving: boolean;
  divider: boolean;
  isCurrent: boolean;
}) {
  const addonName = stream.addonName ?? "Source";
  const headline = stripFlagEmoji(stream.name?.trim() || addonName) || addonName;
  const description = stripFlagEmoji(stream.title?.trim() || stream.description?.trim() || "");
  const cornerBadges = streamBadges(stream);
  const langs = stream.audioLanguages ?? [];
  const filterReason = stream.reasons?.find((r) => r.signal.startsWith("filtered:"))?.signal.slice(9);

  return (
    <li className={divider ? "border-t border-edge-soft/60" : ""}>
      <button
        onClick={onPick}
        disabled={resolving || isCurrent}
        className={`group flex w-full items-center gap-3.5 px-5 py-3 text-left transition-colors ${
          isCurrent
            ? "cursor-default bg-canvas/40"
            : "hover:bg-canvas/55 disabled:cursor-wait disabled:opacity-60"
        }`}
      >
        <AddonLogo
          addonId={stream.addonId}
          addonName={addonName}
          manifestLogo={addonLogo}
          size="xl"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="whitespace-pre-line text-[14px] font-semibold leading-snug text-ink">
            {headline}
          </p>
          {description && (
            <p className="whitespace-pre-line text-[12.5px] leading-snug text-ink-muted">
              {description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {filterReason && (
            <span
              title={`Hidden by filter: ${filterReason}`}
              className="rounded-md bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-danger ring-1 ring-danger/30"
            >
              Filtered
            </span>
          )}
          {langs.length > 0 && !isCurrent && (
            <FlagStack languages={langs} size="sm" max={3} />
          )}
          {cornerBadges.length > 0 && !isCurrent && (
            <span className="flex items-center gap-1">
              {cornerBadges.map((b) => (
                <FormatBadge key={b} kind={b} size="sm" />
              ))}
            </span>
          )}
          {isCurrent && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink ring-1 ring-edge">
              <Zap size={9} fill="currentColor" strokeWidth={0} />
              Now Playing
            </span>
          )}
          {resolving && <Loader2 size={13} className="animate-spin text-ink-muted" />}
        </div>
      </button>
    </li>
  );
}

function abbreviateLanguages(langs: string[]): string {
  if (langs.length === 0) return "";
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const l of langs) {
    const code = langCode(l);
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }
  return codes.join(", ");
}

function normalizeLangCode(s: string): string {
  const lower = s.trim().toLowerCase();
  if (lower === "jp") return "ja";
  const nameToCode: Record<string, string> = {
    english: "en", portuguese: "pt", spanish: "es", french: "fr",
    german: "de", italian: "it", japanese: "ja", korean: "ko",
    chinese: "zh", russian: "ru", hindi: "hi", arabic: "ar",
    dutch: "nl", polish: "pl", turkish: "tr", swedish: "sv",
    norwegian: "no", danish: "da", finnish: "fi", czech: "cs",
    hungarian: "hu", romanian: "ro", hebrew: "he", thai: "th",
    vietnamese: "vi", ukrainian: "uk",
  };
  if (nameToCode[lower]) return nameToCode[lower];
  return lower.slice(0, 2);
}

function langCode(name: string): string {
  const map: Record<string, string> = {
    English: "EN",
    Portuguese: "PT",
    Spanish: "ES",
    French: "FR",
    German: "DE",
    Italian: "IT",
    Japanese: "JA",
    Korean: "KO",
    Chinese: "ZH",
    Russian: "RU",
    Hindi: "HI",
    Arabic: "AR",
    Dutch: "NL",
    Polish: "PL",
    Turkish: "TR",
    Swedish: "SV",
    Norwegian: "NO",
    Danish: "DA",
    Finnish: "FI",
    Czech: "CS",
    Hungarian: "HU",
    Romanian: "RO",
    Hebrew: "HE",
    Thai: "TH",
    Vietnamese: "VI",
    Ukrainian: "UK",
  };
  return map[name] ?? name.slice(0, 2).toUpperCase();
}

function streamMatchesLangs(s: ScoredStream, prefs: string[]): boolean {
  if (s.audioLanguages.length === 0) return true;
  if (s.audioLanguages.includes("Multi")) return true;
  return s.audioLanguages.some((l) =>
    prefs.some(
      (p) => l.toLowerCase() === p.toLowerCase() || l.toLowerCase().startsWith(p.toLowerCase()),
    ),
  );
}
