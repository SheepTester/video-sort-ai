import { Clip } from "./types";

declare const ROOT: string;

export type Video = {
  path: string;
  thumbnail_name: string;
  tags: string[];
  note: string;
  mtime: { secs_since_epoch: number; nanos_since_epoch: number };
  stowed: boolean;
  size: number;
  preview2?: {
    size: number;
    original_width: number;
    original_height: number;
    original_duration: number;
  } | null;
};
export type State = {
  videos: Video[];
};
export type VideoMetadataEditReq = {
  thumbnail_name: string;
  tag_or_note: string;
};
export type JsonError = {
  error: string;
};
export type DeleteRequest = { Thumbnail: string } | { Tag: string };

export const getList = () =>
  fetch(new URL("/list", ROOT)).then(
    async (r): Promise<State> =>
      r.ok
        ? r.json()
        : Promise.reject(new Error(`HTTP ${r.status} error: ${await r.text()}`))
  );

const editMetadata = (path: string, req: VideoMetadataEditReq) =>
  fetch(new URL(path, ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  })
    .then(
      async (r): Promise<State | JsonError> =>
        r.ok
          ? r.json()
          : Promise.reject(
              new Error(`HTTP ${r.status} error: ${await r.text()}`)
            )
    )
    .then((resp) =>
      "error" in resp ? Promise.reject(new Error(resp.error)) : resp
    );

export const addTag = (video: Video, tag: string) =>
  editMetadata("/tag/add", {
    thumbnail_name: video.thumbnail_name,
    tag_or_note: tag,
  });

export const removeTag = (video: Video, tag: string) =>
  editMetadata("/tag/remove", {
    thumbnail_name: video.thumbnail_name,
    tag_or_note: tag,
  });

export const setNote = (video: Video, note: string) =>
  editMetadata("/editnote", {
    thumbnail_name: video.thumbnail_name,
    tag_or_note: note,
  });

export const getVideoUrl = (video: Video) =>
  new URL(`/v/${encodeURIComponent(video.path)}`, ROOT);

export const getThumbnailUrl = (video: Video) =>
  new URL(`/t/${encodeURIComponent(video.thumbnail_name)}`, ROOT);

export const getPreviewUrl = (video: Video) =>
  new URL(`/t/${encodeURIComponent(video.thumbnail_name)}.mp4`, ROOT);

const deleteVideos = (request: DeleteRequest) =>
  fetch(new URL("/videos", ROOT), {
    method: "DELETE",
    body: JSON.stringify(request),
  }).then(
    async (r): Promise<State> =>
      r.ok
        ? r.json()
        : Promise.reject(new Error(`HTTP ${r.status} error: ${await r.text()}`))
  );

export const deleteVideo = (video: Video) =>
  deleteVideos({ Thumbnail: video.thumbnail_name });

export const deleteVideosByTag = (tag: string) => deleteVideos({ Tag: tag });

export const createPreviewList = (tag: string) =>
  fetch(new URL("/preview", ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tag }),
  }).then(
    async (r): Promise<State> =>
      r.ok
        ? r.json()
        : Promise.reject(new Error(`HTTP ${r.status} error: ${await r.text()}`))
  );

export type CookClip = {
  start: number;
  end: number;
  thumbnail_name: string;
};

export type Size = { width: number; height: number };

export const cook = (clips: CookClip[], size: Size, name: string) =>
  fetch(new URL("/cook", ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clips, ...size, name }),
  }).then(async (r): Promise<void> => {
    if (!r.ok)
      return Promise.reject(
        new Error(`HTTP ${r.status} error: ${await r.text()}`)
      );
  });

export const renameTag = (oldName: string, newName: string) =>
  fetch(new URL("/tag/rename", ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ old: oldName, new: newName }),
  }).then(
    async (r): Promise<State> =>
      r.ok
        ? r.json()
        : Promise.reject(new Error(`HTTP ${r.status} error: ${await r.text()}`))
  );
