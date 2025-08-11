import { useEffect, useRef } from "react";
import { Probe, Video } from "../api";

type TrimmerProps = {
  videos: Video[];
  open: boolean;
  onClose: () => void;
  onCook: (encoding: Probe) => void;
};

export function CookModal({ videos, open, onClose, onCook }: TrimmerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} onClose={onClose} className="modal cook-container">
      <form method="dialog" className="cook-header">
        <button type="submit">&lt; back</button>
        <h3>cook settings</h3>
      </form>
      <form
        onClick={(e) => {
          e.preventDefault();
          // TODO: call onCook
        }}
      >
        TODO
        <button type="submit">cook! 🧑‍🍳</button>
      </form>
    </dialog>
  );
}
