import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { getThumbnailUrl, Probe, Video } from "../api";
import { extractFilename, map } from "../util";

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
  sizes: [string, Set<Video>][];
  open: boolean;
  onClose: () => void;
  onCook: (encoding: Probe) => void;
};
export function CookModal({
  videos,
  sizes,
  open,
  onClose,
  onCook,
}: CookModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [hasBeenOpen, setHasBeenOpen] = useState(false);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      setHasBeenOpen(true);
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

  const handleDimChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.currentTarget.value) {
      const input = e.currentTarget
        .closest(".otherp")
        ?.querySelector("[type=radio]");
      if (input instanceof HTMLInputElement) input.checked = true;
    }
  };
  const maxSize = useMemo(
    () =>
      sizes
        .map(([size]) => {
          const [width, height] = size.split("x").map(Number);
          return { width, height };
        })
        .reduce(
          (cum, curr) => ({
            width: cum.width + curr.width,
            height: cum.height + curr.height,
          }),
          { width: 0, height: 0 }
        ),
    [sizes]
  );

  // do not render body until it opens
  if (!hasBeenOpen && !open) {
    return <dialog ref={dialogRef} className="modal cook-container" />;
  }

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
              sample_rate: Number(data.get("sample_rate")),
              channels: Number(data.get("channels")),
              channel_layout: String(data.get("channel_layout")),
              // Unused
              bit_rate: 0,
            };
          }
          const [width, height] =
            data.get("size") === "other"
              ? [Number(data.get("width")), Number(data.get("height"))]
              : String(data.get("size")).split("x");
          onCook({
            width: +width,
            height: +height,
            pix_fmt: String(data.get("pix_fmt")),
            color_primaries: map(data.get("color_primaries"), String),
            color_space: map(data.get("color_space"), String),
            color_transfer: map(data.get("color_transfer"), String),
            audio,
            // unused
            bit_rate: 0,
            duration: 0,
            rotation: "Unrotated",
          });
        }}
      >
        <fieldset className="choices">
          <legend>Video Resolution</legend>
          {sizes.map(([size, videos], i) => (
            <p key={size} className="radiop">
              <label>
                <input
                  type="radio"
                  name="size"
                  value={size}
                  defaultChecked={i === 0}
                />{" "}
                {size.replace("x", "×")}
              </label>
              {Array.from(videos, (video) => (
                <img
                  key={video.thumbnail_name}
                  alt={extractFilename(video)}
                  src={getThumbnailUrl(video).toString()}
                />
              ))}
            </p>
          ))}
          <p className="otherp">
            <label>
              <input type="radio" name="size" value="other" /> Custom
            </label>{" "}
            <label className="num">
              Width:{" "}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                name="width"
                defaultValue={maxSize.width}
                onChange={handleDimChange}
              />
            </label>{" "}
            <label className="num">
              Height:{" "}
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                name="height"
                defaultValue={maxSize.height}
                onChange={handleDimChange}
              />
            </label>
          </p>
        </fieldset>
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
