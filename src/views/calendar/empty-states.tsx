import { Calendar as CalendarIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { CalendarFilter } from "@/lib/calendar";
import type { Settings } from "@/lib/settings";

type Source = Settings["calendarSource"];

function EmptyShell({
  heading,
  body,
  action,
}: {
  heading: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
      <CalendarIcon size={28} strokeWidth={1.6} className="text-ink-subtle" />
      <h2 className="text-[16px] font-semibold text-ink">{heading}</h2>
      <p className="max-w-md text-[13.5px] leading-relaxed text-ink-muted">{body}</p>
      {action}
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-1 rounded-full bg-ink px-5 py-2 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
    >
      {children}
    </button>
  );
}

export function NoKeyState({ onSetup }: { onSetup: () => void }) {
  return (
    <EmptyShell
      heading="All upcoming needs a TMDB key"
      body="TMDB powers the firehose of every release this month. The free tier covers it. About 60 seconds to set up. Switch to My Library if you'd rather only see what you've saved."
      action={<ActionButton onClick={onSetup}>Open settings</ActionButton>}
    />
  );
}

export function NotSignedInState({ onSignIn }: { onSignIn: () => void }) {
  return (
    <EmptyShell
      heading="Sign in to see your library calendar"
      body="My Library shows upcoming episodes from the shows you've saved on Stremio. Sign in to wire it up."
      action={<ActionButton onClick={onSignIn}>Sign in</ActionButton>}
    />
  );
}

export function EmptyState({
  source,
  filter,
  watchlistOnly,
}: {
  source: Source;
  filter: CalendarFilter;
  watchlistOnly: boolean;
}) {
  const heading =
    source === "library"
      ? "Nothing from your library this month"
      : source === "trakt"
        ? "Nothing on Trakt this month"
        : source === "anticipated"
          ? "Nothing anticipated this month"
          : source === "simkl"
            ? "Nothing on Simkl this month"
            : source === "simkl-anticipated"
              ? "No Simkl premieres this month"
              : "Nothing this month";
  const body =
    source === "library"
      ? "Your saved shows have no episodes scheduled for this month. Switch to All upcoming to browse the full release calendar."
      : source === "trakt"
        ? "Trakt has no upcoming releases for your watchlist this month. Past months and dates more than six months out aren't covered by Trakt's calendar feed."
        : source === "anticipated"
          ? "None of Trakt's most-anticipated upcoming releases land in this month. Try a different month."
          : source === "simkl"
            ? "Your Simkl plan-to-watch list has no episodes airing this month. Switch to All upcoming to browse everything."
            : source === "simkl-anticipated"
              ? "Simkl lists no new shows or anime premiering this month. Try a different month."
              : watchlistOnly
            ? "Nothing from your library lands this month. Toggle Watchlist off to see all releases."
            : filter === "all"
              ? "TMDB has no notable releases for this month and region."
              : `No ${filter === "movie" ? "movies" : filter === "tv" ? "TV" : "anime"} releases this month. Try a different filter.`;
  return <EmptyShell heading={heading} body={body} />;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-rose-300/30 bg-rose-400/[0.06] px-8 py-14 text-center">
      <p className="text-[14px] font-semibold text-rose-100">Couldn't load the calendar</p>
      <p className="text-[12.5px] text-rose-100/85">{message}</p>
    </div>
  );
}
