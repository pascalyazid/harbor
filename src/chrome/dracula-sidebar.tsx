import { Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { AddonsIcon } from "@/components/icons/addons-icon";
import { DownloadsNavIcon } from "@/chrome/downloads-nav-icon";
import { AnimeIcon } from "@/components/icons/anime-icon";
import { CalendarIcon } from "@/components/icons/calendar-icon";
import { DiscoverIcon } from "@/components/icons/discover-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { LibraryIcon } from "@/components/icons/library-icon";
import { LiveTvIcon } from "@/components/icons/live-tv-icon";
import { PlaylistVodIcon } from "@/components/icons/playlist-vod-icon";
import { MoviesIcon } from "@/components/icons/movies-icon";
import { SettingsIcon } from "@/components/icons/settings-icon";
import { TvIcon } from "@/components/icons/tv-icon";
import { HarborMark } from "@/components/icons/harbor-mark";
import { ProfileChip } from "@/chrome/sidebar/profile-chip";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { useParental, type LockableTab } from "@/lib/parental";
import { useSettings } from "@/lib/settings";
import { useView, type View } from "@/lib/view";

type NavDef = {
  render: (active: boolean) => ReactNode;
  label: string;
  view: View;
  hideKey?: "anime" | "liveTv" | "sports";
  parentalKey?: LockableTab;
  pinGated?: boolean;
};

const PRIMARY: NavDef[] = [
  { render: (a) => <HomeIcon active={a} />, label: "Home", view: "home" },
  { render: (a) => <DiscoverIcon active={a} />, label: "Discover", view: "discover", parentalKey: "discover" },
  { render: (a) => <MoviesIcon active={a} />, label: "Movies", view: "movies", parentalKey: "movies" },
  { render: (a) => <TvIcon active={a} />, label: "Shows", view: "shows", parentalKey: "shows" },
  { render: (a) => <AnimeIcon active={a} />, label: "Anime", view: "anime", hideKey: "anime", parentalKey: "anime" },
  { render: (a) => <LiveTvIcon active={a} />, label: "Live TV", view: "live", hideKey: "liveTv", parentalKey: "liveTv" },
  { render: (a) => <PlaylistVodIcon active={a} />, label: "Playlists", view: "vod" },
];

const COLLECTIONS: NavDef[] = [
  { render: (a) => <CalendarIcon active={a} />, label: "Calendar", view: "calendar", parentalKey: "calendar" },
  { render: (a) => <LibraryIcon active={a} />, label: "My Library", view: "library", parentalKey: "library" },
  { render: (a) => <DownloadsNavIcon active={a} />, label: "Downloads", view: "downloads" },
  { render: (a) => <AddonsIcon active={a} />, label: "Addons", view: "addons", parentalKey: "addons" },
  { render: (a) => <SettingsIcon active={a} />, label: "Settings", view: "settings", pinGated: true },
];

export function DraculaSidebar() {
  const { view, setView, chromeHidden } = useView();
  const { locked, unlock, hiddenTabs } = useParental();
  const { settings } = useSettings();
  const [pinFor, setPinFor] = useState<View | null>(null);

  const isVisible = (item: NavDef) => {
    if (item.view === "vod" && !settings.showPlaylistsTab) return false;
    if (item.hideKey && settings.hideContent[item.hideKey]) return false;
    if (locked && item.parentalKey && hiddenTabs[item.parentalKey]) return false;
    return true;
  };

  const go = (item: NavDef) => {
    if (item.pinGated && locked) {
      setPinFor(item.view);
      return;
    }
    setView(item.view);
  };

  return (
    <>
      <aside
        aria-hidden={chromeHidden}
        className={`relative z-[60] flex w-[78px] shrink-0 flex-col transition-[opacity,transform] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0.24,1)] lg:w-64 ${
          chromeHidden ? "pointer-events-none -translate-x-2 opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <div
          className="relative flex min-h-0 flex-1 flex-col rounded-r-[30px] shadow-[8px_0_34px_-18px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-edge-soft/70"
          style={{ background: "linear-gradient(180deg, var(--color-surface), var(--color-canvas) 60%)" }}
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-r-[30px]">
            <span
              className="absolute inset-x-0 top-0 h-44"
              style={{ background: "radial-gradient(125% 80% at 50% -8%, var(--color-accent-soft), transparent 72%)" }}
            />
          </span>

          <div
            data-tauri-drag-region
            className="relative flex h-20 shrink-0 items-center justify-center px-3 lg:justify-start lg:px-6"
          >
            <button
              type="button"
              onClick={() => setView("home")}
              aria-label="Harbor home"
              className="flex items-center gap-2 text-ink"
            >
              <HarborMark className="harbor-dracula-moon h-7 w-7 shrink-0 text-accent drop-shadow-[0_0_10px_var(--color-accent-soft)] lg:h-[26px] lg:w-[26px]" />
              <span
                className="hidden text-[40px] font-medium leading-none tracking-tight lg:inline"
                style={{ fontFamily: "var(--font-display)", transform: "translateY(1px)" }}
              >
                Harb
                <span className="inline-block" style={{ transform: "rotate(8deg)", transformOrigin: "50% 65%" }}>
                  o
                </span>
                r
              </span>
            </button>
          </div>

          <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-3 pb-4 pt-1 [scrollbar-width:none] lg:px-4 [&::-webkit-scrollbar]:hidden">
            {PRIMARY.filter(isVisible).map((item) => (
              <NavPill
                key={item.view}
                item={item}
                active={view === item.view}
                onClick={() => go(item)}
              />
            ))}

            {COLLECTIONS.filter(isVisible).map((item) => (
              <NavPill
                key={item.view}
                item={item}
                active={view === item.view}
                gated={!!item.pinGated && locked}
                onClick={() => go(item)}
              />
            ))}
          </nav>

          <div className="relative px-3 pb-3 pt-1 lg:px-4">
            <div
              aria-hidden
              className="pointer-events-none mb-2 h-px bg-gradient-to-r from-transparent via-edge-soft to-transparent"
            />
            {locked ? (
              <div className="flex items-center justify-center gap-3 rounded-2xl py-2.5 lg:justify-start lg:px-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-edge-soft text-ink-subtle">
                  <Lock size={16} />
                </div>
                <div className="hidden min-w-0 lg:block">
                  <div className="truncate text-[13px] font-medium text-ink-muted">Locked</div>
                  <div className="truncate text-[11.5px] text-ink-subtle">Parental controls on</div>
                </div>
              </div>
            ) : (
              <ProfileChip />
            )}
          </div>
        </div>
      </aside>

      {pinFor !== null && (
        <ParentalPinModal
          mode={{
            kind: "unlock",
            onUnlock: () => {
              const v = pinFor;
              setPinFor(null);
              if (v) setView(v);
            },
            onCancel: () => setPinFor(null),
          }}
          verify={unlock}
        />
      )}
    </>
  );
}

function NavPill({
  item,
  active,
  gated,
  onClick,
}: {
  item: NavDef;
  active: boolean;
  gated?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={gated ? `${item.label} (locked, requires PIN)` : item.label}
      title={gated ? `${item.label} · locked` : item.label}
      className={`group relative flex h-12 items-center justify-center gap-3.5 rounded-[18px] transition-colors duration-200 lg:justify-start lg:px-4 ${
        active ? "text-accent" : "text-ink-muted hover:text-ink"
      }`}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[18px]"
          style={{
            background: "var(--color-accent-soft)",
            boxShadow: "inset 0 0 0 1px var(--color-accent-soft), 0 6px 20px -14px var(--color-accent)",
          }}
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[18px] bg-elevated/0 transition-colors duration-200 group-hover:bg-elevated/50"
        />
      )}
      <span className={`relative ${gated ? "opacity-70" : ""}`}>
        {item.render(false)}
        {gated && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-ink-subtle ring-1 ring-edge">
            <Lock size={9} strokeWidth={2.4} />
          </span>
        )}
      </span>
      <span className="relative hidden flex-1 text-[17px] font-medium tracking-tight lg:inline">
        {item.label}
      </span>
    </button>
  );
}


