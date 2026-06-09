import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Play, Plus, Star } from "lucide-react";
import { animeDetails, franchiseTags, type FranchiseEntry } from "@/lib/providers/anime-detail";
import { imdbToKitsu } from "@/lib/providers/anime-mapping";
import { stripFranchiseSuffix } from "@/lib/providers/jikan";
import type { KitsuEpisode, KitsuStreamer } from "@/lib/providers/kitsu";
import { AnimeAwardsBlock } from "@/components/anime-awards-block";
import { AwardsBlock } from "@/components/awards-block";
import { BackToTop } from "@/components/back-to-top";
import { LazyMount } from "@/components/lazy-mount";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { MalLogo } from "@/components/icons/mal-logo";
import { PickCard } from "@/components/pick-card";
import { Row } from "@/components/row";
import { RtBadge } from "@/components/rt-badge";
import { meta as fetchCinemetaMeta, narrowMediaType, isAddonNativeMeta, type Meta } from "@/lib/cinemeta";
import { lastPlayedEpisode, readResumeEntry, saveResumeMs } from "@/lib/resume";
import { omdbPrefetch, omdbScores, type OmdbScores } from "@/lib/providers/omdb";
import { awardSummary, useAwards } from "@/lib/providers/wikidata";
import { mergeBundledAwards } from "@/lib/awards-history";
import {
  tmdbDetails,
  tmdbImdbId,
  tmdbWatchProviders,
  type TmdbDetail,
  type WatchProvider,
} from "@/lib/providers/tmdb";
import { cinemetaDetails } from "@/lib/providers/cinemeta-details";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { libraryGetOne, type LibraryItem } from "@/lib/stremio";
import { decodeWatchedEpisodes } from "@/lib/stremio-watched";
import { useTogether } from "@/lib/together/provider";
import { useTrakt } from "@/lib/trakt/provider";
import { toggleWatchlist, useInWatchlist } from "@/lib/watchlist";
import { useIsFavorite, useMediaFavorites } from "@/lib/media-favorites";
import { openUrl } from "@/lib/window";
import { profileFromDetail, trackEvent } from "@/lib/discover";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { useScrollMemory, useView } from "@/lib/view";
import { AddToAnilistButton } from "./detail/add-to-anilist-button";
import { AddToSimklButton } from "./detail/add-to-simkl-button";
import { CollectionRow } from "./detail/collection-row";
import { EpisodeDownloadButton } from "./detail/episode-download-button";
import { isTitleUpcoming } from "./detail/helpers";
import { HeroAwardsCorner } from "./detail/hero-awards";
import { CrunchyrollAwardsCorner } from "./detail/crunchyroll-corner";
import { findAnyAwardWins, parseAwardYear } from "@/lib/anime-awards";

function animeAwardLookupName(
  releaseYear: number | undefined,
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const c of candidates) {
    if (!c) continue;
    if (findAnyAwardWins(c, releaseYear).length > 0) return c;
  }
  return null;
}
import { Pill } from "./detail/pill";
import { Credit } from "./detail/credit";
import { TitlePlate } from "./detail/title-plate";
import { PlayModeHint } from "./detail/play-mode-hint";
import { UpcomingCta } from "./detail/upcoming-cta";
import { Synopsis } from "./detail/synopsis";
import { CastCard } from "./detail/cast-card";
import { PreviewIcon } from "./detail/preview-icon";
import { TrailerOverlay } from "./detail/trailer-overlay";
import { SeriesEpisodes } from "./detail/series-episodes";
import { CinemetaEpisodes } from "./detail/cinemeta-episodes";
import { AnimeEpisodes } from "./detail/anime-episodes";
import { StreamingLinks } from "./detail/streaming-links";
import { WatchOn } from "./detail/watch-on";
import { InfoBlock } from "./detail/info-block";

export function DetailView({ meta, liveContext = false }: { meta: Meta; liveContext?: boolean }) {
  const { settings } = useSettings();
  const [detail, setDetail] = useState<TmdbDetail | null>(null);
  const [animeEpisodes, setAnimeEpisodes] = useState<KitsuEpisode[]>([]);
  const [franchise, setFranchise] = useState<FranchiseEntry[]>([]);
  const [animeCanonicalId, setAnimeCanonicalId] = useState<string | null>(null);
  const [detectedKitsu, setDetectedKitsu] = useState<number | null>(null);
  const [streamers, setStreamers] = useState<KitsuStreamer[]>([]);
  const [backdrops, setBackdrops] = useState<string[]>([]);
  const [backdropIdx, setBackdropIdx] = useState(0);
  const [cinemetaFull, setCinemetaFull] = useState<Meta | null>(
    meta.videos && meta.videos.length > 0 ? meta : null,
  );
  const [libraryItem, setLibraryItem] = useState<LibraryItem | null>(null);
  const { authKey } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [scores, setScores] = useState<OmdbScores | null>(null);
  const [watchProviders, setWatchProviders] = useState<WatchProvider[]>([]);
  const scrollRef = useRef<HTMLElement>(null);

  const { openPicker, openFilter, promoteMetaToRoot } = useView();
  const { snapshot: roomSnapshot, claimHost } = useTogether();
  const { isConnected: traktConnected } = useTrakt();
  const inWatchlist = useInWatchlist(meta.id, [detail?.imdbId]);
  const { toggle: toggleFavorite } = useMediaFavorites();
  const isFav = useIsFavorite(meta.id, [detail?.imdbId]);
  const inSession = roomSnapshot.state === "joined" && roomSnapshot.participants.length >= 2;
  useScrollMemory(`meta:${meta.id}`, scrollRef);
  const idAnime = meta.id.startsWith("kitsu:") || meta.id.startsWith("mal:");
  const isAnime = idAnime || detectedKitsu != null;
  const stickyAwardName = useRef<string | null>(null);
  useEffect(() => {
    stickyAwardName.current = null;
  }, [meta.id]);
  const addonNative = liveContext || isAddonNativeMeta(meta);
  const trailerCandidate =
    detail?.trailerCandidates?.[0] ?? meta.trailerStreams?.[0]?.ytId ?? null;

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setAnimeEpisodes([]);
    setFranchise([]);
    setAnimeCanonicalId(null);
    setDetectedKitsu(null);
    setStreamers([]);
    setBackdrops([]);
    setBackdropIdx(0);
    setCinemetaFull(meta.videos && meta.videos.length > 0 ? meta : null);
    if (meta.id.startsWith("tt") && !addonNative) {
      fetchCinemetaMeta(narrowMediaType(meta.type), meta.id)
        .then((full) => {
          if (cancelled || !full) return;
          setCinemetaFull(full);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, addonNative]);

  useEffect(() => {
    if (idAnime || detectedKitsu != null || addonNative) return;
    const imdb = meta.id.startsWith("tt")
      ? meta.id
      : detail?.imdbId?.startsWith("tt")
        ? detail.imdbId
        : null;
    if (!imdb) return;
    let cancelled = false;
    imdbToKitsu(imdb)
      .then((k) => {
        if (!cancelled && k != null) setDetectedKitsu(k);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [idAnime, detectedKitsu, addonNative, meta.id, detail?.imdbId]);

  useEffect(() => {
    if (meta.type !== "series") return;
    const imdb =
      meta.id.startsWith("tt") ? meta.id : detail?.imdbId?.startsWith("tt") ? detail.imdbId : null;
    if (!imdb) return;
    if (cinemetaFull?.videos && cinemetaFull.videos.length > 0) return;
    let cancelled = false;
    fetchCinemetaMeta(narrowMediaType(meta.type), imdb)
      .then((full) => {
        if (cancelled || !full) return;
        setCinemetaFull(full);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta.id, detail?.imdbId, meta.type, cinemetaFull?.videos?.length]);

  useEffect(() => {
    setLibraryItem(null);
    if (!authKey) return;
    const lookupId =
      meta.id.startsWith("tt") ? meta.id : detail?.imdbId?.startsWith("tt") ? detail.imdbId : null;
    if (!lookupId) return;
    let cancelled = false;
    libraryGetOne(authKey, lookupId)
      .then((item) => {
        if (cancelled) return;
        setLibraryItem(item);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authKey, meta.id, detail?.imdbId]);

  const stremioWatched = useMemo(
    () => decodeWatchedEpisodes(libraryItem?.state?.watched, cinemetaFull?.videos),
    [libraryItem?.state?.watched, cinemetaFull?.videos],
  );

  useEffect(() => {
    if (!libraryItem?.state) return;
    const st = libraryItem.state;
    if (!st.timeOffset || st.timeOffset <= 0) return;
    const stremioT = Date.parse(libraryItem._mtime ?? "");
    if (!Number.isFinite(stremioT)) return;
    if (libraryItem.type === "movie") {
      const local = readResumeEntry(meta.id);
      if (!local || stremioT > local.t) {
        saveResumeMs(meta.id, st.timeOffset);
        if (import.meta.env.DEV)
          console.info(`[stremio-resume] movie ${meta.id}: synced ${st.timeOffset}ms from Stremio (mtime=${libraryItem._mtime})`);
      }
      return;
    }
    if (libraryItem.type === "series" && st.season && st.episode) {
      const local = readResumeEntry(meta.id, st.season, st.episode);
      if (!local || stremioT > local.t) {
        saveResumeMs(meta.id, st.timeOffset, st.season, st.episode);
        if (import.meta.env.DEV)
          console.info(`[stremio-resume] series ${meta.id} S${st.season}E${st.episode}: synced ${st.timeOffset}ms from Stremio (mtime=${libraryItem._mtime})`);
      }
    }
  }, [libraryItem, meta.id]);

  useEffect(() => {
    let cancelled = false;
    if (addonNative) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const work = isAnime
      ? animeDetails(settings, detectedKitsu != null ? { ...meta, id: `kitsu:${detectedKitsu}` } : meta).then((res) => {
          if (cancelled || !res) return null;
          setAnimeEpisodes(res.episodes);
          setFranchise(res.franchise);
          setAnimeCanonicalId(`kitsu:${res.kitsuId}`);
          setStreamers(res.streamers);
          setBackdrops(res.backdrops);
          return res.detail;
        })
      : settings.tmdbKey
        ? tmdbDetails(settings.tmdbKey, meta).then((d) =>
            d ?? cinemetaDetails(meta),
          )
        : cinemetaDetails(meta);
    work
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meta.id, meta.type, settings, isAnime, addonNative, detectedKitsu]);

  useEffect(() => {
    if (!detail) return;
    const profile = profileFromDetail(detail);
    trackEvent(meta.id, "open", profile);
    const t = setTimeout(() => trackEvent(meta.id, "dwell", profile), 8000);
    return () => clearTimeout(t);
  }, [detail, meta.id]);

  useEffect(() => {
    setScores(null);
    const imdbId = detail?.imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);
    if (!imdbId || !settings.omdbKey) return;
    let cancelled = false;
    omdbScores(settings.omdbKey, imdbId).then((s) => {
      if (!cancelled) setScores(s);
    });
    return () => {
      cancelled = true;
    };
  }, [detail?.imdbId, meta.id, settings.omdbKey]);

  useEffect(() => {
    if (!settings.omdbKey || !detail) return;
    const queue = [...detail.recommendations.slice(0, 6), ...detail.similar.slice(0, 6)];
    for (const m of queue) {
      tmdbImdbId(settings.tmdbKey, m.id).then((id) => {
        if (id) omdbPrefetch(settings.omdbKey, id);
      });
    }
  }, [detail, settings.tmdbKey, settings.omdbKey]);

  useEffect(() => {
    if (backdrops.length < 2) return;
    const id = window.setInterval(() => {
      setBackdropIdx((i) => (i + 1) % backdrops.length);
    }, 12000);
    return () => window.clearInterval(id);
  }, [backdrops]);

  useEffect(() => {
    setWatchProviders([]);
    if (isAnime || !settings.tmdbKey || !detail) return;
    const k = detail.kind;
    if ((k !== "movie" && k !== "tv") || !Number.isFinite(Number(detail.id))) return;
    let cancelled = false;
    tmdbWatchProviders(settings.tmdbKey, k, detail.id, settings.region)
      .then((p) => {
        if (!cancelled) setWatchProviders(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [detail, isAnime, settings.tmdbKey, settings.region]);

  const rawTitle = detail?.title ?? meta.name;
  const title = isAnime ? stripFranchiseSuffix(rawTitle) : rawTitle;
  const overview = detail?.overview ?? meta.description ?? "";
  const tagline = detail?.tagline ?? "";
  const backdrop = backdrops[backdropIdx] ?? detail?.backdrop ?? meta.background ?? meta.poster;
  const logo = detail?.logo ?? meta.logo;
  const year = detail?.year ?? meta.releaseInfo;
  const releaseYearNum = parseAwardYear(year);
  const rating = detail?.rating ?? meta.imdbRating;
  const runtime = detail?.runtime;
  const genres = detail?.genres ?? meta.genres ?? [];
  const recommendations = detail?.recommendations ?? [];
  const similar = detail?.similar ?? [];
  const liveAwards = useAwards(detail?.imdbId ?? undefined);
  const awards = useMemo(
    () => mergeBundledAwards(liveAwards, meta.name, releaseYearNum ?? undefined),
    [liveAwards, meta.name, releaseYearNum],
  );
  const heroAwardSummary = awardSummary(awards).slice(0, 2);
  const isSeries = detail?.kind != null
    ? detail.kind === "tv"
    : meta.type === "series";
  const playMeta: Meta = {
    ...meta,
    name: title,
    logo,
    background: backdrop,
    releaseDate: detail?.releaseDate ?? meta.releaseDate,
    releaseInfo: detail?.year ?? meta.releaseInfo,
  };
  const upcoming = !loading && isTitleUpcoming(detail, meta);
  const currentFranchiseId = animeCanonicalId ?? meta.id;
  const franchiseIdx = isAnime
    ? franchise.findIndex((f) => f.meta.id === currentFranchiseId)
    : -1;
  const showSeasonPill = isAnime && franchise.length > 1 && franchiseIdx >= 0;
  const seasonPillTags = showSeasonPill ? franchiseTags(franchise) : [];
  const seasonPillCount = seasonPillTags.filter((t) => t.kind === "season").length;
  const seasonPillTag = seasonPillTags[franchiseIdx];
  const seasonPillLabel = !seasonPillTag
    ? ""
    : seasonPillTag.kind === "movie"
      ? "Movie"
      : seasonPillCount > 1
        ? `Season ${seasonPillTag.seasonNum} of ${seasonPillCount}`
        : `Season ${seasonPillTag.seasonNum}`;

  const lastPlay = useMemo(() => {
    const st = libraryItem?.state;
    if (
      !isAnime &&
      libraryItem?.type === "series" &&
      st &&
      typeof st.season === "number" &&
      typeof st.episode === "number" &&
      st.season >= 1 &&
      st.episode >= 1 &&
      (st.timeOffset ?? 0) > 0
    ) {
      return { season: st.season, episode: st.episode };
    }
    return lastPlayedEpisode(meta.id);
  }, [meta.id, libraryItem, isAnime]);
  const smartPlay = useCallback(async () => {
    if (inSession) claimHost(true);
    if (!isSeries) {
      openPicker(playMeta, undefined, { autoPlay: settings.instantPlay });
      return;
    }
    if (isAnime) {
      const wantedEp = lastPlay
        ? animeEpisodes.find(
            (e) => (e.seasonNumber || 1) === lastPlay.season && e.number === lastPlay.episode,
          )
        : animeEpisodes[0];
      if (wantedEp) {
        openPicker(
          playMeta,
          {
            season: wantedEp.seasonNumber || 1,
            episode: wantedEp.number,
            name: wantedEp.title,
            still: wantedEp.thumbnail ?? undefined,
            overview: wantedEp.synopsis || undefined,
            kitsuStreamId: wantedEp.streamId,
            imdbId: wantedEp.imdbId,
            imdbSeason: wantedEp.imdbSeason,
            imdbEpisode: wantedEp.imdbEpisode,
          },
          { autoPlay: settings.instantPlay },
        );
        return;
      }
      openPicker(playMeta, undefined, { autoPlay: settings.instantPlay });
      return;
    }
    if (lastPlay) {
      openPicker(
        playMeta,
        { season: lastPlay.season, episode: lastPlay.episode },
        { autoPlay: settings.instantPlay },
      );
      return;
    }
    if (authKey) {
      const lookupId =
        meta.id.startsWith("tt") ? meta.id : detail?.imdbId?.startsWith("tt") ? detail.imdbId : null;
      if (lookupId) {
        const item = await libraryGetOne(authKey, lookupId).catch(() => null);
        const st = item?.state;
        if (
          st &&
          typeof st.season === "number" &&
          typeof st.episode === "number" &&
          st.season >= 1 &&
          st.episode >= 1 &&
          (st.timeOffset ?? 0) > 0
        ) {
          openPicker(playMeta, { season: st.season, episode: st.episode }, { autoPlay: settings.instantPlay });
          return;
        }
      }
    }
    openPicker(playMeta, { season: 1, episode: 1 }, { autoPlay: settings.instantPlay });
  }, [isSeries, isAnime, animeEpisodes, lastPlay, openPicker, playMeta, settings.instantPlay, inSession, claimHost, authKey, meta.id, detail?.imdbId]);
  const smartPlayLabel = inSession && !liveContext
    ? "Play Together"
    : isSeries && lastPlay
      ? `Resume S${lastPlay.season}:E${lastPlay.episode}`
      : "Play";

  return (
    <main
      ref={scrollRef}
      className="absolute inset-0 z-30 overflow-y-auto bg-canvas"
    >
      <section className="relative">
        <div
          data-tauri-drag-region
          className="harbor-bleed-stremio relative h-[78vh] min-h-[640px] overflow-hidden"
        >
          {backdrops.length >= 2 ? (
            backdrops.map((b, i) => (
              <img
                key={b}
                src={b}
                alt=""
                decoding="async"
                fetchPriority={i === 0 ? "high" : "low"}
                loading={i < 3 ? "eager" : "lazy"}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ${i === backdropIdx ? "opacity-100" : "opacity-0"}`}
              />
            ))
          ) : backdrop ? (
            <img
              src={backdrop}
              alt=""
              decoding="async"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 via-45% to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-canvas/85 via-canvas/35 to-transparent" />

          <div className="absolute inset-x-0 bottom-0 px-12 pb-14">
            <div className="max-w-3xl">
              {tagline && (
                <p className="mb-4 text-[14px] font-medium uppercase tracking-[0.2em] text-ink-subtle">
                  {tagline}
                </p>
              )}
              <TitlePlate title={title} logo={logo} loading={loading} />
              <div className="mt-6 flex flex-wrap items-center gap-3 text-[13px] font-medium text-ink-muted">
                {year && (
                  <Pill
                    onClick={() => {
                      const n = Number(String(year).slice(0, 4));
                      if (Number.isFinite(n)) {
                        openFilter({ kind: "year", mediaType: isSeries ? "tv" : "movie", value: n });
                      }
                    }}
                  >
                    {year}
                  </Pill>
                )}
                {rating && (
                  <Pill
                    onClick={() => {
                      const id = detail?.imdbId ?? (meta.id.startsWith("tt") ? meta.id : null);
                      if (id) openUrl(`https://www.imdb.com/title/${id}/`);
                    }}
                  >
                    {isAnime ? (
                      <MalLogo className="h-[14px] w-auto text-ink-muted" />
                    ) : (
                      <ImdbIcon className="h-[15px] w-auto rounded-[3px]" />
                    )}
                    <span className="font-semibold text-ink">{rating}</span>
                  </Pill>
                )}
                {settings.showRtBadge && scores?.rtCritics != null && (
                  <Pill>
                    <RtBadge score={scores.rtCritics} className="h-[16px] w-auto" />
                    <span className="font-semibold text-ink">{scores.rtCritics}%</span>
                  </Pill>
                )}
                {runtime && (
                  <Pill
                    onClick={() => {
                      const minutes = parseInt(String(runtime), 10);
                      if (Number.isFinite(minutes)) {
                        openFilter({ kind: "runtime", mediaType: isSeries ? "tv" : "movie", value: minutes });
                      }
                    }}
                  >
                    {runtime}
                  </Pill>
                )}
                {showSeasonPill && (
                  <button
                    onClick={() => {
                      document
                        .querySelector('[data-anime-episodes]')
                        ?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/12 px-3 py-1 text-[12.5px] font-semibold text-accent transition-colors hover:bg-accent/20"
                  >
                    {seasonPillLabel}
                  </button>
                )}
                {meta.addonOrigin ? (
                  <span className="flex items-center gap-2 rounded-full border border-edge bg-canvas/80 py-1 pl-1.5 pr-3 text-[12.5px] font-medium text-ink-muted">
                    {meta.addonOrigin.logo ? (
                      <img
                        src={meta.addonOrigin.logo}
                        alt=""
                        draggable={false}
                        className="h-5 w-5 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-[10px] font-semibold text-ink">
                        {meta.addonOrigin.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                    {meta.addonOrigin.name}
                  </span>
                ) : (
                  genres.slice(0, 3).map((g) => {
                    const map = isSeries ? TV_GENRES : MOVIE_GENRES;
                    const id = map[g];
                    return (
                      <Pill
                        key={g}
                        onClick={
                          id
                            ? () => openFilter({ kind: "genre", mediaType: isSeries ? "tv" : "movie", name: g, id })
                            : undefined
                        }
                      >
                        {g}
                      </Pill>
                    );
                  })
                )}
              </div>
              <div className="mt-9 flex gap-3">
                {upcoming ? (
                  <UpcomingCta detail={detail} onTry={smartPlay} />
                ) : (
                  <PlayModeHint>
                  <button
                    onClick={smartPlay}
                    className="flex h-12 items-center gap-2.5 rounded-full bg-ink px-7 text-[15px] font-semibold text-canvas shadow-[0_8px_24px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.65),inset_0_-1px_0_rgba(0,0,0,0.18)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
                  >
                    <Play size={18} fill="currentColor" />
                    {smartPlayLabel}
                  </button>
                  </PlayModeHint>
                )}
                <button
                  type="button"
                  onClick={() =>
                    toggleWatchlist({
                      id: meta.id,
                      type: meta.type,
                      name: title || meta.name,
                      poster: meta.poster ?? detail?.poster,
                    })
                  }
                  title={traktConnected ? "Synced to Trakt" : "Saved locally. Connect Trakt in Settings to sync."}
                  className={`flex h-12 items-center gap-2.5 rounded-full border px-6 text-[15px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[transform,background-color,border-color] duration-200 active:scale-[0.98] ${
                    inWatchlist
                      ? "border-ink bg-ink/10 text-ink hover:bg-ink/20"
                      : "border-edge bg-canvas/80 text-ink hover:border-ink-subtle hover:bg-canvas/95"
                  }`}
                >
                  {inWatchlist ? (
                    <>
                      <Check size={18} strokeWidth={2.4} />
                      In Watchlist
                    </>
                  ) : (
                    <>
                      <Plus size={18} strokeWidth={2} />
                      Add to Watchlist
                    </>
                  )}
                </button>
                {isAnime && (
                  <AddToAnilistButton
                    harborId={animeCanonicalId ?? meta.id}
                    title={title || meta.name}
                  />
                )}
                {!isAnime && (
                  <AddToSimklButton
                    harborId={meta.id}
                    title={title || meta.name}
                    type={meta.type === "movie" ? "movie" : "series"}
                  />
                )}
                <button
                  type="button"
                  onClick={() =>
                    toggleFavorite({
                      id: meta.id,
                      type: meta.type,
                      name: title || meta.name,
                      poster: meta.poster ?? detail?.poster,
                    })
                  }
                  aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
                  title={isFav ? "Favorited" : "Favorite"}
                  className={`group flex h-12 w-12 items-center justify-center rounded-full border transition-[transform,background-color,border-color] duration-200 active:scale-[0.94] ${
                    isFav
                      ? "border-accent/55 bg-accent/15 text-accent hover:bg-accent/22"
                      : "border-edge bg-canvas/80 text-ink hover:border-ink-subtle hover:bg-canvas/95"
                  }`}
                >
                  <Star size={20} strokeWidth={isFav ? 0 : 1.9} fill={isFav ? "currentColor" : "none"} />
                </button>
                {trailerCandidate && (
                  <button
                    type="button"
                    onClick={() => setTrailerOpen(true)}
                    aria-label="Watch trailer"
                    title="Watch trailer"
                    className="group flex h-12 w-12 items-center justify-center rounded-full border border-edge bg-canvas/80 text-ink transition-[transform,background-color,border-color] duration-200 hover:border-ink-subtle hover:bg-canvas/95 active:scale-[0.94]"
                  >
                    <PreviewIcon size={20} />
                  </button>
                )}
                {meta.type === "movie" && <EpisodeDownloadButton meta={meta} variant="bar" />}
                {liveContext && (
                  <button
                    type="button"
                    onClick={promoteMetaToRoot}
                    className="flex h-12 items-center gap-2 rounded-full border border-edge bg-canvas/80 px-5 text-[14px] font-medium text-ink-muted transition-colors hover:border-ink-subtle hover:bg-canvas/95 hover:text-ink"
                  >
                    {meta.type === "series" || meta.type === "tv"
                      ? "Open in TV Shows"
                      : meta.type === "anime"
                        ? "Open in Anime"
                        : "Open in Movies"}
                  </button>
                )}
              </div>
            </div>
          </div>
          {(() => {
            if (isAnime) {
              const animeName =
                animeAwardLookupName(releaseYearNum, title, meta.name, detail?.title) ??
                stickyAwardName.current;
              if (animeName) {
                stickyAwardName.current = animeName;
                return <CrunchyrollAwardsCorner name={animeName} year={releaseYearNum} />;
              }
            }
            if (heroAwardSummary.length > 0) {
              return <HeroAwardsCorner summary={heroAwardSummary} />;
            }
            const resolved =
              animeAwardLookupName(releaseYearNum, title, meta.name, detail?.title) ??
              stickyAwardName.current;
            if (resolved) stickyAwardName.current = resolved;
            if (resolved) return <CrunchyrollAwardsCorner name={resolved} year={releaseYearNum} />;
            return null;
          })()}
        </div>
      </section>

      <div data-tauri-drag-region className="flex flex-col gap-16 px-12 pb-24 pt-14">
        {overview && <Synopsis text={overview} />}
        {loading && (
          <div className="h-[280px] animate-pulse rounded-2xl border border-edge-soft bg-elevated/30" />
        )}

        {isAnime && streamers.length > 0 && <StreamingLinks streamers={streamers} />}

        {!isAnime && watchProviders.length > 0 && <WatchOn providers={watchProviders} />}

        {!liveContext && detail && isAnime && (animeEpisodes.length > 1 || franchise.length > 1) && (
          <AnimeEpisodes
            meta={playMeta}
            episodes={animeEpisodes}
            franchise={franchise}
            currentId={currentFranchiseId}
            scrollRef={scrollRef}
          />
        )}

        {!liveContext && detail && !isAnime && isSeries && detail.seasons.length > 0 && (
          <SeriesEpisodes
            meta={playMeta}
            tvId={detail.id}
            imdbId={detail.imdbId ?? (meta.id.startsWith("tt") ? meta.id : null)}
            seasons={detail.seasons}
            lastEpisodeAir={detail.lastEpisodeAir}
            scrollRef={scrollRef}
            cinemetaVideos={cinemetaFull?.videos}
            stremioWatched={stremioWatched}
          />
        )}

        {!liveContext &&
          (!detail || detail.seasons.length === 0) &&
          !isAnime &&
          isSeries &&
          !addonNative &&
          cinemetaFull?.videos &&
          cinemetaFull.videos.some((v) => v.season != null && v.season > 0 && v.episode != null) && (
            <CinemetaEpisodes meta={playMeta} videos={cinemetaFull.videos} />
          )}

        {detail && (detail.directors.length > 0 || detail.creators.length > 0 || detail.writers.length > 0) && (
          <div className="grid grid-cols-1 gap-x-12 gap-y-6 border-b border-edge-soft pb-12 sm:grid-cols-2 lg:grid-cols-3">
            {detail.directors.length > 0 && (
              <Credit label={detail.directors.length === 1 ? "Director" : "Directors"} people={detail.directors} />
            )}
            {detail.creators.length > 0 && (
              <Credit label={detail.creators.length === 1 ? "Creator" : "Creators"} people={detail.creators} />
            )}
            {detail.writers.length > 0 && (
              <Credit label={detail.writers.length === 1 ? "Writer" : "Writers"} people={detail.writers.slice(0, 6)} />
            )}
            {detail.producers.length > 0 && (
              <Credit label="Producers" people={detail.producers.slice(0, 6)} />
            )}
            {detail.cinematography.length > 0 && (
              <Credit label="Cinematography" people={detail.cinematography} />
            )}
            {detail.composer.length > 0 && (
              <Credit label="Music" people={detail.composer} />
            )}
            {detail.editor.length > 0 && (
              <Credit label={detail.editor.length === 1 ? "Editor" : "Editors"} people={detail.editor} />
            )}
          </div>
        )}

        {detail && detail.cast.length > 0 && (
          <LazyMount minHeight={240}>
            <Row title={`Cast · ${detail.cast.length}`} min={128}>
              {detail.cast.map((c, i) => (
                <CastCard key={`${c.id}-${i}`} cast={c} />
              ))}
            </Row>
          </LazyMount>
        )}

        {detail?.collection && (
          <LazyMount minHeight={280}>
            <CollectionRow collection={detail.collection} currentId={meta.id} />
          </LazyMount>
        )}

        {recommendations.length > 0 && (
          <LazyMount minHeight={280}>
            <Row title="More Like This">
              {recommendations.map((r) => (
                <PickCard key={r.id} meta={r} />
              ))}
            </Row>
          </LazyMount>
        )}

        {similar.length > 0 && (
          <LazyMount minHeight={280}>
            <Row title="You Might Also Like">
              {similar.map((r) => (
                <PickCard key={`s-${r.id}`} meta={r} />
              ))}
            </Row>
          </LazyMount>
        )}

        <div id="anime-awards-section" style={{ scrollMarginTop: 96 }}>
          <LazyMount minHeight={160}>
            <AnimeAwardsBlock
              name={
                animeAwardLookupName(releaseYearNum, title, meta.name, detail?.title) ??
                stickyAwardName.current ??
                title
              }
              year={releaseYearNum}
            />
          </LazyMount>
        </div>
        {detail && awards && (
          <div id="awards-section" style={{ scrollMarginTop: 96 }}>
            <LazyMount minHeight={200}>
              <AwardsBlock awards={awards} />
            </LazyMount>
          </div>
        )}
        {detail && (
          <LazyMount minHeight={200}>
            <InfoBlock detail={detail} isAnime={isAnime} />
          </LazyMount>
        )}

        {!loading && !detail && !isAnime && !addonNative && !settings.tmdbKey && (
          <div className="rounded-2xl border border-dashed border-edge px-6 py-12 text-center text-[14px] text-ink-muted">
            Add a TMDB key in Settings to see cast, related titles, and trailers here.
          </div>
        )}
      </div>
      <BackToTop scrollRef={scrollRef} />
      {trailerOpen && trailerCandidate && (
        <TrailerOverlay
          id={trailerCandidate}
          title={title}
          logo={logo}
          onClose={() => setTrailerOpen(false)}
        />
      )}
    </main>
  );
}
