// src/lib/firestoreSync.js
import { db } from "./firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { usePOS } from "../store/posStore";

// kitchen tickets live feed
export function watchKitchen() {
  const col = collection(db, "kitchen");
  return onSnapshot(col, (snap) => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    usePOS.getState()._setKitchenFromServer(list);
  });
}

// tickets for a specific table (to keep POS cart/ticket in sync)
export function watchTicket(tableId) {
  const q = query(collection(db, "tickets"), where("tableId", "==", tableId));
  return onSnapshot(q, (snap) => {
    const tk = snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null;
    usePOS.getState()._setTicketFromServer(tableId, tk);
  });
}
