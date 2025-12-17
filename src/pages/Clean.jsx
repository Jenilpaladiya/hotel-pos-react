// src/pages/Clean.jsx
import { useState } from "react";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { fdb } from "../lib/firebase";
import { db as idb } from "../db/db"; // Dexie

const isBad = (raw) =>
  typeof raw.name !== "string" || !raw.name.trim() ||
  typeof raw.price !== "number" ||
  typeof raw.taxRate !== "number" ||
  !Array.isArray(raw.optionGroups);

export default function Clean() {
  const [log, setLog] = useState("");

  async function deleteBadCloudProducts() {
    setLog("Scanning Firestore…");
    const snap = await getDocs(collection(fdb, "products"));
    const bad = snap.docs.filter((d) => isBad({ id: d.id, ...d.data() }));
    if (bad.length === 0) { setLog("No bad products found."); return; }

    const batch = writeBatch(fdb);
    bad.forEach((d) => batch.delete(doc(fdb, "products", d.id)));
    await batch.commit();
    setLog(`Deleted ${bad.length} bad product doc(s) from Firestore.`);
  }

  async function clearLocalCatalog() {
    await idb.catalog.clear();
    setLog("Local IndexedDB catalog cleared.");
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-semibold">Clean bad data</h1>
      <div className="bg-white border rounded-xl p-3 space-y-2">
        <button className="px-3 py-2 border rounded" onClick={deleteBadCloudProducts}>
          Delete bad products in Firestore
        </button>
        <button className="px-3 py-2 border rounded" onClick={clearLocalCatalog}>
          Clear local catalog (IndexedDB)
        </button>
        {log && <div className="text-sm mt-2">{log}</div>}
      </div>
    </div>
  );
}
