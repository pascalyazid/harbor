import { useEffect, useRef, type RefObject } from "react";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackBuffered, getPlaybackPosition } from "@/lib/player/playback-clock";
import type { PartialSyncState } from "@/lib/together/provider";
import type { RoomSnapshot } from "@/lib/together/client";
import type { SyncState } from "@/lib/together/protocol";
import type { PlayerSrc } from "@/lib/view";
import type { RoomCommand } from "@/lib/together/protocol";
import { GUEST_MAX_WAIT_MS, HOST_HEARTBEAT_MS, HOST_MAX_WAIT_MS, LOBBY_HOLD_MS, SYNC_DRIFT_TOLERANCE_S, SYNC_MAX_AGE_S, SYNC_PLAY_LOOKAHEAD_S, SYNC_SEEK_JUMP_S, SYNC_SUPPRESS_MS } from "../player-utils";

type ForeignNotice = { title: string | null; from: string };

function isDifferentMedia(state: SyncState, src: PlayerSrc): boolean {
  if (!state.mediaId) return false;
  if (state.mediaId !== src.meta.id) return true;
  const se = state.episode;
  const le = src.episode;
  if (!!se !== !!le) return true;
  if (se && le && (se.season !== le.season || se.episode !== le.episode)) return true;
  return false;
}

export function useRoomSync(params: {
  inRoom: boolean;
  isHost: boolean;
  canPublish: boolean;
  hasStarted: boolean;
  setHasStarted: (v: boolean) => void;
  everyoneReady: boolean;
  roomFull: boolean;
  startRoom: () => void;
  selfFrameReadyRef: RefObject<boolean>;
  roomSnapshot: RoomSnapshot;
  clientId: string;
  src: PlayerSrc;
  snap: PlayerSnapshot;
  bridgeRef: RefObject<PlayerBridge | null>;
  publishState: (state: PartialSyncState) => void;
  onIncomingState: (cb: (state: SyncState) => void) => () => void;
  onIncomingCommand: (cb: (from: string, command: RoomCommand) => void) => () => void;
  markReady: (ready: boolean) => void;
  suppressOutgoingFor: (ms: number) => void;
  setForeignNotice: (n: ForeignNotice | null) => void;
  cast?: {
    activeRef: RefObject<boolean>;
    play: () => Promise<void> | void;
    pause: () => Promise<void> | void;
    seek: (sec: number) => Promise<void> | void;
    getPosition: () => number;
    isPlaying: () => boolean;
  };
}) {
  const {
    inRoom,
    isHost,
    canPublish,
    hasStarted,
    setHasStarted,
    everyoneReady,
    roomFull,
    startRoom,
    selfFrameReadyRef,
    roomSnapshot,
    clientId,
    src,
    snap,
    bridgeRef,
    publishState,
    onIncomingState,
    onIncomingCommand,
    markReady,
    suppressOutgoingFor,
    setForeignNotice,
    cast,
  } = params;

  const inRoomRef = useRef(inRoom);
  inRoomRef.current = inRoom;
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const syncCatchUpRef = useRef(false);

  useEffect(() => {
    syncCatchUpRef.current = false;
  }, [src.url, src.meta.id]);

  const publishedRef = useRef<{ status: string; positionSec: number; at: number }>({
    status: "",
    positionSec: 0,
    at: 0,
  });
  const statusRef = useRef(snap.status);
  statusRef.current = snap.status;
  const durationRef = useRef(snap.durationSec);
  durationRef.current = snap.durationSec;
  const rateRef = useRef(snap.rate);
  rateRef.current = snap.rate;
  const initialSyncDoneRef = useRef(false);

  useEffect(() => {
    if (!inRoom || !isHost || !hasStarted) return;
    if (cast?.activeRef.current) return;
    const tick = () => {
      if (cast?.activeRef.current) return;
      const status = statusRef.current;
      if (status !== "playing" && status !== "paused") return;
      const pos = getPlaybackPosition();
      if (durationRef.current <= 0) return;
      if (pos <= 0) return;
      publishState({
        mediaId: src.meta.id,
        mediaTitle: src.meta.name ?? null,
        episode: src.episode
          ? { season: src.episode.season, episode: src.episode.episode, name: src.episode.name }
          : null,
        posterUrl: src.meta.poster ?? null,
        positionSeconds: pos,
        playing: status === "playing",
        speed: rateRef.current,
      });
    };
    tick();
    const id = window.setInterval(tick, HOST_HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [inRoom, isHost, hasStarted, publishState, src.meta.id, src.meta.name, src.meta.poster, src.episode, cast]);

  useEffect(() => {
    if (!inRoom || !isHost) return;
    return onIncomingCommand((_from, command) => {
      if (cast?.activeRef.current) return;
      const b = bridgeRef.current;
      if (!b) return;
      if (command.action === "play") b.play().catch(() => {});
      else if (command.action === "pause") b.pause();
      else if (command.action === "seek") {
        if (durationRef.current <= 0) return;
        b.seek(Math.max(0, Math.min(command.positionSeconds, durationRef.current - 1)));
      }
    });
  }, [inRoom, isHost, onIncomingCommand, bridgeRef, cast]);

  useEffect(() => {
    if (!inRoom) return;
    return onIncomingState((state) => {
      if (state.updatedBy === clientId) return;
      if (cast?.activeRef.current) return;
      const b = bridgeRef.current;
      if (!b) return;
      if (isDifferentMedia(state, src)) {
        setForeignNotice({ title: state.mediaTitle, from: state.updatedBy });
        return;
      }
      if (!state.mediaId) return;
      if (state.speed != null && Math.abs(state.speed - rateRef.current) > 0.01) {
        b.setRate(state.speed);
      }
      const livePos = getPlaybackPosition();
      const ageS = Math.min(SYNC_MAX_AGE_S, Math.max(0, (Date.now() - state.updatedAt) / 1000));
      const target = state.playing
        ? state.positionSeconds + ageS + SYNC_PLAY_LOOKAHEAD_S
        : state.positionSeconds;
      const drift = Math.abs(livePos - target);
      const playStateChanged = state.playing !== (snap.status === "playing");
      const driftTooBig = drift > SYNC_DRIFT_TOLERANCE_S;
      if (syncCatchUpRef.current) {
        if (drift < SYNC_SEEK_JUMP_S) {
          const buffered = getPlaybackBuffered();
          const playing = snap.status === "playing";
          const nearEof =
            snap.durationSec > 0 && livePos + buffered >= snap.durationSec - 0.5;
          if (!playing || (buffered < 2.0 && !nearEof)) {
            if (state.playing !== playing) {
              if (state.playing && !playing) b.play().catch(() => {});
              if (!state.playing && playing) b.pause();
            }
            return;
          }
        }
        syncCatchUpRef.current = false;
      }
      if (!playStateChanged && !driftTooBig) return;
      if (playStateChanged || driftTooBig) {
        b.seek(target);
        if (driftTooBig) syncCatchUpRef.current = true;
      }
      if (state.playing && snap.status !== "playing") b.play().catch(() => {});
      if (!state.playing && snap.status === "playing") b.pause();
    });
  }, [inRoom, onIncomingState, clientId, src.meta.id, suppressOutgoingFor, snap.status, snap.durationSec, cast]);

  useEffect(() => {
    if (!inRoom || !cast) return;
    return onIncomingState((state) => {
      if (state.updatedBy === clientId) return;
      if (!cast.activeRef.current) return;
      if (isDifferentMedia(state, src)) {
        setForeignNotice({ title: state.mediaTitle, from: state.updatedBy });
        return;
      }
      const ageS = Math.min(SYNC_MAX_AGE_S, Math.max(0, (Date.now() - state.updatedAt) / 1000));
      const target = state.playing
        ? state.positionSeconds + ageS + SYNC_PLAY_LOOKAHEAD_S
        : state.positionSeconds;
      const playing = cast.isPlaying();
      const drift = Math.abs(cast.getPosition() - target);
      const playStateChanged = state.playing !== playing;
      if (!playStateChanged && drift <= SYNC_DRIFT_TOLERANCE_S) return;
      suppressOutgoingFor(SYNC_SUPPRESS_MS);
      if (drift > SYNC_DRIFT_TOLERANCE_S) void cast.seek(target);
      if (state.playing && !playing) void cast.play();
      if (!state.playing && playing) void cast.pause();
    });
  }, [inRoom, cast, onIncomingState, clientId, src.meta.id, suppressOutgoingFor, setForeignNotice]);

  useEffect(() => {
    if (!inRoom || !isHost || !cast) return;
    const publishCast = () => {
      if (!cast.activeRef.current) return;
      const pos = cast.getPosition();
      const playing = cast.isPlaying();
      if (snap.durationSec <= 0) return;
      if (pos <= 0 && playing) return;
      publishedRef.current = { status: playing ? "playing" : "paused", positionSec: pos, at: Date.now() };
      publishState({
        mediaId: src.meta.id,
        mediaTitle: src.meta.name ?? null,
        episode: src.episode
          ? { season: src.episode.season, episode: src.episode.episode, name: src.episode.name }
          : null,
        posterUrl: src.meta.poster ?? null,
        positionSeconds: pos,
        playing,
      });
    };
    const id = window.setInterval(publishCast, 3000);
    return () => window.clearInterval(id);
  }, [inRoom, canPublish, cast, publishState, src.meta.id, src.meta.name, src.meta.poster, src.episode]);

  const mediaKey = `${src.meta.id}|${src.episode?.season ?? ""}|${src.episode?.episode ?? ""}`;

  const prevMediaKeyRef = useRef(mediaKey);
  useEffect(() => {
    if (prevMediaKeyRef.current === mediaKey) return;
    prevMediaKeyRef.current = mediaKey;
    if (inRoomRef.current) setHasStarted(false);
  }, [mediaKey, setHasStarted]);

  useEffect(() => {
    selfFrameReadyRef.current = false;
    markReady(false);
  }, [mediaKey, inRoom, markReady, selfFrameReadyRef]);
  useEffect(() => {
    if (!inRoom || selfFrameReadyRef.current) return;
    if (snap.videoWidth > 0 && snap.videoHeight > 0 && snap.durationSec > 0) {
      selfFrameReadyRef.current = true;
      markReady(true);
    }
  }, [inRoom, snap.videoWidth, snap.videoHeight, snap.durationSec, markReady, selfFrameReadyRef]);

  useEffect(() => {
    if (!inRoom || hasStarted || roomSnapshot.started) return;
    const seed = roomSnapshot.syncState;
    const hostId = roomSnapshot.hostClientId;
    if (
      !isHost &&
      seed &&
      !isDifferentMedia(seed, src) &&
      !seed.playing &&
      !!hostId &&
      seed.updatedBy === hostId &&
      Math.abs(getPlaybackPosition() - seed.positionSeconds) > 1.5
    ) {
      bridgeRef.current?.seek(seed.positionSeconds);
    }
    if (snap.status === "playing") bridgeRef.current?.pause();
  }, [inRoom, hasStarted, snap.status, isHost, roomSnapshot.started, roomSnapshot.syncState, roomSnapshot.hostClientId]);

  const lobbySeededRef = useRef(false);
  useEffect(() => {
    lobbySeededRef.current = false;
  }, [mediaKey]);
  useEffect(() => {
    if (!inRoom || !isHost || hasStarted || lobbySeededRef.current) return;
    if (snap.durationSec <= 0) return;
    lobbySeededRef.current = true;
    publishState({
      mediaId: src.meta.id,
      mediaTitle: src.meta.name ?? null,
      episode: src.episode
        ? { season: src.episode.season, episode: src.episode.episode, name: src.episode.name }
        : null,
      posterUrl: src.meta.poster ?? null,
      positionSeconds: getPlaybackPosition(),
      playing: false,
      speed: rateRef.current,
    });
  }, [inRoom, isHost, hasStarted, snap.durationSec, publishState, src.meta.id, src.meta.name, src.meta.poster, src.episode]);

  const startHostRef = useRef<() => void>(() => {});
  startHostRef.current = () => {
    setHasStarted(true);
    startRoom();
    suppressOutgoingFor(0);
    bridgeRef.current?.play().catch(() => {});
  };
  useEffect(() => {
    if (!inRoom || !isHost || hasStarted) return;
    if (!roomFull || !everyoneReady) return;
    const t = window.setTimeout(() => startHostRef.current(), LOBBY_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [inRoom, isHost, hasStarted, roomFull, everyoneReady]);
  useEffect(() => {
    if (!inRoom || !isHost || hasStarted) return;
    const t = window.setTimeout(() => startHostRef.current(), HOST_MAX_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [inRoom, isHost, hasStarted]);

  useEffect(() => {
    if (!inRoom || isHost || hasStarted) return;
    if (roomSnapshot.started) setHasStarted(true);
  }, [inRoom, isHost, hasStarted, roomSnapshot.started]);
  useEffect(() => {
    if (!inRoom || isHost || hasStarted) return;
    const t = window.setTimeout(() => {
      initialSyncDoneRef.current = true;
      setHasStarted(true);
      bridgeRef.current?.play().catch(() => {});
    }, GUEST_MAX_WAIT_MS);
    return () => window.clearTimeout(t);
  }, [inRoom, isHost, hasStarted]);

  useEffect(() => {
    initialSyncDoneRef.current = false;
  }, [mediaKey, inRoom]);
  useEffect(() => {
    if (!inRoom || isHost || !hasStarted || initialSyncDoneRef.current) return;
    const state = roomSnapshot.syncState;
    if (!state || isDifferentMedia(state, src)) return;
    const b = bridgeRef.current;
    if (!b) return;
    initialSyncDoneRef.current = true;
    const ageS = Math.min(SYNC_MAX_AGE_S, Math.max(0, (Date.now() - state.updatedAt) / 1000));
    const target = state.playing
      ? state.positionSeconds + ageS + SYNC_PLAY_LOOKAHEAD_S
      : state.positionSeconds;
    suppressOutgoingFor(SYNC_SUPPRESS_MS);
    if (state.speed != null) b.setRate(state.speed);
    b.seek(target);
    b.play().catch(() => {});
  }, [inRoom, isHost, hasStarted, roomSnapshot.syncState, src.meta.id, suppressOutgoingFor]);

  return { inRoomRef, isHostRef };
}
