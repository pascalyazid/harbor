import { useState } from "react";
import { Search } from "lucide-react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { ProfileBlock } from "@/chrome/siderail/profile-block";
import { RecordingPill } from "@/chrome/recording-pill";
import { TogetherButton } from "@/chrome/topbar";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useParental, type LockableTab } from "@/lib/parental";
import { useView, type View } from "@/lib/view";
import { ParentalPinModal } from "@/components/parental-pin-modal";
import { close, minimize, toggleMaximize } from "@/lib/window";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type Tab = {
  label: string;
  view: View;
  parentalKey?: LockableTab;
};

const PRIMARY: Tab[] = [
  { label: "Home", view: "home" },
  { label: "Discover", view: "discover", parentalKey: "discover" },
  { label: "Movies", view: "movies", parentalKey: "movies" },
  { label: "Shows", view: "shows", parentalKey: "shows" },
  { label: "Anime", view: "anime", parentalKey: "anime" },
  { label: "Live TV", view: "live", parentalKey: "liveTv" },
  { label: "Playlists", view: "vod" },
];

const SECONDARY: Tab[] = [
  { label: "Calendar", view: "calendar", parentalKey: "calendar" },
  { label: "Library", view: "library", parentalKey: "library" },
  { label: "Downloads", view: "downloads" },
  { label: "Addons", view: "addons", parentalKey: "addons" },
];

export function SideRail() {
  const { view, setView, chromeHidden } = useView();
  const { settings } = useSettings();
  const { locked, unlock, hiddenTabs } = useParental();
  const { setOpen: setSearchOpen } = useSearch();
  const [pinFor, setPinFor] = useState<View | null>(null);

  const navigate = (tab: Tab) => {
    if (tab.parentalKey && locked && hiddenTabs[tab.parentalKey]) {
      setPinFor(tab.view);
      return;
    }
    setView(tab.view);
  };

  const visible = (tabs: Tab[]) =>
    tabs.filter(
      (t) =>
        (t.view !== "vod" || settings.showPlaylistsTab) &&
        (!t.parentalKey || !locked || !hiddenTabs[t.parentalKey]),
    );

  return (
    <>
      <aside
        aria-hidden={chromeHidden}
        className={`relative z-[60] flex w-[200px] shrink-0 flex-col border-r border-edge-soft bg-canvas/40 transition-opacity duration-300 ${
          chromeHidden ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <div
          data-tauri-drag-region
          className="relative flex h-20 shrink-0 items-end px-7 pb-3.5"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-20"
            style={{ background: "radial-gradient(120% 78% at 24% 4%, var(--color-accent-soft), transparent 66%)" }}
          />
          <button
            type="button"
            onClick={() => setView("home")}
            className="relative flex items-center gap-2 text-accent"
            aria-label="Harbor home"
          >
            <HarborMark className="h-[22px] w-[22px] shrink-0 drop-shadow-[0_0_10px_var(--color-accent-soft)]" />
            <span
              className="text-[25px] font-medium leading-none tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Harbor
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <nav className="flex flex-col gap-0.5">
            {visible(PRIMARY).map((t) => (
              <RailItem key={t.view} label={t.label} active={view === t.view} onClick={() => navigate(t)} />
            ))}
          </nav>

          <GoldRule />

          <nav className="flex flex-col gap-0.5">
            {visible(SECONDARY).map((t) => (
              <RailItem key={t.view} label={t.label} active={view === t.view} onClick={() => navigate(t)} />
            ))}
          </nav>

          <GoldRule />

          <nav className="flex flex-col gap-0.5">
            <RailItem label="Settings" active={view === "settings"} onClick={() => setView("settings")} />
          </nav>
        </div>

        <div className="relative flex flex-col gap-2 px-4 py-4">
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, var(--color-accent-soft), transparent)" }}
          />
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated/50 hover:text-ink"
            >
              <Search size={15} strokeWidth={1.8} />
            </button>
            <RecordingPill />
            {view !== "live" && <TogetherButton variant="ghost" popoverPlacement="above-left" />}
          </div>
          <ProfileBlock onOpenSettings={() => setView("settings")} />
          {IS_TAURI && !settings.useNativeTitleBar && (
            <div className="flex items-center justify-end gap-0.5 pt-1">
              <WinBtn onClick={minimize} label="Minimize">
                <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </WinBtn>
              <WinBtn onClick={toggleMaximize} label="Maximize">
                <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.4" rx="1.2" />
              </WinBtn>
              <WinBtn onClick={close} label="Close">
                <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </WinBtn>
            </div>
          )}
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

function RailItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-10 items-center pl-7 pr-3 text-left text-[16px] tracking-tight transition-colors ${
        active ? "text-accent" : "text-ink-muted hover:text-ink"
      }`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      <span
        aria-hidden
        className={`absolute inset-y-1 left-2.5 right-2 rounded-lg transition-opacity duration-200 ${
          active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
        style={{ background: active ? "var(--color-accent-soft)" : "var(--color-elevated)" }}
      />
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
          style={{ background: "var(--color-accent)", boxShadow: "0 0 12px 0 var(--color-accent)" }}
        />
      )}
      <span className="relative">{label}</span>
    </button>
  );
}

function GoldRule() {
  return (
    <div
      aria-hidden
      className="mx-7 my-4 h-px"
      style={{ background: "linear-gradient(90deg, transparent, var(--color-accent-soft), transparent)" }}
    />
  );
}

function WinBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated/60 hover:text-ink"
    >
      <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
        {children}
      </svg>
    </button>
  );
}
