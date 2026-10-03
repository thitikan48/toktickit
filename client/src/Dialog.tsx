import { ReactNode, useEffect, useId, useRef } from "react";

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog. Focus moves into it, Tab stays inside it, Esc closes it,
 * and focus returns to the control that opened it.
 */
export default function Dialog({ title, onClose, children }: DialogProps) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);

    (focusables()[0] ?? box.current)?.focus();

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;

        const first = items[0];
        const last = items[items.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className="modal d-block"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={box}
        tabIndex={-1}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h2 id={titleId} className="modal-title h5">
              {title}
            </h2>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
