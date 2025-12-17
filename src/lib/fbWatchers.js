// src/lib/fbWatchers.js
import { collection, onSnapshot, writeBatch, doc } from "firebase/firestore";
import { fdb } from "./firebase";
import { usePOS } from "../store/posStore";
import { db as idb } from "../db/db"; // Dexie, to mirror cloud -> local

const isValidProduct = (raw) =>
  typeof raw.name === "string" && raw.name.trim() &&
  typeof raw.category === "string" &&
  typeof raw.price === "number" &&
  typeof raw.taxRate === "number" &&
  Array.isArray(raw.optionGroups);

const normalizeProduct = (raw) => ({
  id: raw.id,
  name: raw.name.trim(),
  category: raw.category.trim(),
  price: raw.price,
  taxRate: raw.taxRate,
  optionGroups: raw.optionGroups,
});


function cleanProduct(p) {
  return {
    id: p.id,
    name: String(p.name ?? "Untitled"),
    category: String(p.category ?? "General"),
    price: Number(p.price ?? 0),
    taxRate: Number(p.taxRate ?? 0.07),
    optionGroups: Array.isArray(p.optionGroups) ? p.optionGroups : [],
  };
}

export function watchProducts() {
  const col = collection(fdb, "products");
  let bootstrapped = false;

  return onSnapshot(col, async (snap) => {
    // First load: if cloud is empty, DON'T wipe local. Optionally seed cloud from local.
    if (!bootstrapped) {
      bootstrapped = true;
      if (snap.empty) {
        // optional one-time bootstrap: push local -> cloud
        const local = usePOS.getState().catalog || [];
        if (local.length) {
          const batch = writeBatch(fdb);
          local.forEach((it) => batch.set(doc(col, it.id), it));
          await batch.commit();
        }
        return; // keep local as is until cloud has data
      }
    }

    // Cloud has data -> replace local with sanitized docs
    const rows = snap.docs.map((d) => cleanProduct({ id: d.id, ...d.data() }));
    usePOS.setState({ catalog: rows });
    // mirror to IndexedDB for offline
    await idb.catalog.clear();
    await idb.catalog.bulkAdd(rows);
  });
}

export function watchTables() {
  const col = collection(fdb, "tables");
  let bootstrapped = false;

  return onSnapshot(col, async (snap) => {
    if (!bootstrapped) {
      bootstrapped = true;
      if (snap.empty) {
        const local = usePOS.getState().tables || [];
        if (local.length) {
          const batch = writeBatch(fdb);
          local.forEach((t) => batch.set(doc(col, t.id), t));
          await batch.commit();
        }
        return;
      }
    }

    const rows = snap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        label: String(data.label ?? "Table"),
        seats: Number(data.seats ?? 0),
      };
    });

    usePOS.setState({ tables: rows });
    await idb.diningTables.clear();
    await idb.diningTables.bulkAdd(rows);
  });
}
