// src/components/Chit.jsx
import { useSettings } from "../store/settingsStore.js";

export default function Chit({ ticket }) {
  const { kitchenChitHeader, bizName, paperWidth } = useSettings();
  if (!ticket) return null;
  const date = new Date(ticket.createdAt || Date.now());

  return (
    <div className={`print-root ${paperWidth === "58" ? "w58" : "w80"}`}>
      <div className="text-center">
        <div className="font-semibold text-base tracking-wide">{kitchenChitHeader}</div>
        <div className="text-xs">{bizName}</div>
      </div>
      <div className="sep my-2" />
      <div className="text-xs flex justify-between">
        <span>{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
        <span>Ticket: {ticket.id?.slice(-6)}</span>
      </div>
      <div className="text-xs">Label: <strong>{ticket.label || "Order"}</strong></div>
      <div className="sep my-2" />

      <div className="text-sm">
        {ticket.items.map((it) => (
          <div key={it.id} className="mb-2">
            <div className="flex justify-between">
              <div className="font-semibold">{it.qty}× {it.name}</div>
              <span className="text-xs uppercase opacity-70">{it.status}</span>
            </div>
            {it.modsText ? (
              <div className="text-xs opacity-80 pl-4">- {it.modsText}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
