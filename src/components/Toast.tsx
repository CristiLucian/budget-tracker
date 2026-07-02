import { useEffect } from "react";

export type ToastMessage = {
  text: string;
  detail?: string;
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
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <div className="toast__text">{message.text}</div>
      {message.detail && <div className="toast__detail">{message.detail}</div>}
    </div>
  );
}
