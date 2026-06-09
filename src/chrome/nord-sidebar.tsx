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

const FROST = "#88c0d0";
const RAIL = "linear-gradient(180deg, #8fbcbb59, #88c0d033 44%, #b48ead2b 78%, #81a1c14d)";

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

export function NordSidebar() {
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
        className={`relative z-[60] flex w-[78px] shrink-0 flex-col transition-[opacity,transform] duration-[320ms] ease-[cubic-bezier(0.32,0.72,0.24,1)] lg:w-56 ${
          chromeHidden ? "pointer-events-none -translate-x-2 opacity-0" : "translate-x-0 opacity-100"
        }`}
      >
        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{ background: "linear-gradient(180deg, var(--color-elevated), var(--color-canvas) 46%)" }}
        >
          <GlacierEdge />

          <div
            data-tauri-drag-region
            className="relative flex h-20 shrink-0 items-center justify-center lg:justify-start lg:pl-[27px]"
          >
            <button
              type="button"
              onClick={() => setView("home")}
              aria-label="Harbor home"
              className="flex items-center gap-2.5 text-ink"
            >
              <HarborMark className="h-[26px] w-[26px] shrink-0 drop-shadow-[0_0_10px_#88c0d05c]" />
              <span
                className="hidden text-[27px] font-medium leading-none lg:inline"
                style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.4px" }}
              >
                Harbor
              </span>
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="relative flex flex-col">
              <span
                aria-hidden
                className="pointer-events-none absolute left-[39px] top-0 bottom-0 w-px -translate-x-1/2"
                style={{
                  background: RAIL,
                  maskImage: "linear-gradient(180deg, transparent, #000 7%, #000 93%, transparent)",
                  WebkitMaskImage: "linear-gradient(180deg, transparent, #000 7%, #000 93%, transparent)",
                }}
              />

              {PRIMARY.filter(isVisible).map((item) => (
                <Station key={item.view} item={item} active={view === item.view} onClick={() => go(item)} />
              ))}

              {COLLECTIONS.filter(isVisible).map((item) => (
                <Station
                  key={item.view}
                  item={item}
                  active={view === item.view}
                  gated={!!item.pinGated && locked}
                  onClick={() => go(item)}
                />
              ))}
            </div>
          </nav>

          <div className="relative shrink-0 px-2 pb-3 pt-1 lg:px-3">
            <FrostLine className="mb-2" />
            {locked ? (
              <div className="flex items-center justify-center gap-3 py-2.5 lg:justify-start lg:px-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-subtle"
                  style={{ boxShadow: "inset 0 0 0 1.5px var(--color-edge)" }}
                >
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

function Station({
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
      title={gated ? `${item.label} : locked` : item.label}
      className="group relative z-10 flex h-[52px] w-full items-center"
    >
      <span className="flex w-[78px] shrink-0 items-center justify-center">
        <span
          className={`relative grid h-10 w-10 place-items-center rounded-full transition-colors duration-200 ${
            active ? "text-canvas" : "text-ink-muted group-hover:text-ink"
          }`}
        >
          {active ? (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full"
              style={{ background: FROST, boxShadow: `0 0 0 4px ${FROST}1c, 0 0 16px 1px ${FROST}73` }}
            />
          ) : (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-canvas ring-[1.5px] ring-[#4c566a] transition-all duration-200 group-hover:ring-[#88c0d0]"
            />
          )}
          <span className="relative [&_svg]:h-[24px] [&_svg]:w-[24px]">{item.render(false)}</span>
          {gated && (
            <span
              className="absolute -bottom-0.5 -right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-canvas text-ink-subtle"
              style={{ boxShadow: "0 0 0 1px var(--color-edge)" }}
            >
              <Lock size={9} strokeWidth={2.4} />
            </span>
          )}
        </span>
      </span>
      <span
        className={`hidden flex-1 pr-4 text-left text-[16.5px] tracking-tight transition-colors duration-200 lg:block ${
          active ? "font-semibold text-ink" : "font-medium text-ink-muted group-hover:text-ink"
        }`}
      >
        {item.label}
      </span>
    </button>
  );
}

function FrostLine({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`h-px w-full ${className ?? ""}`}
      style={{ background: "linear-gradient(90deg, transparent, #88c0d03d 20%, #88c0d03d 80%, transparent)" }}
    />
  );
}

function GlacierEdge() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 w-px"
      style={{ background: "linear-gradient(180deg, #88c0d04d, #4c566a3d 38%, #4c566a3d)" }}
    />
  );
}
