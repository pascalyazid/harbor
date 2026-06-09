import { ChevronDown, Lock } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { AddonsIcon } from "@/components/icons/addons-icon";
import { CalendarIcon } from "@/components/icons/calendar-icon";
import { ProfileChip } from "@/chrome/sidebar/profile-chip";
import { useSettings } from "@/lib/settings";
import { getThemeById } from "@/lib/theme";
import { AnimeIcon } from "@/components/icons/anime-icon";
import { DiscoverIcon } from "@/components/icons/discover-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { LibraryIcon } from "@/components/icons/library-icon";
import { LiveTvIcon } from "@/components/icons/live-tv-icon";
import { PlaylistVodIcon } from "@/components/icons/playlist-vod-icon";
import { MoviesIcon } from "@/components/icons/movies-icon";
import { SettingsIcon } from "@/components/icons/settings-icon";
import { TvIcon } from "@/components/icons/tv-icon";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useParental, type LockableTab } from "@/lib/parental";
import { useView, type View } from "@/lib/view";
import { DownloadsNavIcon } from "@/chrome/downloads-nav-icon";

type NavDef = {
  render: (active: boolean) => ReactNode;
  label: string;
  view?: View;
  hideKey?: "anime" | "liveTv" | "sports";
  parentalKey?: LockableTab;
  pinGated?: boolean;
};

const PRIMARY: NavDef[] = [
  { render: (active) => <HomeIcon active={active} />, label: "Home", view: "home" },
  { render: (active) => <DiscoverIcon active={active} />, label: "Discover", view: "discover", parentalKey: "discover" },
  { render: (active) => <MoviesIcon active={active} />, label: "Movies", view: "movies", parentalKey: "movies" },
  { render: (active) => <TvIcon active={active} />, label: "Shows", view: "shows", parentalKey: "shows" },
  { render: (active) => <AnimeIcon active={active} />, label: "Anime", view: "anime", hideKey: "anime", parentalKey: "anime" },
  { render: (active) => <LiveTvIcon active={active} />, label: "Live TV", view: "live", hideKey: "liveTv", parentalKey: "liveTv" },
  { render: (active) => <PlaylistVodIcon active={active} />, label: "Playlists", view: "vod" },
];

const COLLECTIONS: NavDef[] = [
  { render: (active) => <CalendarIcon active={active} />, label: "Calendar", view: "calendar", parentalKey: "calendar" },
  { render: (active) => <LibraryIcon active={active} />, label: "My Library", view: "library", parentalKey: "library" },
  { render: (active) => <DownloadsNavIcon active={active} />, label: "Downloads", view: "downloads" },
  { render: (active) => <AddonsIcon active={active} />, label: "Addons", view: "addons", parentalKey: "addons" },
  { render: (active) => <SettingsIcon active={active} />, label: "Settings", view: "settings", pinGated: true },
];

export function Sidebar() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const [pendingPinView, setPendingPinView] = useState<View | null>(null);

  const themePreset =
    settings.theme.preset !== "custom" ? getThemeById(settings.theme.preset) : null;
  const customMark = themePreset?.logo?.mark ?? null;
  const customWordmark = themePreset?.logo?.wordmark ?? null;

  return (
    <>
      <aside
        aria-hidden={chromeHidden}
        className={`relative z-[60] flex w-[72px] shrink-0 flex-col border-r border-edge-soft bg-canvas transition-[opacity,transform] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0.24,1)] lg:w-60 ${
          chromeHidden
            ? "pointer-events-none -translate-x-2 opacity-0"
            : "translate-x-0 opacity-100"
        }`}
      >
        <div data-tauri-drag-region className="flex h-20 shrink-0 items-center justify-center gap-0.5 px-3 text-ink lg:justify-start lg:px-7">
          {customMark ? (
            <img
              src={customMark}
              alt=""
              draggable={false}
              className="h-9 w-9 shrink-0 object-contain lg:h-10 lg:w-10"
            />
          ) : (
            <HarborMark className="h-9 w-9 shrink-0 lg:h-10 lg:w-10" />
          )}
          {customWordmark ? (
            <img
              src={customWordmark}
              alt=""
              draggable={false}
              className="hidden h-8 w-auto object-contain lg:inline-block"
            />
          ) : (
            <span
              className="hidden whitespace-nowrap text-[44px] font-medium leading-none tracking-tight lg:inline"
              style={{
                fontFamily: '"Fraunces", "Iowan Old Style", "Georgia", serif',
                transform: "translateY(2px)",
              }}
            >
              Harb
              <span
                className="inline-block"
                style={{ transform: "rotate(7deg)", transformOrigin: "50% 65%" }}
              >
                o
              </span>
              r
            </span>
          )}
        </div>
        <ScrollableNav
          view={view}
          setView={setView}
          locked={locked}
          hiddenTabs={hiddenTabs}
          onPinNav={(v) => setPendingPinView(v)}
        />
        <div className="relative p-2 lg:p-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-edge-soft/55 to-transparent lg:inset-x-4"
          />
          {locked ? (
            <div className="flex w-full items-center justify-center gap-3 rounded-xl py-2.5 lg:justify-start lg:px-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-edge-soft bg-elevated/50 text-ink-subtle">
                <Lock size={17} />
              </div>
              <div className="hidden min-w-0 flex-1 lg:block">
                <div className="truncate text-[13.5px] font-medium text-ink-muted">Locked</div>
                <div className="truncate text-[12px] text-ink-subtle">Parental controls on</div>
              </div>
            </div>
          ) : (
            <ProfileChip />
          )}
        </div>
      </aside>
      {pendingPinView && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const v = pendingPinView;
              setPendingPinView(null);
              if (v) setView(v);
            },
            onCancel: () => setPendingPinView(null),
          }}
          verify={unlock}
        />
      )}
    </>
  );
}

function ScrollableNav({
  view,
  setView,
  locked,
  hiddenTabs,
  onPinNav,
}: {
  view: View;
  setView: (v: View) => void;
  locked: boolean;
  hiddenTabs: Record<LockableTab, boolean>;
  onPinNav: (v: View) => void;
}) {
  const { settings } = useSettings();
  const isItemVisible = (item: NavDef) => {
    if (item.view === "vod" && !settings.showPlaylistsTab) return false;
    if (item.hideKey && settings.hideContent[item.hideKey]) return false;
    if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
    return true;
  };
  const visiblePrimary = PRIMARY.filter(isItemVisible);
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState<{ top: boolean; bottom: boolean }>({
    top: false,
    bottom: false,
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop > 4;
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
      setOverflow((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollDown = () => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ top: 112, behavior: "smooth" });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        className="flex flex-1 flex-col overflow-y-auto px-4 pt-3 pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex flex-col gap-1.5">
          {visiblePrimary.map((item) => (
            <NavItem
              key={item.label}
              {...item}
              active={item.view ? view === item.view : false}
              onClick={item.view ? () => setView(item.view!) : undefined}
            />
          ))}
        </div>
        <div data-tauri-drag-region className="py-2.5">
          <div className="mx-3 h-px bg-gradient-to-r from-transparent via-edge-soft/55 to-transparent" />
        </div>
        <div className="flex flex-col gap-1.5">
          {COLLECTIONS.filter(isItemVisible).map((item) => {
            const gated = !!item.pinGated && locked;
            return (
              <NavItem
                key={item.label}
                {...item}
                gated={gated}
                active={item.view ? view === item.view : false}
                onClick={
                  item.view
                    ? () => (gated ? onPinNav(item.view!) : setView(item.view!))
                    : undefined
                }
              />
            );
          })}
        </div>
        <div data-tauri-drag-region className="flex-1 min-h-2" />
      </div>
      {overflow.top && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-canvas to-transparent" />
      )}
      {overflow.bottom && (
        <>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-canvas via-canvas/85 to-transparent" />
          <button
            type="button"
            onClick={scrollDown}
            aria-label="Scroll for more"
            className="absolute bottom-1 left-1/2 flex h-4 w-7 -translate-x-1/2 items-center justify-center text-ink-subtle/55 transition-colors hover:text-ink-muted"
          >
            <ChevronDown size={11} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}

function NavItem({
  render,
  label,
  active,
  onClick,
  gated,
}: {
  render: (active: boolean) => ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
  gated?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={gated ? `${label} (locked, requires PIN)` : label}
      title={gated ? `${label} · locked` : label}
      className={`relative flex h-14 items-center justify-center gap-4 rounded-xl text-[16px] transition-colors duration-150 lg:justify-start lg:px-4 ${
        active
          ? "bg-elevated text-ink"
          : "text-ink-muted hover:bg-elevated/50 hover:text-ink"
      }`}
    >
      <span className={`relative ${gated ? "opacity-70" : ""}`}>
        {render(hovered)}
        {gated && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-ink-subtle ring-1 ring-edge">
            <Lock size={9} strokeWidth={2.4} />
          </span>
        )}
      </span>
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

