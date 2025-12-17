// src/db/db.js
import Dexie from "dexie";

export const db = new Dexie("hotel_pos_db");

/*
 v1 : tables (old)
 v2 : diningTables (renamed from tables), migration
 v3 : shifts, cash
*/

db.version(1).stores({
  catalog: "id, name, category, price, taxRate",
  tables: "id, label, seats",
  tickets: "id, tableId, updatedAt, createdAt",
  orders: "id, createdAt, tableId, total",
  kitchen: "id, priority, updatedAt, createdAt",
});

db.version(2)
  .stores({
    catalog: "id, name, category, price, taxRate",
    diningTables: "id, label, seats",
    tickets: "id, tableId, updatedAt, createdAt",
    orders: "id, createdAt, tableId, total",
    kitchen: "id, priority, updatedAt, createdAt",
  })
  .upgrade(async (tx) => {
    try {
      const old = tx.table("tables");
      const hasOld = await old.count().then(() => true).catch(() => false);
      if (hasOld) {
        const rows = await old.toArray();
        if (rows?.length) await tx.table("diningTables").bulkAdd(rows);
      }
    } catch {}
  });

db.version(3).stores({
  catalog: "id, name, category, price, taxRate",
  diningTables: "id, label, seats",
  tickets: "id, tableId, updatedAt, createdAt",
  orders: "id, createdAt, tableId, total",
  kitchen: "id, priority, updatedAt, createdAt",
  shifts: "id, userId, openedAt, closedAt",
  cash: "id, shiftId, type, amount, createdAt",
});

/* ---------- Seeds & migration from old localStorage ---------- */
export async function seedIfEmpty({ catalogSeed = [], tablesSeed = [] }) {
  const [cCount, tCount] = await Promise.all([
    db.catalog.count(),
    db.diningTables.count(),
  ]);
  if (cCount === 0 && catalogSeed.length) await db.catalog.bulkAdd(catalogSeed);
  if (tCount === 0 && tablesSeed.length) await db.diningTables.bulkAdd(tablesSeed);
}

export async function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem("hotel-pos-store");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    const state = parsed?.state || {};
    const { catalog = [], tables = [], tickets = [], orders = [], kitchenQueue = [] } = state;

    const [c, t, tk, o, k] = await Promise.all([
      db.catalog.count(),
      db.diningTables.count(),
      db.tickets.count(),
      db.orders.count(),
      db.kitchen.count(),
    ]);
    if (c + t + tk + o + k > 0) return false;

    await db.transaction("rw", db.catalog, db.diningTables, db.tickets, db.orders, db.kitchen, async () => {
      if (catalog.length) await db.catalog.bulkAdd(catalog);
      if (tables.length) await db.diningTables.bulkAdd(tables);
      if (tickets.length) await db.tickets.bulkAdd(tickets);
      if (orders.length) await db.orders.bulkAdd(orders);
      if (kitchenQueue.length) await db.kitchen.bulkAdd(kitchenQueue);
    });

    localStorage.removeItem("hotel-pos-store");
    return true;
  } catch (e) {
    console.error("Migration failed:", e);
    return false;
  }
}

/* ----------------- Backup helpers ----------------- */
export async function clearAll() {
  await db.transaction(
    "rw",
    db.catalog, db.diningTables, db.tickets, db.orders, db.kitchen, db.shifts, db.cash,
    async () => {
      await db.catalog.clear();
      await db.diningTables.clear();
      await db.tickets.clear();
      await db.orders.clear();
      await db.kitchen.clear();
      await db.shifts.clear();
      await db.cash.clear();
    }
  );
}

export async function exportAll() {
  const [catalog, tables, tickets, orders, kitchen, shifts, cash] = await Promise.all([
    db.catalog.toArray(),
    db.diningTables.toArray(),
    db.tickets.toArray(),
    db.orders.toArray(),
    db.kitchen.toArray(),
    db.shifts.toArray(),
    db.cash.toArray(),
  ]);
  return {
    meta: { app: "hotel-pos", schema: 3, exportedAt: new Date().toISOString() },
    catalog, tables, tickets, orders, kitchen, shifts, cash,
  };
}

export async function exportOrdersRange(startMs, endMs) {
  if (typeof startMs !== "number" || typeof endMs !== "number") {
    throw new Error("exportOrdersRange: startMs/endMs must be numbers (ms).");
  }
  const orders = await db.orders.where("createdAt").between(startMs, endMs, true, true).toArray();
  return {
    meta: { app: "hotel-pos", schema: 3, exportedAt: new Date().toISOString(), range: { startMs, endMs } },
    orders,
  };
}
