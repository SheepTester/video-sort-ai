import { useEffect, useMemo, useRef } from "react";
import { getThumbnailUrl, Probe, Video } from "../api";
import { expect, extractFilename, map } from "../util";

const keysVideo = [
  "pix_fmt",
  "color_primaries",
  "color_space",
  "color_transfer",
] as const satisfies (keyof Probe)[];
const keysAudio = [
  "channel_layout",
  "channels",
  "sample_rate",
] as const satisfies (keyof NonNullable<Probe["audio"]>)[];

export type CookModalProps = {
  videos: Video[];
  open: boolean;
  onClose: () => void;
  onCook: (encoding: Probe) => void;
};
export function CookModal({ videos, open, onClose, onCook }: CookModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  const options = useMemo(() => {
    const map: Record<string, Record<string, Video[]>> = {};
    for (const video of videos) {
      if (!video.probe) continue;
      for (const key of keysVideo) {
        if (video.probe[key] !== null) {
          map[key] ??= {};
          map[key][video.probe[key]] ??= [];
          map[key][video.probe[key]].push(video);
        }
      }
      if (video.probe.audio) {
        for (const key of keysAudio) {
          map[key] ??= {};
          map[key][video.probe.audio[key]] ??= [];
          map[key][video.probe.audio[key]].push(video);
        }
      }
    }
    console.log(map);
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [
        k,
        Object.entries(v).sort((a, b) => b[1].length - a[1].length),
      ])
    );
  }, [videos]);

  const renderField = (
    key: (typeof keysVideo | typeof keysAudio)[number],
    label: string
  ) => {
    const choices = options[key];
    if (!choices) {
      return null;
    }
    return (
      <fieldset className="choices">
        <legend>{label}</legend>
        {choices.map(([choice, videos], i) => (
          <p key={choice}>
            <label>
              <input
                type="radio"
                name={key}
                value={choice}
                defaultChecked={i === 0}
              />{" "}
              <code>{choice}</code>
            </label>
            {videos.map((video) => (
              <img
                key={video.thumbnail_name}
                alt={extractFilename(video)}
                src={getThumbnailUrl(video).toString()}
              />
            ))}
          </p>
        ))}
      </fieldset>
    );
  };

  return (
    <dialog ref={dialogRef} onClose={onClose} className="modal cook-container">
      <form method="dialog" className="cook-header">
        <button type="submit">&lt; back</button>
        <h3>cook settings</h3>
      </form>
      <form
        className="cookform"
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          let audio: Probe["audio"] = null;
          if (data.has("sample_rate")) {
            audio = {
              sample_rate:
                map(data.get("sample_rate"), Number) ?? expect("sample_rate"),
              channels: map(data.get("channels"), Number) ?? expect("channels"),
              channel_layout:
                map(data.get("channel_layout"), String) ??
                expect("channel_layout"),
              // Unused
              bit_rate: 0,
            };
          }
          onCook({
            pix_fmt: map(data.get("pix_fmt"), String) ?? expect("pix_fmt"),
            color_primaries: map(data.get("color_primaries"), String),
            color_space: map(data.get("color_space"), String),
            color_transfer: map(data.get("color_transfer"), String),
            width: 0,
            height: 0,
            audio,
            // unused
            bit_rate: 0,
            duration: 0,
            rotation: "Unrotated",
          });
        }}
      >
        {renderField("pix_fmt", "Pixel Format")}
        {renderField("color_primaries", "Color Primaries")}
        {renderField("color_space", "Color Space")}
        {renderField("color_transfer", "Color Transfer Characteristics")}
        {options["sample_rate"].length > 0 ? (
          <>
            <h4>Audio</h4>
            {renderField("sample_rate", "Sample Rate")}
            {renderField("channels", "Channel Count")}
            {renderField("channel_layout", "Channel Layout")}
          </>
        ) : (
          <p>Your clips have no audio.</p>
        )}
        <button type="submit">cook! 🧑‍🍳</button>
      </form>
    </dialog>
  );
}
