// src/pages/KDS.jsx
import { useMemo } from "react";
import { usePOS } from "../store/posStore.js";
import { useAuth } from "../store/authStore.js";

export default function KDS() {
  // Role guard MUST be inside the component:
  const user = useAuth((s) => s.user);
  if (!user || (user.role !== "kitchen" && user.role !== "admin")) {
    return (
      <div className="bg-white border rounded-xl p-4">
        Kitchen or Admin only.
      </div>
    );
  }

  // Read queue + actions from the store
  const queue = usePOS((s) => s.kitchenQueue);
  const setKitchenItemStatus = usePOS((s) => s.setKitchenItemStatus);
  const markKitchenTicketAllDone = usePOS((s) => s.markKitchenTicketAllDone);
  const bumpKitchenTicket = usePOS((s) => s.bumpKitchenTicket);
  const deleteKitchenTicket = usePOS((s) => s.deleteKitchenTicket);

  // Split active vs done tickets
  const { activeTickets, doneTickets } = useMemo(() => {
    const active = [];
    const done = [];
    for (const tk of queue || []) {
      (tk.items.some((it) => it.status !== "done") ? active : done).push(tk);
    }
    // Sort: priority first, newest first within same priority
    active.sort(
      (a, b) =>
        (b.priority || 0) - (a.priority || 0) ||
        (b.createdAt || 0) - (a.createdAt || 0)
    );
    done.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return { activeTickets: active, doneTickets: done };
  }, [queue]);

  return (
    <div className="space-y-6">
      {/* ACTIVE */}
      <section className="bg-white border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Kitchen Tickets</h1>
          <div className="text-sm opacity-70">
            {activeTickets.length} active · {doneTickets.length} done
          </div>
        </div>

        {activeTickets.length === 0 ? (
          <div className="mt-3 opacity-60">No active tickets.</div>
        ) : (
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeTickets.map((tk) => (
              <TicketCard
                key={tk.id}
                tk={tk}
                onToggleItem={(item) =>
                  setKitchenItemStatus(
                    tk.id,
                    item.id,
                    item.status === "done" ? "pending" : "done"
                  )
                }
                onAllDone={() => markKitchenTicketAllDone(tk.id)}
                onBump={() => bumpKitchenTicket(tk.id)}
                onDelete={() => deleteKitchenTicket(tk.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* DONE */}
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-xl font-semibold mb-2">Done</h2>
        {doneTickets.length === 0 ? (
          <div className="opacity-60">Nothing completed yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {doneTickets.map((tk) => (
              <DoneCard key={tk.id} tk={tk} onDelete={() => deleteKitchenTicket(tk.id)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function TicketCard({ tk, onToggleItem, onAllDone, onBump, onDelete }) {
  return (
    <div
      className={`border rounded-xl p-3 bg-white ${
        tk.priority ? "ring-2 ring-red-500" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">
            {tk.label || "Ticket"}{" "}
            <span className="opacity-60 text-sm">#{String(tk.id).slice(-4)}</span>
          </div>
          <div className="text-xs opacity-60">
            {tk.createdAt ? new Date(tk.createdAt).toLocaleTimeString() : ""}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className={`px-2 py-1 rounded border text-xs ${
              tk.priority ? "bg-red-600 text-white border-red-600" : ""
            }`}
            title="Toggle priority"
            onClick={onBump}
          >
            {tk.priority ? "PRIORITY" : "Bump"}
          </button>
          <button className="px-2 py-1 rounded border text-xs" onClick={onAllDone}>
            All done
          </button>
          <button
            className="px-2 py-1 rounded border text-xs text-red-600"
            onClick={onDelete}
            title="Remove ticket"
          >
            Delete
          </button>
        </div>
      </div>

      <ul className="mt-2 space-y-1">
        {tk.items.map((it) => (
          <li
            key={it.id}
            className={`flex items-center justify-between gap-2 border rounded-lg px-2 py-1 ${
              it.status === "done" ? "opacity-60" : ""
            }`}
          >
            <div>
              <div className="text-sm font-medium">
                ×{it.qty} {it.name}
              </div>
              {it.modsText ? (
                <div className="text-xs opacity-70">{it.modsText}</div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[11px] px-2 py-0.5 rounded ${
                  it.status === "done"
                    ? "bg-green-100 text-green-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {it.status === "done" ? "done" : "pending"}
              </span>
              <button
                className="px-2 py-1 border rounded text-xs"
                onClick={() => onToggleItem(it)}
              >
                {it.status === "done" ? "Undo" : "Done"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DoneCard({ tk, onDelete }) {
  return (
    <div className="border rounded-xl p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">
            {tk.label || "Ticket"}{" "}
            <span className="opacity-60 text-sm">#{String(tk.id).slice(-4)}</span>
          </div>
          <div className="text-xs opacity-60">
            Closed: {tk.updatedAt ? new Date(tk.updatedAt).toLocaleTimeString() : ""}
          </div>
        </div>
        <button
          className="px-2 py-1 rounded border text-xs text-red-600"
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
      <ul className="mt-2 space-y-1">
        {tk.items.map((it) => (
          <li key={it.id} className="flex justify-between text-sm">
            <span>
              ×{it.qty} {it.name}
            </span>
            <span className="text-xs opacity-60">{it.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
