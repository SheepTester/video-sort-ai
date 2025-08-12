import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Probe, Video, getThumbnailUrl } from "../api";
import { groupBy, uniqBy } from "../util";

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

const toVideoMap = (videos: Video[]) =>
  Object.fromEntries(videos.map((video) => [video.thumbnail_name, video]));

export function CookModal({ videos, open, onClose, onCook }: TrimmerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [probe, setProbe] = useState<Probe | null>(null);

  const probedVideos = useMemo(
    () => videos.filter((video) => video.probe),
    [videos]
  );
  const videoMap = useMemo(() => toVideoMap(videos), [videos]);
  const firstVideo = videos[0]?.probe;
  const hasAudio = useMemo(
    () => probedVideos.some((video) => video.probe?.audio),
    [probedVideos]
  );

  const unique = <T,>(
    field: keyof Probe,
    toValue: (v: NonNullable<Video["probe"]>) => T,
    toLabel: (v: T) => string
  ) =>
    Object.entries(groupBy(probedVideos, (v) => toValue(v.probe!))).map(
      ([value, videos]) => ({
        value: toValue(videos[0].probe!),
        label: toLabel(toValue(videos[0].probe!)),
        videos,
      })
    );

  const uniqueAudio = <T,>(
    field: keyof NonNullable<Probe["audio"]>,
    toLabel: (v: T) => string
  ) => {
    const audioProbed = probedVideos.filter((v) => v.probe!.audio);
    return Object.entries(
      groupBy(audioProbed, (v) => v.probe!.audio![field])
    ).map(([value, videos]) => ({
      value: videos[0].probe!.audio![field],
      label: toLabel(videos[0].probe!.audio![field] as T),
      videos,
    }));
  };

  const resolutionOptions = useMemo(
    () =>
      unique(
        "width",
        (p) => ({ width: p.width, height: p.height }),
        (v) => `${v.width}x${v.height}`
      ),
    [probedVideos]
  );

  const pixFmtOptions = useMemo(
    () => unique("pix_fmt", (p) => p.pix_fmt, String),
    [probedVideos]
  );
  const colorSpaceOptions = useMemo(
    () => unique("color_space", (p) => p.color_space, String),
    [probedVideos]
  );
  const colorTransferOptions = useMemo(
    () => unique("color_transfer", (p) => p.color_transfer, String),
    [probedVideos]
  );
  const colorPrimariesOptions = useMemo(
    () => unique("color_primaries", (p) => p.color_primaries, String),
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
      setProbe(
        firstVideo
          ? {
              ...firstVideo,
              audio: hasAudio ? firstVideo.audio : undefined,
            }
          : null
      );
    } else {
      dialogRef.current?.close();
    }
  }, [open, firstVideo, hasAudio]);

  const setField = <T,>(field: keyof Probe, value: T) =>
    setProbe((p) => (p ? { ...p, [field]: value } : null));

  const setAudioField = <T,>(
    field: keyof NonNullable<Probe["audio"]>,
    value: T
  ) =>
    setProbe((p) =>
      p ? { ...p, audio: p.audio ? { ...p.audio, [field]: value } : p.audio } : null
    );

  const [customResolution, setCustomResolution] = useState(false);

  const Radio = <T,>({
    name,
    options,
    get,
    set,
    other,
  }: {
    name: string;
    options: ProbeField<T>[];
    get: (p: Probe) => T;
    set: (v: T) => void;
    other?: ReactNode;
  }) => (
    <div className="cook-field">
      <h4>{name}</h4>
      {options.map(({ value, label, videos }) => (
        <label key={label}>
          <input
            type="radio"
            name={name}
            value={label}
            checked={probe ? !customResolution && label === get(probe) : false}
            onChange={() => {
              set(value);
              if (other) {
                setCustomResolution(false);
              }
            }}
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
      {other && (
        <label>
          <input
            type="radio"
            name={name}
            value="other"
            checked={customResolution}
            onChange={() => setCustomResolution(true)}
          />
          other
          {customResolution && other}
        </label>
      )}
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
          if (probe) {
            onCook(probe);
          }
        }}
      >
        <Radio
          name="resolution"
          options={resolutionOptions}
          get={(p) => `${p.width}x${p.height}`}
          set={(v) => {
            setField("width", v.width);
            setField("height", v.height);
          }}
          other={
            <div className="custom-resolution">
              <input
                type="number"
                value={probe?.width}
                onChange={(e) => setField("width", e.target.valueAsNumber)}
              />
              x
              <input
                type="number"
                value={probe?.height}
                onChange={(e) => setField("height", e.target.valueAsNumber)}
              />
            </div>
          }
        />
        <Radio
          name="pixel format"
          options={pixFmtOptions}
          get={(p) => p.pix_fmt}
          set={(v) => setField("pix_fmt", v)}
        />
        <Radio
          name="color space"
          options={colorSpaceOptions}
          get={(p) => p.color_space}
          set={(v) => setField("color_space", v)}
        />
        <Radio
          name="color transfer"
          options={colorTransferOptions}
          get={(p) => p.color_transfer}
          set={(v) => setField("color_transfer", v)}
        />
        <Radio
          name="color primaries"
          options={colorPrimariesOptions}
          get={(p) => p.color_primaries}
          set={(v) => setField("color_primaries", v)}
        />
        {hasAudio && (
          <>
            <h3>audio</h3>
            <Radio
              name="sample rate"
              options={sampleRateOptions}
              get={(p) => p.audio?.sample_rate}
              set={(v) => setAudioField("sample_rate", v)}
            />
            <Radio
              name="channels"
              options={channelOptions}
              get={(p) => p.audio?.channels}
              set={(v) => setAudioField("channels", v)}
            />
            <Radio
              name="channel layout"
              options={channelLayoutOptions}
              get={(p) => p.audio?.channel_layout}
              set={(v) => setAudioField("channel_layout", v)}
            />
          </>
        )}
        <button type="submit" disabled={!probe}>
          cook! 🧑‍🍳
        </button>
      </form>
    </dialog>
  );
}
