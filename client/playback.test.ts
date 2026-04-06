import test from "node:test";
import assert from "node:assert";
import { calculatePlaybackDecision } from "./playback";
import type { PlaybackState, VideoState } from "./playback";
import type { Clip } from "./types";

test("calculatePlaybackDecision", async (t) => {
  await t.test("mutes inactive videos and un-mutes active video", () => {
    const clips: Clip[] = [
      { id: "1", thumb: "vid1", start: 0, end: 10 },
      { id: "2", thumb: "vid2", start: 5, end: 15 },
    ];

    const state: PlaybackState = {
      time: 5, // still in the first clip (duration 10)
      playing: true,
      speedUp: false,
      clips,
    };

    const videos: VideoState[] = [
      { thumb: "vid1", currentTime: 5, paused: false },
      { thumb: "vid2", currentTime: 5, paused: false },
    ];

    const decision = calculatePlaybackDecision(state, videos);

    // vid2 should be paused and muted
    assert.ok(decision.actions.some(a => a.type === "PAUSE" && a.thumb === "vid2"));
    assert.ok(decision.actions.some(a => a.type === "SET_MUTED" && a.thumb === "vid2" && a.value === true));

    // vid1 should be unmuted
    assert.ok(decision.actions.some(a => a.type === "SET_MUTED" && a.thumb === "vid1" && a.value === false));
  });

  await t.test("updates global time when active video is playing smoothly", () => {
    const clips: Clip[] = [
      { id: "1", thumb: "vid1", start: 0, end: 10 },
    ];

    const state: PlaybackState = {
      time: 2,
      playing: true,
      speedUp: false,
      clips,
    };

    const videos: VideoState[] = [
      { thumb: "vid1", currentTime: 2.1, paused: false },
    ];

    const decision = calculatePlaybackDecision(state, videos);

    assert.strictEqual(decision.newState?.time, 2.1);
    assert.ok(!decision.actions.some(a => a.type === "SEEK"));
  });

  await t.test("seeks active video if it diverges from global time significantly", () => {
    const clips: Clip[] = [
      { id: "1", thumb: "vid1", start: 0, end: 10 },
    ];

    // User scrubbed global time to 8
    const state: PlaybackState = {
      time: 8,
      playing: true,
      speedUp: false,
      clips,
    };

    // Video is still at 2
    const videos: VideoState[] = [
      { thumb: "vid1", currentTime: 2, paused: false },
    ];

    const decision = calculatePlaybackDecision(state, videos);

    // Engine should seek video to 8
    const seekAction = decision.actions.find(a => a.type === "SEEK" && a.thumb === "vid1");
    assert.ok(seekAction);
    assert.strictEqual(seekAction.value, 8);
  });

  await t.test("snaps to next clip when active video exceeds clip bounds", () => {
    const clips: Clip[] = [
      { id: "1", thumb: "vid1", start: 0, end: 10 },
      { id: "2", thumb: "vid2", start: 0, end: 10 },
    ];

    const state: PlaybackState = {
      time: 9.9,
      playing: true,
      speedUp: false,
      clips,
    };

    // Video exceeded clip end
    const videos: VideoState[] = [
      { thumb: "vid1", currentTime: 10.1, paused: false },
    ];

    const decision = calculatePlaybackDecision(state, videos);

    // Should bump global time to 10 (start of next clip)
    assert.strictEqual(decision.newState?.time, 10);
  });

  await t.test("stops playing when active video exceeds the end of the final clip", () => {
    const clips: Clip[] = [
      { id: "1", thumb: "vid1", start: 0, end: 10 },
    ];

    const state: PlaybackState = {
      time: 9.9,
      playing: true,
      speedUp: false,
      clips,
    };

    // Video exceeded final clip end
    const videos: VideoState[] = [
      { thumb: "vid1", currentTime: 10.1, paused: false },
    ];

    const decision = calculatePlaybackDecision(state, videos);

    assert.strictEqual(decision.newState?.playing, false);
    assert.strictEqual(decision.newState?.time, 10);
  });

  await t.test("stops playing and pauses videos when global time exceeds total duration", () => {
    const clips: Clip[] = [
      { id: "1", thumb: "vid1", start: 0, end: 10 },
    ];

    const state: PlaybackState = {
      time: 11,
      playing: true,
      speedUp: false,
      clips,
    };

    const videos: VideoState[] = [
      { thumb: "vid1", currentTime: 10, paused: false },
    ];

    const decision = calculatePlaybackDecision(state, videos);

    assert.strictEqual(decision.newState?.playing, false);
    assert.strictEqual(decision.newState?.time, 10);
    assert.ok(decision.actions.some(a => a.type === "PAUSE" && a.thumb === "vid1"));
  });

  await t.test("applies 2x playback speed", () => {
    const clips: Clip[] = [
      { id: "1", thumb: "vid1", start: 0, end: 10 },
    ];

    const state: PlaybackState = {
      time: 5,
      playing: true,
      speedUp: true,
      clips,
    };

    const videos: VideoState[] = [
      { thumb: "vid1", currentTime: 5, paused: false },
    ];

    const decision = calculatePlaybackDecision(state, videos);

    const speedAction = decision.actions.find(a => a.type === "SET_PLAYBACK_RATE" && a.thumb === "vid1");
    assert.ok(speedAction);
    assert.strictEqual(speedAction.value, 2);
  });

  await t.test("does not loop/seek when active video has naturally advanced up to 0.5s before React processes the update", () => {
    const clips: Clip[] = [
      { id: "1", thumb: "vid1", start: 0, end: 10 },
    ];

    const state: PlaybackState = {
      time: 0,
      playing: true,
      speedUp: false,
      clips,
    };

    const videos: VideoState[] = [
      { thumb: "vid1", currentTime: 0.25, paused: false },
    ];

    const decision = calculatePlaybackDecision(state, videos);

    assert.ok(!decision.actions.some(a => a.type === "SEEK"));
    assert.strictEqual(decision.newState?.time, 0.25);
  });

  await t.test("does not seek when sped up and active video is further ahead", () => {
    const clips: Clip[] = [
      { id: "1", thumb: "vid1", start: 0, end: 10 },
    ];

    const state: PlaybackState = {
      time: 0,
      playing: true,
      speedUp: true,
      clips,
    };

    const videos: VideoState[] = [
      { thumb: "vid1", currentTime: 0.8, paused: false },
    ];

    const decision = calculatePlaybackDecision(state, videos);

    assert.ok(!decision.actions.some(a => a.type === "SEEK"));
    assert.strictEqual(decision.newState?.time, 0.8);
  });
});
