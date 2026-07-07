import { useEffect } from "react";

export type ToastMessage = {
  text: string;
  detail?: string;
  /** Optional action button (e.g. undo). Runs once, then closes the toast. */
  action?: { label: string; run: () => void };
  /** How long the toast stays up. Longer when there's an action to tap. */
  durationMs?: number;
};

export default function Toast({
  message,
  onDone
}: {
  message: ToastMessage | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, message.durationMs ?? 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <div className="toast__body">
        <div className="toast__text">{message.text}</div>
        {message.detail && <div className="toast__detail">{message.detail}</div>}
      </div>
      {message.action && (
        <button
          className="toast__btn"
          onClick={() => {
            message.action!.run();
            onDone();
          }}
        >
          {message.action.label}
        </button>
      )}
    </div>
  );
}
