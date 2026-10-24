import { Heading } from "@chakra-ui/react";
import { LuX } from "react-icons/lu";

export default function Modal({ title, eyebrow, children, onClose }) {
  return (
    <div className="modal-scrim" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <Heading size="lg" mt="1">{title}</Heading>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <LuX />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

