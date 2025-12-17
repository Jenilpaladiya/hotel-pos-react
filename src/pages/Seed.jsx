import { useState } from "react";
import { seedFirestore } from "../seed/seedFirestore";

export default function Seed() {
  const [status, setStatus] = useState("");

  async function run() {
    setStatus("Seeding…");
    try {
      const r = await seedFirestore();
      setStatus(`Done. products=${r.products}, tables=${r.tables}`);
    } catch (e) {
      setStatus("Failed: " + (e?.message || String(e)));
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-semibold">Seed Firestore</h1>
      <div className="bg-white border rounded-xl p-3">
        <p className="mb-2 text-sm opacity-80">
          One-time action. Writes sample <b>products</b> and <b>tables</b> to Firestore.
          Safe to re-run (uses fixed IDs).
        </p>
        <button className="px-3 py-2 border rounded" onClick={run}>Seed Now</button>
        {status && <div className="mt-2 text-sm">{status}</div>}
      </div>
    </div>
  );
}
