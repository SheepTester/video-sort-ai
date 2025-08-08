import { useEffect, useRef } from "react";
import { getThumbnailUrl, getVideoUrl, Video } from "../api";

export type VideoModalProps = {
  open: boolean;
  onClose: () => void;
  video: Video | null;
};
export function VideoModal({ open, onClose, video }: VideoModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
      videoRef.current?.play();
    } else {
      dialogRef.current?.close();
      videoRef.current?.pause();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} onClose={onClose} className="modal">
      <form method="dialog">
        <button type="submit">&times;</button>
      </form>
      {video && (
        <video
          className="feed-video"
          src={getVideoUrl(video).toString()}
          controls
          loop
          poster={getThumbnailUrl(video).toString()}
          ref={videoRef}
        />
      )}
    </dialog>
  );
}
