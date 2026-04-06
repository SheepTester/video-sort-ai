import type { Clip } from "./types";

export type PlaybackState = {
  time: number;
  playing: boolean;
  speedUp: boolean;
  clips: Clip[];
};

export type VideoState = {
  thumb: string;
  currentTime: number;
  paused: boolean;
};

export type PlaybackAction = {
  type: "PLAY" | "PAUSE" | "SEEK" | "SET_PLAYBACK_RATE" | "SET_MUTED";
  thumb: string;
  value?: number | boolean;
};

export type PlaybackDecision = {
  actions: PlaybackAction[];
  newState?: Partial<PlaybackState>;
};

export function calculatePlaybackDecision(
  state: PlaybackState,
  videos: VideoState[]
): PlaybackDecision {
  const { time, playing, speedUp, clips } = state;

  const totalDuration = clips.reduce((cum, curr) => cum + curr.end - curr.start, 0);

  const actions: PlaybackAction[] = [];
  const newState: Partial<PlaybackState> = {};

  if (time >= totalDuration && playing) {
    newState.playing = false;
    newState.time = totalDuration;
    for (const video of videos) {
      if (!video.paused) {
        actions.push({ type: "PAUSE", thumb: video.thumb });
      }
    }
    return { actions, newState };
  }

  let t = 0;
  let viewingClip: { offset: number; clip: Clip } | null = null;
  for (const clip of clips) {
    const duration = clip.end - clip.start;
    if (time - t < duration || (time >= totalDuration && t + duration >= totalDuration)) {
      viewingClip = { offset: t, clip };
      break;
    }
    t += duration;
  }

  if (!viewingClip) {
    for (const video of videos) {
      if (!video.paused) {
        actions.push({ type: "PAUSE", thumb: video.thumb });
      }
      actions.push({ type: "SET_MUTED", thumb: video.thumb, value: true });
    }
    return { actions, newState };
  }

  const activeThumb = viewingClip.clip.thumb;
  const activeVideo = videos.find((v) => v.thumb === activeThumb);

  for (const video of videos) {
    if (video.thumb !== activeThumb) {
      if (!video.paused) {
        actions.push({ type: "PAUSE", thumb: video.thumb });
      }
      actions.push({ type: "SET_MUTED", thumb: video.thumb, value: true });
    }
  }

  if (!activeVideo) {
     return { actions, newState };
  }

  actions.push({ type: "SET_MUTED", thumb: activeThumb, value: false });
  actions.push({ type: "SET_PLAYBACK_RATE", thumb: activeThumb, value: speedUp ? 2 : 1 });

  const expectedTime = time - viewingClip.offset + viewingClip.clip.start;

  if (playing) {
    if (activeVideo.paused) {
      actions.push({ type: "PLAY", thumb: activeThumb });
    }

    if (activeVideo.currentTime > viewingClip.clip.end) {
      const nextTime = viewingClip.offset + (viewingClip.clip.end - viewingClip.clip.start);
      if (nextTime >= totalDuration) {
        newState.playing = false;
        newState.time = totalDuration;
      } else {
        newState.time = nextTime;
      }
    } else if (Math.abs(activeVideo.currentTime - expectedTime) > 0.5) {
      actions.push({ type: "SEEK", thumb: activeThumb, value: expectedTime });
    } else {
      const currentGlobalTime = viewingClip.offset + activeVideo.currentTime - viewingClip.clip.start;
      // Don't emit state update if the change is very small to avoid thrashing
      if (Math.abs(time - currentGlobalTime) > 0.05) {
           newState.time = currentGlobalTime;
      }
    }
  } else {
    if (!activeVideo.paused) {
      actions.push({ type: "PAUSE", thumb: activeThumb });
    }
    if (Math.abs(activeVideo.currentTime - expectedTime) > 0.05) {
      actions.push({ type: "SEEK", thumb: activeThumb, value: expectedTime });
    }
  }

  return { actions, newState: Object.keys(newState).length > 0 ? newState : undefined };
}
