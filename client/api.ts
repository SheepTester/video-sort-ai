declare const ROOT: string;

export type Video = {
  path: string;
  thumbnail_name: string;
  tags: string[];
};
export type State = {
  videos: Video;
};
export type TagEditReq = {
  thumbnail_name: string;
  tag: string;
};
export type JsonError = {
  error: string;
};

export const getList = () =>
  fetch(new URL("/list", ROOT)).then(
    async (r): Promise<State> =>
      r.ok
        ? r.json()
        : Promise.reject(new Error(`HTTP ${r.status} error: ${await r.text()}`))
  );

const editTag = (op: "add" | "remove", req: TagEditReq) =>
  fetch(new URL(`/tag/${op}`, ROOT), {
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
  editTag("add", { thumbnail_name: video.thumbnail_name, tag });

export const removeTag = (video: Video, tag: string) =>
  editTag("remove", { thumbnail_name: video.thumbnail_name, tag });

export const getVideoUrl = (video: Video) =>
  new URL(`/v/${encodeURIComponent(video.path)}`, ROOT);

export const getThumbnailUrl = (video: Video) =>
  new URL(`/v/${encodeURIComponent(video.thumbnail_name)}`, ROOT);
