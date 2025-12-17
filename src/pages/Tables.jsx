// src/pages/Tables.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../db/db.js";
import { upsertTable, deleteTable as fbDeleteTable } from "../lib/fbApi";

const rid = () => (crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));


export default function Tables() {
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState({ label: "", seats: 2 });
  const [editingId, setEditingId] = useState(null);
  const [msg, setMsg] = useState("");

  const refresh = async () => {
    try {
      const list = await db.diningTables.orderBy("label").toArray();
      setRows(list);
    } catch (e) {
      console.error(e);
      setMsg("Failed to load tables.");
    }
  };

  useEffect(() => { refresh(); }, []);

  const create = async () => {
    if (!draft.label.trim()) { setMsg("Table name/label is required."); return; }
    await db.diningTables.add({ id: rid(), label: draft.label.trim(), seats: Number(draft.seats) || 2 });
    setDraft({ label: "", seats: 2 });
    await refresh();
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setDraft({ label: t.label, seats: t.seats ?? 2 });
  };

  const save = async () => {
    await db.diningTables.put({ id: editingId, label: draft.label.trim(), seats: Number(draft.seats) || 2 });
    setEditingId(null);
    setDraft({ label: "", seats: 2 });
    await refresh();
  };

  const remove = async (id) => {
    if (!confirm("Delete this table?")) return;
    await db.diningTables.delete(id);
    await refresh();
  };

  const goToPOS = (tableId) => {
    // Navigate to POS and pass tableId; POS will open/select that table’s ticket
    nav(`/pos?tableId=${encodeURIComponent(tableId)}`);
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border rounded-xl p-4">
        <h1 className="text-2xl font-semibold mb-2">Tables</h1>

        {/* Add new table */}
        <div className="border rounded-lg p-3 mb-4">
          <div className="font-medium mb-2">Add Table</div>
          <div className="flex flex-wrap gap-2">
            <input
              className="border rounded px-3 py-2"
              placeholder="Label (e.g., T1, Patio-3)"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
            <input
              type="number"
              className="border rounded px-3 py-2 w-32"
              placeholder="Seats"
              value={draft.seats}
              onChange={(e) => setDraft({ ...draft, seats: e.target.value })}
            />
            <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={create}>
              Add
            </button>
            {msg && <span className="text-sm text-red-600">{msg}</span>}
          </div>
        </div>

        {/* Grid of tables */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((t) => (
            <div key={t.id} className="border rounded-xl p-3 bg-white">
              {editingId === t.id ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      className="border rounded px-3 py-2"
                      value={draft.label}
                      onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    />
                    <input
                      type="number"
                      className="border rounded px-3 py-2"
                      value={draft.seats}
                      onChange={(e) => setDraft({ ...draft, seats: e.target.value })}
                    />
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="px-3 py-1.5 rounded-xl bg-black text-white" onClick={save}>Save</button>
                    <button className="px-3 py-1.5 rounded-xl border" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">{t.label}</div>
                    <div className="text-xs opacity-70">Seats: {t.seats ?? 2}</div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button className="px-3 py-1.5 border rounded" onClick={() => goToPOS(t.id)}>Open in POS</button>
                    <button className="px-3 py-1.5 border rounded" onClick={() => startEdit(t)}>Edit</button>
                    <button className="px-3 py-1.5 border rounded text-red-600" onClick={() => remove(t.id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {rows.length === 0 && <div className="opacity-60">No tables yet. Add your first one above.</div>}
        </div>
      </section>
    </div>
  );
}
