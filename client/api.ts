declare const ROOT: string;

export type Video = {
  path: string;
  thumbnail_name: string;
  tags: string[];
  note: string;
  mtime: { secs_since_epoch: number; nanos_since_epoch: number };
  stowed: boolean;
  size: number;
  preview3?: {
    size: number;
    original_width: number;
    original_height: number;
    original_rotation: Rotation;
    original_duration: number;
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
  override_rotation: Rotation | null;
};

export type Size = { width: number; height: number };

const decoder = new TextDecoder();
export const cook = async function* (
  clips: CookClip[],
  size: Size,
  name: string
): AsyncGenerator<string> {
  const response = await fetch(new URL("/cook", ROOT), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clips, ...size, name }),
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
  }).then(
    async (r): Promise<State> =>
      r.ok
        ? r.json()
        : Promise.reject(new Error(`HTTP ${r.status} error: ${await r.text()}`))
  );
