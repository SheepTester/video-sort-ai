import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Probe, Video, getThumbnailUrl } from "../api";
import { groupBy } from "../util";

type TrimmerProps = {
  videos: Video[];
  open: boolean;
  onClose: () => void;
  onCook: (encoding: Probe) => void;
};

type ProbeField<T> = {
  value: T;
  label: string;
  videos: Video[];
};

export function CookModal({ videos, open, onClose, onCook }: TrimmerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const probedVideos = useMemo(
    () => videos.filter((video) => video.probe),
    [videos]
  );
  const firstVideo = videos[0]?.probe;
  const hasAudio = useMemo(
    () => probedVideos.some((video) => video.probe?.audio),
    [probedVideos]
  );

  const unique = <T,>(
    toValue: (v: NonNullable<Video["probe"]>) => T,
    toLabel: (v: T) => string
  ) =>
    Object.entries(groupBy(probedVideos, (v) => toValue(v.probe!))).map(
      ([, videos]) => {
        const value = toValue(videos[0].probe!);
        return {
          value,
          label: toLabel(value),
          videos,
        };
      }
    );

  const uniqueAudio = <T,>(
    field: keyof NonNullable<Probe["audio"]>,
    toLabel: (v: T) => string
  ) => {
    const audioProbed = probedVideos.filter((v) => v.probe!.audio);
    return Object.entries(
      groupBy(audioProbed, (v) => v.probe!.audio![field])
    ).map(([, videos]) => {
      const value = videos[0].probe!.audio![field] as T;
      return {
        value,
        label: toLabel(value),
        videos,
      };
    });
  };

  const resolutionOptions = useMemo(
    () =>
      unique(
        (p) => `${p.width}x${p.height}`,
        (v) => v
      ),
    [probedVideos]
  );

  const pixFmtOptions = useMemo(
    () => unique((p) => p.pix_fmt, String),
    [probedVideos]
  );
  const colorSpaceOptions = useMemo(
    () => unique((p) => p.color_space ?? "null", String),
    [probedVideos]
  );
  const colorTransferOptions = useMemo(
    () => unique((p) => p.color_transfer ?? "null", String),
    [probedVideos]
  );
  const colorPrimariesOptions = useMemo(
    () => unique((p) => p.color_primaries ?? "null", String),
    [probedVideos]
  );

  const sampleRateOptions = useMemo(
    () => uniqueAudio("sample_rate", (v: number) => `${v / 1000} kHz`),
    [probedVideos]
  );
  const channelOptions = useMemo(
    () => uniqueAudio("channels", String),
    [probedVideos]
  );
  const channelLayoutOptions = useMemo(
    () => uniqueAudio("channel_layout", String),
    [probedVideos]
  );

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  const Radio = <T,>({
    name,
    options,
    defaultValue,
  }: {
    name: string;
    options: ProbeField<T>[];
    defaultValue?: T;
  }) => (
    <div className="cook-field">
      <h4>{name}</h4>
      {options.map(({ value, label, videos }) => (
        <label key={label}>
          <input
            type="radio"
            name={name}
            value={label}
            defaultChecked={label === defaultValue}
          />
          {label}
          <div className="videos">
            {videos.map((video) => (
              <img
                key={video.thumbnail_name}
                src={getThumbnailUrl(video).toString()}
              />
            ))}
          </div>
        </label>
      ))}
    </div>
  );

  return (
    <dialog ref={dialogRef} onClose={onClose} className="modal cook-container">
      <form method="dialog" className="cook-header">
        <button type="submit">&lt; back</button>
        <h3>cook settings</h3>
      </form>
      <form
        className="cook-body"
        onSubmit={(e) => {
          e.preventDefault();
          if (!firstVideo) {
            return;
          }
          const data = new FormData(e.currentTarget);
          const resolution = data.get("resolution") as string;
          const [width, height] =
            resolution === "other"
              ? [
                  data.get("width") as string,
                  data.get("height") as string,
                ].map(Number)
              : resolution.split("x").map(Number);
          const pix_fmt = data.get("pixel format") as string;
          const color_space = data.get("color space") as string;
          const color_transfer = data.get("color transfer") as string;
          const color_primaries = data.get("color primaries") as string;

          onCook({
            ...firstVideo,
            width,
            height,
            pix_fmt,
            color_space: color_space === "null" ? null : color_space,
            color_transfer: color_transfer === "null" ? null : color_transfer,
            color_primaries:
              color_primaries === "null" ? null : color_primaries,
            audio: hasAudio
              ? {
                  ...firstVideo.audio!,
                  sample_rate: Number(
                    (data.get("sample rate") as string).replace(" kHz", "")
                  ),
                  channels: Number(data.get("channels") as string),
                  channel_layout: data.get("channel layout") as string,
                }
              : undefined,
          });
        }}
      >
        <div className="cook-field">
          <h4>resolution</h4>
          {resolutionOptions.map(({ value, label, videos }) => (
            <label key={label}>
              <input
                type="radio"
                name="resolution"
                value={label}
                defaultChecked={
                  `${firstVideo?.width}x${firstVideo?.height}` === label
                }
              />
              {label}
              <div className="videos">
                {videos.map((video) => (
                  <img
                    key={video.thumbnail_name}
                    src={getThumbnailUrl(video).toString()}
                  />
                ))}
              </div>
            </label>
          ))}
          <label>
            <input type="radio" name="resolution" value="other" />
            other
            <div className="custom-resolution">
              <input
                name="width"
                type="number"
                defaultValue={firstVideo?.width}
              />
              x
              <input
                name="height"
                type="number"
                defaultValue={firstVideo?.height}
              />
            </div>
          </label>
        </div>
        <Radio
          name="pixel format"
          options={pixFmtOptions}
          defaultValue={firstVideo?.pix_fmt}
        />
        <Radio
          name="color space"
          options={colorSpaceOptions}
          defaultValue={firstVideo?.color_space ?? "null"}
        />
        <Radio
          name="color transfer"
          options={colorTransferOptions}
          defaultValue={firstVideo?.color_transfer ?? "null"}
        />
        <Radio
          name="color primaries"
          options={colorPrimariesOptions}
          defaultValue={firstVideo?.color_primaries ?? "null"}
        />
        {hasAudio && (
          <>
            <h3>audio</h3>
            <Radio
              name="sample rate"
              options={sampleRateOptions}
              defaultValue={
                firstVideo?.audio
                  ? `${firstVideo.audio.sample_rate / 1000} kHz`
                  : undefined
              }
            />
            <Radio
              name="channels"
              options={channelOptions}
              defaultValue={firstVideo?.audio?.channels}
            />
            <Radio
              name="channel layout"
              options={channelLayoutOptions}
              defaultValue={firstVideo?.audio?.channel_layout}
            />
          </>
        )}
        <button type="submit" disabled={!firstVideo}>
          cook! 🧑‍🍳
        </button>
      </form>
    </dialog>
  );
}
