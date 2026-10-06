import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
export default function Modal({ title, close, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      className={wide ? "modal wide" : "modal"}
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <div className="modal-head">
        <span className="eyebrow">ZONA FRESCA · A TU GUSTO</span>
        <button className="icon-button" aria-label="Cerrar" onClick={close}>
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
