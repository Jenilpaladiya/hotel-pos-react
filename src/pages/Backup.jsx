// src/pages/Backup.jsx
import { useEffect, useState } from "react";
import { db, exportAll, exportOrdersRange, clearAll } from "../db/db.js";

export default function Backup() {
  const [stats, setStats] = useState({
    catalog: 0,
    tables: 0,
    tickets: 0,
    orders: 0,
    kitchen: 0,
  });

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const [c, t, tk, o, k] = await Promise.all([
          db.catalog.count(),
          db.diningTables.count(),
          db.tickets.count(),
          db.orders.count(),
          db.kitchen.count(),
        ]);
        setStats({ catalog: c, tables: t, tickets: tk, orders: o, kitchen: k });
      } catch (e) {
        console.error("Stats error:", e);
      }
    })();
  }, []);

  const download = (obj, filename) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const nowStamp = () => {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      pad(d.getMonth() + 1) +
      pad(d.getDate()) +
      "-" +
      pad(d.getHours()) +
      pad(d.getMinutes()) +
      pad(d.getSeconds())
    );
  };

  const parseDateRange = () => {
    if (!fromDate || !toDate) return null;
    // make them local-day bounds
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T23:59:59.999`);
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
      return null;
    }
    return { startMs, endMs };
  };

  const onExportAll = async () => {
    setBusy(true);
    setMsg("");
    try {
      const data = await exportAll();
      download(data, `hotel-pos-backup-${nowStamp()}.json`);
      setMsg("Exported full backup.");
    } catch (e) {
      console.error(e);
      setMsg("Export failed. See console.");
    } finally {
      setBusy(false);
    }
  };

  const onExportRange = async () => {
    const range = parseDateRange();
    if (!range) {
      setMsg("Please choose a valid From and To date.");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const data = await exportOrdersRange(range.startMs, range.endMs);
      const from = fromDate.replaceAll("-", "");
      const to = toDate.replaceAll("-", "");
      download(data, `hotel-pos-orders-${from}_to_${to}.json`);
      setMsg(`Exported ${data?.orders?.length || 0} orders.`);
    } catch (e) {
      console.error(e);
      setMsg("Range export failed. See console.");
    } finally {
      setBusy(false);
    }
  };

  const onImport = async (file) => {
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // very light validation
      if (!json || typeof json !== "object") {
        throw new Error("Invalid JSON.");
      }

      // Transactional import (destructive — clears first)
      await clearAll();
      await db.transaction(
        "rw",
        db.catalog,
        db.diningTables,
        db.tickets,
        db.orders,
        db.kitchen,
        async () => {
          if (Array.isArray(json.catalog) && json.catalog.length)
            await db.catalog.bulkAdd(json.catalog);
          if (Array.isArray(json.tables) && json.tables.length)
            await db.diningTables.bulkAdd(json.tables);
          if (Array.isArray(json.tickets) && json.tickets.length)
            await db.tickets.bulkAdd(json.tickets);
          if (Array.isArray(json.orders) && json.orders.length)
            await db.orders.bulkAdd(json.orders);
          if (Array.isArray(json.kitchen) && json.kitchen.length)
            await db.kitchen.bulkAdd(json.kitchen);
        }
      );

      setMsg("Import complete. Reloading…");
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      console.error(e);
      setMsg("Import failed. See console for details.");
    } finally {
      setBusy(false);
    }
  };

  const onDangerReset = async () => {
    if (!confirm("This will CLEAR all data. Continue?")) return;
    setBusy(true);
    setMsg("");
    try {
      await clearAll();
      setMsg("Database cleared. Reloading…");
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      console.error(e);
      setMsg("Reset failed. See console.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border rounded-xl p-4">
        <h1 className="text-2xl font-semibold mb-2">Backup & Restore</h1>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Stat label="Catalog items" value={stats.catalog} />
          <Stat label="Tables" value={stats.tables} />
          <Stat label="Open tickets" value={stats.tickets} />
          <Stat label="Orders" value={stats.orders} />
          <Stat label="Kitchen tickets" value={stats.kitchen} />
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          {/* Export All */}
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-1">Full Export</div>
            <p className="text-sm opacity-70 mb-3">
              Download everything (catalog, tables, open tickets, orders, kitchen).
            </p>
            <button
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
              onClick={onExportAll}
              disabled={busy}
            >
              {busy ? "Working…" : "Export All"}
            </button>
          </div>

          {/* Export Orders by Date Range */}
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-1">Export Orders (Date Range)</div>
            <p className="text-sm opacity-70 mb-2">
              Choose a local date range (inclusive).
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs opacity-70">From</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs opacity-70">To</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
              <button
                className="ml-auto px-4 py-2 rounded-xl border disabled:opacity-50"
                onClick={onExportRange}
                disabled={busy}
              >
                {busy ? "Working…" : "Export Range"}
              </button>
            </div>
          </div>

          {/* Import */}
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-1">Import (JSON)</div>
            <p className="text-sm opacity-70 mb-2">
              Imports a JSON produced by Export. <strong>Warning:</strong> this
              clears current data first.
            </p>
            <input
              type="file"
              accept="application/json"
              onChange={(e) => onImport(e.target.files?.[0] || null)}
            />
          </div>

          {/* Danger Zone */}
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-1">Danger Zone</div>
            <p className="text-sm opacity-70 mb-2">
              Clear all IndexedDB data for this app.
            </p>
            <button
              className="px-4 py-2 rounded-xl border text-red-600 disabled:opacity-50"
              onClick={onDangerReset}
              disabled={busy}
            >
              {busy ? "Working…" : "Clear Database"}
            </button>
          </div>
        </div>

        {msg && <div className="mt-3 text-sm">{msg}</div>}
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
