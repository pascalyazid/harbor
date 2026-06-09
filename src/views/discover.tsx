import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { CriticsPick } from "@/components/critics-pick";
import { LazyMount } from "@/components/lazy-mount";
import { DiscoveryQueueCta } from "@/components/discovery-queue-cta";
import { FeaturedBanner } from "@/components/featured-banner";
import { GenreTiles } from "@/components/genre-tiles";
import { LanguageTiles } from "@/components/language-tiles";
import { ScrollRootContext } from "@/components/row";
import type { Meta } from "@/lib/cinemeta";
import { fetchCriticsPickList, fetchFeatured, getPool, selectDailyRows, type FeedItem } from "@/lib/feed";
import { getStore, subscribe as subscribeTaste } from "@/lib/discover/store";
import { getDownvotedIds, getUpvotedIds, subscribePrefs } from "@/lib/feed/preferences";
import { recentlyPlayed, subscribePlayback, watchTitleKey } from "@/lib/playback-history";
import { useSettings } from "@/lib/settings";
import { useScrollMemory } from "@/lib/view";
import { Rail } from "./discover/discover-rail";
import { useDedupedRows } from "./discover/use-deduped-rows";
import { ANCHOR_AWARDS, ANCHOR_TOP_RATED } from "@/lib/feed/daily-rows-anchors";

const MAX_RAIL_PAGES = 10;
const MIN_PAGE_YIELD = 4;
const ROW_COUNT = 14;
const DEDUP_PRIORITY = [ANCHOR_TOP_RATED, ANCHOR_AWARDS];

export function Discover({ active = true }: { active?: boolean }) {
  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("discover", scrollRef, active);

  const { settings } = useSettings();
  const [featured, setFeatured] = useState<Meta[]>([]);
  const [queue, setQueue] = useState<FeedItem[]>([]);
  const [criticsPickList, setCriticsPickList] = useState<Meta[]>([]);
  const [tasteVersion, setTasteVersion] = useState(0);
  const [rails, setRails] = useState<Record<string, Meta[]>>({});
  const railPagesRef = useRef<Record<string, number>>({});
  const railExhaustedRef = useRef<Record<string, boolean>>({});
  const railLoadingRef = useRef<Record<string, boolean>>({});

  const dailyRows = useMemo(
    () => selectDailyRows(settings.tmdbKey, getStore().affinity, settings, ROW_COUNT),
    [settings.tmdbKey, settings.region, settings.streaming, tasteVersion],
  );

  useEffect(() => {
    let cancelled = false;
    fetchFeatured(settings.tmdbKey).then((m) => !cancelled && setFeatured(m));
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey, tasteVersion]);

  useEffect(() => {
    let cancelled = false;
    const hidden = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
    getPool(settings.tmdbKey).then(async (p) => {
      if (cancelled) return;
      const { filterQueuePool } = await import("@/lib/feed/skipped");
      setQueue(filterQueuePool(p).filter((it) => !hidden.has(it.meta.id)));
    });
    fetchCriticsPickList(settings.tmdbKey).then(
      (list) => !cancelled && setCriticsPickList(list.filter((x) => !hidden.has(x.id))),
    );
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey]);

  useEffect(() => {
    let timer = 0;
    const bump = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setTasteVersion((v) => v + 1), 600);
    };
    const dropWatched = () => {
      const watched = recentlyPlayed();
      if (watched.ids.size === 0 && watched.titles.size === 0) return;
      const isWatched = (m: Meta) =>
        watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name));
      setFeatured((prev) => {
        const next = prev.filter((m) => !isWatched(m));
        return next.length === prev.length ? prev : next;
      });
      setQueue((prev) => {
        const next = prev.filter((it) => !isWatched(it.meta));
        return next.length === prev.length ? prev : next;
      });
      setCriticsPickList((prev) => {
        const next = prev.filter((m) => !isWatched(m));
        return next.length === prev.length ? prev : next;
      });
    };
    const offTaste = subscribeTaste(bump);
    const offPrefs = subscribePrefs(() => {
      const blocked = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
      setFeatured((prev) => prev.filter((m) => !blocked.has(m.id)));
      setQueue((prev) => prev.filter((it) => !blocked.has(it.meta.id)));
      setCriticsPickList((prev) => prev.filter((m) => !blocked.has(m.id)));
      bump();
    });
    const offPlayback = subscribePlayback(() => {
      dropWatched();
      bump();
    });
    return () => {
      clearTimeout(timer);
      offTaste();
      offPrefs();
      offPlayback();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const watched = recentlyPlayed();
    if (watched.ids.size === 0 && watched.titles.size === 0) return;
    const isWatched = (m: Meta) =>
      watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name));
    setFeatured((prev) => prev.filter((m) => !isWatched(m)));
    setQueue((prev) => prev.filter((it) => !isWatched(it.meta)));
    setCriticsPickList((prev) => prev.filter((m) => !isWatched(m)));
  }, [active]);

  useEffect(() => {
    let cancelled = false;
    setRails({});
    railPagesRef.current = {};
    railExhaustedRef.current = {};
    railLoadingRef.current = {};
    for (const rail of dailyRows) {
      railLoadingRef.current[rail.id] = true;
      rail
        .fetch(1)
        .then((list) => {
          if (cancelled) return;
          railPagesRef.current[rail.id] = 1;
          if (list.length < MIN_PAGE_YIELD) railExhaustedRef.current[rail.id] = true;
          setRails((prev) => ({ ...prev, [rail.id]: list }));
        })
        .catch(() => {
          if (cancelled) return;
          setRails((prev) => ({ ...prev, [rail.id]: [] }));
        })
        .finally(() => {
          railLoadingRef.current[rail.id] = false;
        });
    }
    return () => {
      cancelled = true;
    };
  }, [dailyRows]);

  const loadMore = useCallback(
    (railId: string) => {
      if (railLoadingRef.current[railId]) return;
      if (railExhaustedRef.current[railId]) return;
      const cur = railPagesRef.current[railId] ?? 1;
      if (cur >= MAX_RAIL_PAGES) return;
      const def = dailyRows.find((r) => r.id === railId);
      if (!def) return;
      const next = cur + 1;
      railLoadingRef.current[railId] = true;
      def
        .fetch(next)
        .then((list) => {
          railPagesRef.current[railId] = next;
          if (list.length < MIN_PAGE_YIELD) railExhaustedRef.current[railId] = true;
          setRails((prev) => ({ ...prev, [railId]: [...(prev[railId] ?? []), ...list] }));
        })
        .catch(() => {})
        .finally(() => {
          railLoadingRef.current[railId] = false;
        });
    },
    [dailyRows],
  );

  const featuredIds = useMemo(() => new Set(featured.map((m) => m.id)), [featured]);

  const criticsPick = useMemo(() => {
    const candidates = criticsPickList.filter(
      (m) => !featuredIds.has(m.id) && m.background && m.description,
    );
    if (candidates.length === 0) {
      return criticsPickList.find((m) => !featuredIds.has(m.id)) ?? null;
    }
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getUTCFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    return candidates[dayOfYear % candidates.length];
  }, [criticsPickList, featuredIds]);

  const order = useMemo(() => dailyRows.map((r) => r.id), [dailyRows]);
  const deduped = useDedupedRows(rails, order, featuredIds, criticsPick?.id, DEDUP_PRIORITY);

  return (
    <main ref={scrollCb} className="flex-1 overflow-y-auto px-12 pb-20 pt-20">
      <ScrollRootContext.Provider value={scrollEl}>
        <div data-tauri-drag-region className="flex flex-col gap-14">
          <FeaturedBanner items={featured} />

          {dailyRows.map((r, i) => (
            <Fragment key={r.id}>
              <LazyMount minHeight={340}>
                <Rail railId={r.id} allRails={dailyRows} deduped={deduped} loadMore={loadMore} />
              </LazyMount>

              {i === 0 && <GenreTiles />}
              {i === 1 && queue.length > 0 && <DiscoveryQueueCta items={queue} />}
              {i === 2 && <LanguageTiles />}
              {i === 3 && criticsPick && (
                <LazyMount minHeight={580}>
                  <CriticsPick meta={criticsPick} />
                </LazyMount>
              )}
            </Fragment>
          ))}
        </div>
      </ScrollRootContext.Provider>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

export { Discover as DiscoverView };
