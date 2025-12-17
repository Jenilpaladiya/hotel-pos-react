// src/debug/DBCheck.jsx
import { useEffect, useState } from "react";
import { db } from "../db/db.js";

export default function DBCheck() {
  const [status, setStatus] = useState({ ok: false, msg: "Running…" });
  const [tables, setTables] = useState([]);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    (async () => {
      try {
        // open DB and list tables
        await db.open();
        const tnames = db.tables.map(t => t.name);
        setTables(tnames);

        // count rows in each table
        const entries = await Promise.all(
          db.tables.map(async (t) => [t.name, await t.count()])
        );
        setCounts(Object.fromEntries(entries));

        // roundtrip write/read/delete on catalog
        const probeId = "__db_probe__";
        await db.catalog.put({ id: probeId, name: "DB Probe", price: 0, taxRate: 0 });
        const got = await db.catalog.get(probeId);
        await db.catalog.delete(probeId);

        if (!got) throw new Error("Write/read test failed.");

        setStatus({ ok: true, msg: "IndexedDB OK ✅" });
      } catch (e) {
        setStatus({ ok: false, msg: "IndexedDB error: " + (e?.message || e) });
      }
    })();
  }, []);

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <h1 className="text-xl font-semibold">Local DB Check</h1>
      <div className={status.ok ? "text-green-700" : "text-red-700"}>{status.msg}</div>
      <div className="text-sm">
        <div className="font-medium">Tables</div>
        <ul className="list-disc ml-5">
          {tables.map(n => (
            <li key={n}>
              {n} — <span className="opacity-70">{counts[n] ?? "…"}</span>
            </li>
          ))}
          {tables.length === 0 && <li className="opacity-60">No tables found.</li>}
        </ul>
      </div>
    </div>
  );
}
