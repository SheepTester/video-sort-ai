import { useEffect, useRef } from "react";
import { Video } from "../api";
import { TagEdit } from "./TagEdit";
import { Video as VideoComp } from "./Video";

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
      <div className="topbar">
        {video && <TagEdit video={video} />}
        <form method="dialog" className="closebtnform">
          <button className="closebtn" type="submit">
            &times;
          </button>
        </form>
      </div>
      {video && <VideoComp video={video} videoRef={videoRef} />}
    </dialog>
  );
}
