import { FormatBadge, type BadgeKind } from "@/components/format-badge";
import { useSettings } from "@/lib/settings";
import {
  CustomCodePanel,
  DownloadsSection,
  LocalEngineSection,
  PlayModePanel,
  PlayerEnginePanel,
  SeekBarPanel,
  SubtitleStylePanel,
} from "./player-panel";
import { Section, ToggleRow } from "./shared";

export function QualityPanel() {
  const { settings, update } = useSettings();
  return (
    <>
      <Section
        title="Play button behavior"
        subtitle="Choose what happens when you hit Play on a title. Manual gives you full control over quality and source."
      >
        <PlayModePanel />
      </Section>

      <Section
        title="Player engine"
        subtitle="HTML5 plays everything WebView2 supports. mpv handles TrueHD, DTS-HD, AV1, weird containers, and HDR. Auto picks based on the source."
      >
        <PlayerEnginePanel />
      </Section>

      <Section
        title="Seek bar"
        subtitle="Style the timeline at the bottom of the player. Swap the dot for a sticker, change the bar height, recolor it. Settings live-preview right here."
      >
        <SeekBarPanel />
      </Section>

      <Section
        title="Subtitle style"
        subtitle="How subtitles look during playback. Live preview below."
      >
        <SubtitleStylePanel />
      </Section>

      <Section
        title="Stream format chips"
        subtitle="The little 4K · HDR · codec · audio chips that ride along each stream in the play picker."
      >
        <ToggleRow
          label="Show format chips on stream rows"
          sub="The picker tags each stream with resolution, HDR flavor, codec, and audio format. Off hides them all."
          value={settings.showQualityBadge}
          onChange={(v) => update({ showQualityBadge: v })}
        />
        <QualityPreview />
      </Section>

      <Section
        title="Poster size"
        subtitle="Scale every poster and card across Home, Discover, and your library. Bump it up on a 4K or large display where the defaults feel small, or shrink it for a denser grid."
      >
        <Segmented
          value={posterSizeKey(settings.posterScale)}
          options={POSTER_SIZES.map((p) => ({ value: p.value, label: p.label }))}
          onChange={(v) =>
            update({ posterScale: POSTER_SIZES.find((p) => p.value === v)?.scale ?? 1 })
          }
        />
      </Section>

      <Section
        title="Trailer quality"
        subtitle="How sharp the trailer is when you hit the preview button. Auto picks from your connection speed. 1080p and Best merge separate video and audio with the bundled ffmpeg, so they take a beat longer to start."
      >
        <Segmented
          value={settings.trailerQuality}
          options={[
            { value: "auto", label: "Auto" },
            { value: "360p", label: "360p" },
            { value: "720p", label: "720p" },
            { value: "1080p", label: "1080p" },
            { value: "best", label: "Best" },
          ]}
          onChange={(v) => update({ trailerQuality: v })}
        />
      </Section>

      <Section
        title="Next episode prompt"
        subtitle="When the Up Next pill appears before an episode ends. Auto scales to the episode length, so short episodes stop prompting so early. Off hides it."
      >
        <Segmented
          value={nextEpLeadKey(settings.nextEpisodeLeadSec)}
          options={NEXT_EP_LEADS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(v) =>
            update({ nextEpisodeLeadSec: NEXT_EP_LEADS.find((o) => o.value === v)?.sec ?? -1 })
          }
        />
      </Section>

      <Section
        title="Downloads"
        subtitle="Where Harbor saves videos when you hit Download in the player. Pick any folder, including one on a different drive."
      >
        <DownloadsSection />
      </Section>

      <LocalEngineSection />

      <Section
        title="Custom code"
        subtitle="Power-user knob. Inject your own CSS, JS, and HTML into Harbor. Lives in your local settings; nothing leaves your machine."
      >
        <CustomCodePanel />
      </Section>
    </>
  );
}

const POSTER_SIZES = [
  { value: "compact", label: "Compact", scale: 0.85 },
  { value: "default", label: "Default", scale: 1 },
  { value: "large", label: "Large", scale: 1.25 },
  { value: "huge", label: "Huge", scale: 1.55 },
] as const;

function posterSizeKey(scale: number): string {
  let best: (typeof POSTER_SIZES)[number] = POSTER_SIZES[0];
  for (const p of POSTER_SIZES) {
    if (Math.abs(p.scale - scale) < Math.abs(best.scale - scale)) best = p;
  }
  return best.value;
}

const NEXT_EP_LEADS = [
  { value: "auto", label: "Auto", sec: -1 },
  { value: "off", label: "Off", sec: 0 },
  { value: "30", label: "30s", sec: 30 },
  { value: "45", label: "45s", sec: 45 },
  { value: "60", label: "1 min", sec: 60 },
  { value: "90", label: "1.5 min", sec: 90 },
  { value: "120", label: "2 min", sec: 120 },
] as const;

function nextEpLeadKey(sec: number): string {
  return NEXT_EP_LEADS.find((o) => o.sec === sec)?.value ?? "auto";
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex w-fit flex-wrap gap-1 rounded-full bg-elevated/40 p-1 ring-1 ring-edge-soft/60">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors ${
            value === o.value
              ? "bg-ink text-canvas"
              : "text-ink-muted hover:bg-raised hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function QualityPreview() {
  const samples: BadgeKind[] = [
    "8k",
    "4k-uhd",
    "uhd",
    "2k-qhd",
    "1080p",
    "1080i",
    "720p",
    "576p",
    "480p",
    "360p",
    "hd",
    "sd",
    "dvd",
    "imax",
    "3d",
    "bluray",
    "remux",
    "webdl",
    "webrip",
    "hdtv",
    "dvb",
    "cam",
    "hdcam",
    "telesync",
    "hdts",
    "telecine",
    "scr",
    "wp",
    "hevc",
    "av1",
    "dv",
    "hdr10-plus",
    "hdr10",
    "hdr",
    "hlg",
    "sdr",
    "atmos",
    "atmos-912",
    "truehd",
    "dts-hd-ma",
    "dts-hd",
    "dts-x",
    "dts",
    "ddp",
    "dd",
    "eac3",
    "ac3",
    "aac",
    "flac",
    "mp3",
    "opus",
    "lpcm",
    "pcm",
    "7.1",
    "5.1",
    "stereo",
    "mono",
    "extended",
    "remastered",
    "repack",
  ];
  return (
    <div className="flex flex-wrap items-center gap-0 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3.5">
      {samples.map((k) => (
        <FormatBadge key={k} kind={k} />
      ))}
    </div>
  );
}
