import { useState, useEffect, useCallback, memo } from "react";
import "../styles/toast.css";

export type ToastType = "info" | "success" | "warning" | "error";

export interface ToastMessage {
  id: string;
  type: ToastType;
  text: string;
  duration?: number;
}

let addToastFn: ((msg: ToastMessage) => void) | null = null;

export function showToast(type: ToastType, text: string, duration = 4000) {
  addToastFn?.({ id: Math.random().toString(36).slice(2), type, text, duration });
}

function ToastInner() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    addToastFn = (msg: ToastMessage) => {
      setToasts((prev) => [...prev, msg]);
    };
    return () => { addToastFn = null; };
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} msg={t} onDone={() => remove(t.id)} />
      ))}
    </div>
  );
}

const ToastItem = memo(function ToastItem({ msg, onDone }: { msg: ToastMessage; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, msg.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [msg.duration, onDone]);

  return (
    <div className={`toast toast-${msg.type}`} role="alert">
      <span className="toast-text">{msg.text}</span>
      <button className="toast-close" onClick={onDone} aria-label="Dismiss">×</button>
    </div>
  );
});

export default memo(ToastInner);
