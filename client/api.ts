declare const ROOT: string;

export type Video = {
  /** unique identifier for video */
  thumbnail_name: string;
  /** only may be used for displaying file name */
  path: string;
  tags: string[];
  note: string;
  mtime: { secs_since_epoch: number; nanos_since_epoch: number };
  stow_state: "Original" | { Elsewhere: string };
  size: number;
  probe: Probe | null;
};
export type Probe = {
  width: number;
  height: number;
  rotation: Rotation;
  duration: number;
  pix_fmt: string;
  color_space: string | null;
  color_transfer: string | null;
  color_primaries: string | null;
  bit_rate: number;
  audio: {
    sample_rate: number;
    bit_rate: number;
    channels: number;
    channel_layout: string;
  } | null;
};
export type Rotation = "Unrotated" | "Neg90" | "Pos90" | "Neg180";
export const isTransposed = (rot: Rotation) =>
  rot === "Neg90" || rot === "Pos90";
export type State = {
  videos: Video[];
  version: string | null;
};
export type VideoMetadataEditReq = {
  target: VideoSelectRequest;
  tag_or_note: string;
};
export type JsonError = {
  error: string;
};
export type VideoSelectRequest =
  | { Thumbnail: string }
  | { Thumbnails: string[] }
  | { Tag: string };

const toJson = async <T = State>(r: Response): Promise<T> =>
  r.ok
    ? r.json()
    : Promise.reject(new Error(`HTTP ${r.status} error: ${await r.text()}`));

export const getList = () => fetch(new URL("/list", ROOT)).then(toJson);

const editMetadata = (path: string, req: VideoMetadataEditReq) =>
  fetch(new URL(path, ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  })
    .then((r) => toJson<State | JsonError>(r))
    .then((resp) =>
      "error" in resp ? Promise.reject(new Error(resp.error)) : resp
    );

export const addTag = (
  video: Video | { thumbnail_name: string }[],
  tag: string
) =>
  editMetadata("/tag/add", {
    target: Array.isArray(video)
      ? { Thumbnails: video.map((video) => video.thumbnail_name) }
      : { Thumbnail: video.thumbnail_name },
    tag_or_note: tag,
  });

export const removeTag = (
  video: Video | { thumbnail_name: string }[],
  tag: string
) =>
  editMetadata("/tag/remove", {
    target: Array.isArray(video)
      ? { Thumbnails: video.map((video) => video.thumbnail_name) }
      : { Thumbnail: video.thumbnail_name },
    tag_or_note: tag,
  });

export const setNote = (video: Video, note: string) =>
  editMetadata("/editnote", {
    target: { Thumbnail: video.thumbnail_name },
    tag_or_note: note,
  });

export const getVideoUrl = (video: Video) =>
  new URL(`/v/${encodeURIComponent(video.thumbnail_name)}`, ROOT);

export const getThumbnailUrl = (video: Video) =>
  new URL(`/t/${encodeURIComponent(video.thumbnail_name)}`, ROOT);

// using real video for preview now
export const getPreviewUrl = (video: Video) =>
  new URL(`/v/${encodeURIComponent(video.thumbnail_name)}`, ROOT);

const deleteVideos = (request: VideoSelectRequest) =>
  fetch(new URL("/videos", ROOT), {
    method: "DELETE",
    body: JSON.stringify(request),
  }).then(toJson);

export const deleteVideo = (video: Video) =>
  deleteVideos({ Thumbnail: video.thumbnail_name });

export const deleteVideosByTag = (tag: string) => deleteVideos({ Tag: tag });

export const createPreviewList = (tag: string) =>
  fetch(new URL("/preview", ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tag }),
  }).then(toJson);

export type CookClip = {
  start: number;
  end: number;
  thumbnail_name: string;
  override_rotation: Rotation | null;
};

export type Size = { width: number; height: number };

const decoder = new TextDecoder();
export const cook = async function* (
  clips: CookClip[],
  encoding: Probe,
  name: string
): AsyncGenerator<string> {
  const response = await fetch(new URL("/cook", ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clips, encoding, name }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} error: ${await response.text()}`);
  }

  const reader = response.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    yield decoder.decode(value);
  }
};

export const renameTag = (oldName: string, newName: string) =>
  fetch(new URL("/tag/rename", ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ old: oldName, new: newName }),
  }).then(toJson);

export const moveForYouTube = (tag: string) =>
  fetch(new URL("/for-youtube", ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ Tag: tag }),
  }).then(toJson);

export const restoreFiles = (tag: string) =>
  fetch(new URL("/restore", ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ Tag: tag }),
  }).then(toJson);
