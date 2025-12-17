// src/lib/fbApi.js
import {
  collection, doc, setDoc, addDoc, deleteDoc, serverTimestamp, query, where
} from "firebase/firestore";
import { fdb } from "./firebase";

// Collection refs (strings kept in one place)
export const col = {
  products: "products",
  tables: "tables",
  tickets: "tickets",
  kitchen: "kitchen",
  orders:  "orders",
};

// -------- PRODUCTS --------
export async function upsertProduct(p) {
  const id = p.id || crypto.randomUUID();
  await setDoc(doc(fdb, col.products, id), { ...p, id }, { merge: true });
  return id;
}
export async function deleteProduct(id) {
  await deleteDoc(doc(fdb, col.products, id));
}

// -------- TABLES --------
export async function upsertTable(t) {
  const id = t.id || crypto.randomUUID();
  await setDoc(doc(fdb, col.tables, id), { ...t, id }, { merge: true });
  return id;
}
export async function deleteTable(id) {
  await deleteDoc(doc(fdb, col.tables, id));
}

// -------- TICKETS (per table) --------
// One ticket per table: id == tableId works well
export async function upsertTicket(ticket) {
  const id = ticket.id || ticket.tableId || crypto.randomUUID();
  await setDoc(doc(fdb, col.tickets, id), {
    ...ticket,
    id,
    updatedAt: Date.now(),
  }, { merge: true });
  return id;
}

// -------- KITCHEN --------
export async function addKitchenTicket(kTicket) {
  return addDoc(collection(fdb, col.kitchen), {
    ...kTicket,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

// -------- ORDERS --------
export async function addOrder(order) {
  return setDoc(doc(collection(fdb, col.orders)), {
    ...order,
    createdAt: Date.now(),
  });
}
