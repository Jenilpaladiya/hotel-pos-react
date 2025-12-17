// src/components/Toast.jsx
export default function Toast({ message, variant = "success", onClose }) {
  if (!message) return null;

  const styles = {
    success: "bg-white border-green-300 text-green-800",
    info:    "bg-white border-blue-300  text-blue-800",
    error:   "bg-white border-red-300   text-red-800",
  }[variant];

  return (
    <div className="fixed top-4 right-4 z-[9999] print:hidden">
      <div
        role="status"
        aria-live="polite"
        className={`max-w-sm rounded-xl shadow-lg border px-4 py-3 ${styles} transition-all duration-200`}
      >
        <div className="flex items-start gap-3">
          <div className="text-sm leading-5">{message}</div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="ml-auto p-1 rounded hover:bg-black/5"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
