// src/store/posStore.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { db, seedIfEmpty, migrateFromLocalStorage } from "../db/db.js";
import {
  upsertProduct,
  deleteProduct as fbDeleteProduct,
  upsertTable,
  deleteTable as fbDeleteTable,
  upsertTicket,
  addKitchenTicket,
  addOrder as fbAddOrder,
} from "../lib/fbApi";
import { nanoid } from "nanoid";


// Safe add/sub helpers for maps of counts
const addCount = (obj, key, by = 1) => ({ ...obj, [key]: (obj[key] || 0) + by });
const subCount = (obj, key, by = 1) => ({ ...obj, [key]: Math.max(0, (obj[key] || 0) - by) });


/* ---------------- Utils ---------------- */
const rid = () =>
(crypto?.randomUUID?.() ||
  String(Date.now()) + Math.random().toString(16).slice(2));

const round2 = (n) => Math.round(n * 100) / 100;

const sameMods = (a = [], b = []) =>
  a.length === b.length &&
  a.every((m, i) => m.name === b[i]?.name && m.priceDelta === b[i]?.priceDelta);

const clampName = (v) => String(v ?? "").slice(0, 60);

const modsLabel = (mods = []) =>
  mods.length
    ? mods
      .map(
        (m) => `${m.name}${m.priceDelta ? ` (+${m.priceDelta})` : ""}`
      )
      .join(", ")
    : "";

const ensureKitchen = (tk) => ({
  ...tk,
  kitchen:
    tk?.kitchen && tk.kitchen.prep && tk.kitchen.served
      ? tk.kitchen
      : { prep: {}, served: {} },
});

const mergeMapsAdd = (a = {}, b = {}) => {
  const out = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = (out[k] || 0) + (b[k] || 0);
  }
  return out;
};

// Key that uniquely identifies a line "shape" (item + chosen modifiers)
const lineKeyFrom = (itemId, mods) => {
  const mk = (mods || [])
    .map((m) => `${m.gid || m.groupId || m.group || ""}:${m.id}`)
    .sort()
    .join("|");
  return `${itemId}::${mk}`;
};

// Merge identical lines (same item+mods) when parking/merging tickets;
// preserve previously-sent-to-kitchen counter (kSent) if present
const mergeLines = (baseLines, addLines) => {
  const out = baseLines.map((l) => ({ ...l }));
  for (const l of addLines) {
    const idx = out.findIndex(
      (x) => x.itemId === l.itemId && sameMods(x.mods, l.mods)
    );
    if (idx >= 0) {
      out[idx] = {
        ...out[idx],
        qty: out[idx].qty + l.qty,
        kSent: out[idx].kSent || 0,
      };
    } else {
      out.push({ ...l, kSent: 0 });
    }
  }
  return out;
};

// Compute only the NEW qty per line compared to an existing ticket (for KDS send)
const deltaLines = (existingItems = [], cart = []) => {
  const out = [];
  for (const cl of cart) {
    const match = existingItems.find(
      (x) => x.itemId === cl.itemId && sameMods(x.mods, cl.mods)
    );
    if (!match) {
      // entirely new line
      out.push({ ...cl });
    } else {
      const diff = (cl.qty || 0) - (match.qty || 0);
      if (diff > 0) out.push({ ...cl, qty: diff }); // only the extra qty
    }
  }
  return out;
};

/* ---------------- Seeds (with optionGroups) ---------------- */
const catalogSeed = [
  {
    id: "1",
    name: "Masala Tea",
    category: "Beverage",
    price: 3.0,
    taxRate: 0.07,
    optionGroups: [
      {
        id: "size",
        label: "Size",
        type: "single",
        required: true,
        min: 1,
        max: 1,
        options: [
          { id: "reg", name: "Regular", priceDelta: 0 },
          { id: "lg", name: "Large", priceDelta: 0.5 },
        ],
      },
      {
        id: "sweet",
        label: "Sweetness",
        type: "single",
        required: false,
        min: 0,
        max: 1,
        options: [
          { id: "less", name: "Less Sugar", priceDelta: 0 },
          { id: "normal", name: "Normal", priceDelta: 0 },
        ],
      },
    ],
  },
  {
    id: "2",
    name: "Paneer Tikka",
    category: "Veg",
    price: 8.5,
    taxRate: 0.07,
    optionGroups: [
      {
        id: "portion",
        label: "Portion",
        type: "single",
        required: true,
        min: 1,
        max: 1,
        options: [
          { id: "half", name: "Half", priceDelta: 0 },
          { id: "full", name: "Full", priceDelta: 3.0 },
        ],
      },
      {
        id: "addons",
        label: "Add-ons",
        type: "multi",
        required: false,
        min: 0,
        max: 3,
        options: [
          { id: "cheese", name: "Extra Cheese", priceDelta: 1.5 },
          { id: "spicy", name: "Extra Spicy", priceDelta: 0.5 },
          { id: "dip", name: "Mint Dip", priceDelta: 0.7 },
        ],
      },
    ],
  },
  {
    id: "3",
    name: "Butter Naan",
    category: "Bread",
    price: 2.5,
    taxRate: 0.07,
    optionGroups: [],
  },
];

const tablesSeed = [
  { id: "t1", label: "T1", seats: 4 },
  { id: "t2", label: "T2", seats: 4 },
  { id: "t3", label: "T3", seats: 4 },
  { id: "t4", label: "T4", seats: 4 },
  { id: "t5", label: "T5", seats: 6 },
  { id: "t6", label: "T6", seats: 2 },
];

/* =====================================================
 *                        STORE
 * ===================================================== */
export const usePOS = create(
  persist(
    (set, get) => ({
      /* ----- Hydration status ----- */
      isHydrated: false,
      hydrateError: null,

      /* ----- Business data (hydrated from Dexie) ----- */
      catalog: [],
      currency: "€",
      defaultTaxRate: 0.07,

      cart: [],
      orders: [],
      lastOrderId: null,

      tables: [],
      tickets: [],
      activeTableId: null,

      kitchenQueue: [],

      /* ----- Order-level adjustments ----- */
      discount: { type: "none", value: 0 },
      serviceChargePct: 0,
      tip: { type: "none", value: 0 },
      _serviceChargeTaxable: true,
      _tipTaxable: false,

      /* =========================
       * Server-driven setters (placeholders if you wire to Firestore)
       * ========================= */
      _setCatalogFromServer: (rows) => set({ catalog: rows || [] }),
      _setTablesFromServer: (rows) => set({ tables: rows || [] }),
      _setKitchenFromServer: (rows) => set({ kitchenQueue: rows || [] }),
      _setTicketFromServer: (tableId, tk) =>
        set((s) => {
          const others = (s.tickets || []).filter((t) => t.tableId !== tableId);
          const safe = tk ? ensureKitchen(tk) : null;
          return { tickets: safe ? [...others, safe] : others };
        }),

      /* =========================
       * Hydrate from IndexedDB (SAFE + WATCHDOG)
       * ========================= */
      hydrateFromDB: async () => {
        if (get().isHydrated) return;

        const fallback = {
          catalog: catalogSeed,
          tables: tablesSeed,
          tickets: [],
          orders: [],
          kitchenQueue: [],
          kitchenByTable: {},        // <— include
          isHydrated: true,
        };

        const watchdog = setTimeout(() => {
          if (!get().isHydrated) {
            console.warn("[POS] hydrate watchdog -> using fallback");
            set({ ...fallback, hydrateError: "watchdog timeout" });
          }
        }, 4000);

        try {
          await db.open();
          try { await migrateFromLocalStorage(); } catch { }
          await seedIfEmpty({ catalogSeed, tablesSeed });

          const [catalog, tables, ticketsRaw, orders, kitchen] = await Promise.all([
            db.catalog.toArray(),
            db.diningTables.toArray(),
            db.tickets.toArray(),
            db.orders.toArray(),
            db.kitchen.toArray(),
          ]);

          const tickets = (ticketsRaw || []).map((tk) => ensureKitchen(tk));

          // Build the volatile counters from persisted ticket.kitchen
          const kitchenByTable = {};
          for (const tk of tickets) {
            if (!tk.tableId) continue;
            const k = ensureKitchen(tk).kitchen;
            kitchenByTable[tk.tableId] = {
              prep: { ...(k.prep || {}) },
              served: { ...(k.served || {}) },
            };
          }

          set({
            catalog,
            tables,
            tickets,
            orders,
            kitchenQueue: kitchen,
            kitchenByTable,          // <— set
            isHydrated: true,
            hydrateError: null,
          });
        } catch (e) {
          console.error("[POS] hydrate error:", e);
          set({ ...fallback, hydrateError: e?.message || String(e) });
        } finally {
          clearTimeout(watchdog);
        }
      },


      /* =========================
       * Catalog CRUD
       * ========================= */
      addCatalogItem: ({ name, category, price, taxRate, optionGroups }) =>
        set((s) => {
          const it = {
            id: rid(),
            name: String(name || "").trim() || "Untitled",
            category: String(category || "").trim() || "General",
            price: Number(price) || 0,
            taxRate: Number(taxRate ?? s.defaultTaxRate) || 0,
            optionGroups: Array.isArray(optionGroups) ? optionGroups : [],
          };
          db.catalog.put(it).catch(console.error);
          Promise.resolve()
            .then(() => upsertProduct(it))
            .catch(console.error);
          return { catalog: [...s.catalog, it] };
        }),
      updateCatalogItem: (id, patch) =>
        set((s) => {
          const next = s.catalog.map((it) =>
            it.id === id
              ? {
                ...it,
                ...patch,
                name:
                  patch.name !== undefined ? String(patch.name).trim() : it.name,
                category:
                  patch.category !== undefined
                    ? String(patch.category).trim()
                    : it.category,
                price: patch.price !== undefined ? Number(patch.price) || 0 : it.price,
                taxRate:
                  patch.taxRate !== undefined ? Number(patch.taxRate) || 0 : it.taxRate,
                optionGroups: Array.isArray(patch.optionGroups)
                  ? patch.optionGroups
                  : it.optionGroups || [],
              }
              : it
          );
          const updated = next.find((x) => x.id === id);
          if (updated) db.catalog.put(updated).catch(console.error);
          Promise.resolve()
            .then(() => upsertProduct(updated))
            .catch(console.error);
          return { catalog: next };
        }),
      deleteCatalogItem: (id) =>
        set((s) => {
          db.catalog.delete(id).catch(console.error);
          Promise.resolve()
            .then(() => fbDeleteProduct(id))
            .catch(console.error);
          const tickets = s.tickets.map((tk) =>
            ensureKitchen({
              ...tk,
              items: tk.items.filter((l) => l.itemId !== id),
            })
          );
          tickets.forEach((tk) => db.tickets.put(tk).catch(console.error));
          return {
            catalog: s.catalog.filter((it) => it.id !== id),
            cart: s.cart.filter((l) => l.itemId !== id),
            tickets,
          };
        }),

      /* =========================
       * Cart
       * ========================= */
      addItem: (item, qty = 1, mods = []) =>
        set((s) => {
          const idx = s.cart.findIndex(
            (l) => l.itemId === item.id && sameMods(l.mods, mods)
          );
          if (idx >= 0) {
            const updated = [...s.cart];
            updated[idx] = { ...updated[idx], qty: updated[idx].qty + qty };
            return { cart: updated };
          }
          return { cart: [...s.cart, { id: rid(), itemId: item.id, qty, mods }] };
        }),
      increment: (lineId) =>
        set((s) => ({
          cart: s.cart.map((l) =>
            l.id === lineId ? { ...l, qty: l.qty + 1 } : l
          ),
        })),
      decrement: (lineId) =>
        set((s) => ({
          cart: s.cart.map((l) =>
            l.id === lineId ? { ...l, qty: Math.max(1, l.qty - 1) } : l
          ),
        })),
      changeQty: (lineId, qty) =>
        set((s) => ({
          cart: s.cart.map((l) =>
            l.id === lineId
              ? { ...l, qty: Math.max(1, Number(qty) || 1) }
              : l
          ),
        })),
      removeLine: (lineId) => set((s) => ({ cart: s.cart.filter((l) => l.id !== lineId) })),
      clearCart: () => set({ cart: [] }),

      /* =========================
       * Adjustments & totals
       * ========================= */
      setDiscountPercent: (p) =>
        set({
          discount: { type: "percent", value: Math.max(0, Number(p) || 0) },
        }),
      setDiscountAmount: (a) =>
        set({ discount: { type: "amount", value: Math.max(0, Number(a) || 0) } }),
      clearDiscount: () => set({ discount: { type: "none", value: 0 } }),
      setServiceChargePct: (p) =>
        set({ serviceChargePct: Math.max(0, Number(p) || 0) }),
      setTipPercent: (p) =>
        set({ tip: { type: "percent", value: Math.max(0, Number(p) || 0) } }),
      setTipAmount: (a) =>
        set({ tip: { type: "amount", value: Math.max(0, Number(a) || 0) } }),
      clearTip: () => set({ tip: { type: "none", value: 0 } }),

      getItem: (id) => get().catalog.find((it) => it.id === id),
      lineTotal: (line) => {
        const item = get().getItem(line.itemId);
        if (!item) return 0;
        const modsSum = (line.mods || []).reduce(
          (m, md) => m + (md.priceDelta || 0),
          0
        );
        return round2((item.price + modsSum) * line.qty);
      },
      cartBreakdown: () => {
        const defaultRate = get().defaultTaxRate;
        const scTaxable = get()._serviceChargeTaxable;
        const scRate = defaultRate;
        const tipTaxable = get()._tipTaxable;

        let itemsGross = 0,
          itemsNet = 0,
          itemsTax = 0;
        for (const l of get().cart) {
          const g = get().lineTotal(l);
          const it = get().getItem(l.itemId) || {};
          const r = Number(it.taxRate ?? defaultRate) || 0;
          const n = r ? g / (1 + r) : g;
          const t = g - n;
          itemsGross += g;
          itemsNet += n;
          itemsTax += t;
        }
        itemsGross = round2(itemsGross);
        itemsNet = round2(itemsNet);
        itemsTax = round2(itemsTax);

        const disc = get().discount || { type: "none", value: 0 };
        let discountGross = 0;
        if (disc.type === "percent")
          discountGross = itemsGross * (Math.max(0, Math.min(100, disc.value)) / 100);
        else if (disc.type === "amount")
          discountGross = Math.min(Math.max(0, disc.value), itemsGross);
        discountGross = round2(discountGross);
        const discountTax =
          itemsGross > 0 ? round2(itemsTax * (discountGross / itemsGross)) : 0;
        const discountNet = round2(discountGross - discountTax);

        const afterDiscGross = round2(itemsGross - discountGross);
        const afterDiscTax = round2(itemsTax - discountTax);

        const scPct = Math.max(0, Number(get().serviceChargePct) || 0);
        let scGross = round2(afterDiscGross * (scPct / 100));
        let scNet = scGross,
          scTax = 0;
        if (scTaxable && scGross > 0) {
          scNet = round2(scGross / (1 + scRate));
          scTax = round2(scGross - scNet);
        }

        const tip = get().tip || { type: "none", value: 0 };
        const tipBaseGross = round2(afterDiscGross + scGross);
        let tipGross = 0;
        if (tip.type === "percent")
          tipGross = round2(
            tipBaseGross * (Math.max(0, Math.min(100, tip.value)) / 100)
          );
        else if (tip.type === "amount")
          tipGross = Math.max(0, Number(tip.value) || 0);
        let tipNet = tipGross,
          tipTax = 0;
        if (tipTaxable && tipGross > 0) {
          tipNet = round2(tipGross / (1 + defaultRate));
          tipTax = round2(tipGross - tipNet);
        }

        const subtotalGross = round2(afterDiscGross + scGross);
        const taxTotal = round2(afterDiscTax + scTax + tipTax);
        const totalGross = round2(subtotalGross + tipGross);

        return {
          itemsGross,
          itemsNet,
          itemsTax,
          discountGross,
          discountNet,
          discountTax,
          serviceChargePct: scPct,
          serviceChargeGross: scGross,
          serviceChargeNet: scNet,
          serviceChargeTax: scTax,
          tipType: tip.type,
          tipValue: tip.value,
          tipGross,
          tipNet,
          tipTax,
          subtotalGross,
          tax: taxTotal,
          totalGross,
        };
      },
      subtotal: () => get().cartBreakdown().subtotalGross,
      tax: () => get().cartBreakdown().tax,
      total: () => get().cartBreakdown().totalGross,

      /* =========================
       * Tables / Tickets
       * ========================= */
      addTable: ({ label, seats = 4 }) =>
        set((s) => {
          const t = {
            id: rid(),
            label: String(label || "").trim() || "Table",
            seats: Number(seats) || 0,
          };
          db.diningTables.put(t).catch(console.error);
          Promise.resolve()
            .then(() => upsertTable(t))
            .catch(console.error);
          return { tables: [...s.tables, t] };
        }),
      updateTable: (id, patch) =>
        set((s) => {
          const next = s.tables.map((t) =>
            t.id === id
              ? {
                ...t,
                ...patch,
                label:
                  patch.label !== undefined
                    ? String(patch.label).trim()
                    : t.label,
              }
              : t
          );
          const updated = next.find((x) => x.id === id);
          if (updated) db.diningTables.put(updated).catch(console.error);
          Promise.resolve()
            .then(() => upsertTable(updated))
            .catch(console.error);
          return { tables: next };
        }),
      deleteTable: (id) =>
        set((s) => {
          const hasTicket = s.tickets.some((tk) => tk.tableId === id);
          if (hasTicket) return {};
          db.diningTables.delete(id).catch(console.error);
          Promise.resolve()
            .then(() => fbDeleteTable(id))
            .catch(console.error);
          return {
            tables: s.tables.filter((t) => t.id !== id),
            activeTableId: s.activeTableId === id ? null : s.activeTableId,
          };
        }),
      setActiveTable: (tableId) => set({ activeTableId: tableId }),
      getTicketByTable: (tableId) =>
        get().tickets.find((tk) => tk.tableId === tableId) || null,

      setTicketGuestName: (tableId, name) =>
        set((s) => {
          if (!tableId) return {};
          const ex = s.tickets.find((t) => t.tableId === tableId);
          const clean = (name || "").trim();
          if (ex) {
            const updated = ensureKitchen({
              ...ex,
              guestName: clean,
              updatedAt: Date.now(),
            });
            db.tickets.put(updated).catch(console.error);
            return {
              tickets: s.tickets.map((t) => (t.id === ex.id ? updated : t)),
            };
          } else {
            const newTk = ensureKitchen({
              id: rid(),
              tableId,
              guestName: clean,
              items: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            db.tickets.put(newTk).catch(console.error);
            return { tickets: [...s.tickets, newTk] };
          }
        }),

      // Replace items for a table, preserving guestName & kitchen counters
      saveCartToTableReplace: (tableId, opts = {}) =>
        set((s) => {
          if (!tableId) return {};
          const ex = s.tickets.find((t) => t.tableId === tableId);
          const mergedGuestName = opts.guestName ?? ex?.guestName ?? "";
          const prevKitchen = ensureKitchen(ex)?.kitchen || { prep: {}, served: {} };
          const tk = ensureKitchen({
            id: ex?.id ?? rid(),
            tableId,
            guestName: mergedGuestName,
            items: s.cart.map((l) => ({ ...l })),
            kitchen: prevKitchen,
            createdAt: ex?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
          });
          db.tickets.put(tk).catch(console.error);
          return ex
            ? { tickets: s.tickets.map((t) => (t.id === ex.id ? tk : t)) }
            : { tickets: [...s.tickets, tk] };
        }),

      parkCartToTable: (tableId) =>
        set((s) => {
          if (!tableId) return {};
          const existing = s.tickets.find((tk) => tk.tableId === tableId);
          if (existing) {
            const merged = mergeLines(existing.items, s.cart);
            const updated = ensureKitchen({
              ...existing,
              items: merged,
              updatedAt: Date.now(),
            });
            db.tickets.put(updated).catch(console.error);
            return {
              tickets: s.tickets.map((tk) => (tk.id === existing.id ? updated : tk)),
              cart: [],
            };
          }
          const ticket = ensureKitchen({
            id: rid(),
            tableId,
            items: [...s.cart],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          db.tickets.put(ticket).catch(console.error);
          return { tickets: [...s.tickets, ticket], cart: [] };
        }),

      loadTableToCart: (tableId) =>
        set((s) => {
          const tk = s.tickets.find((t) => t.tableId === tableId);
          if (!tk) return {};
          return { cart: tk.items.map((l) => ({ ...l })) };
        }),
      clearTableTicket: (tableId) =>
        set((s) => {
          const tk = s.tickets.find((t) => t.tableId === tableId);
          if (!tk) return {};
          db.tickets.delete(tk.id).catch(console.error);
          // ⬇️ RESET counters for this table when clearing ticket
          const kb = { ...(s.kitchenByTable || {}) };
          if (kb[tableId]) delete kb[tableId];
          return {
            tickets: s.tickets.filter((t) => t.id !== tk.id),
            kitchenByTable: kb,
          };
        }),
      resetKitchenForTable: (tableId) =>
        set((s) => {
          if (!tableId) return {};
          const kb = { ...(s.kitchenByTable || {}) };
          if (kb[tableId]) delete kb[tableId];
          // If a ticket still exists, also clear the embedded maps:
          const tickets = (s.tickets || []).map(t =>
            t.tableId === tableId
              ? { ...t, kitchen: { prep: {}, served: {} }, updatedAt: Date.now() }
              : t
          );
          tickets.forEach(t => db.tickets.put(t).catch(console.error));
          return { kitchenByTable: kb, tickets };
        }),


      transferTicket: (fromTableId, toTableId) =>
        set((s) => {
          if (!fromTableId || !toTableId || fromTableId === toTableId) return {};
          const from = s.tickets.find((tk) => tk.tableId === fromTableId);
          if (!from) return {};
          const to = s.tickets.find((tk) => tk.tableId === toTableId);

          if (to) {
            // Merge items and kitchen maps
            const mergedItems = mergeLines(to.items, from.items);
            const fromK = ensureKitchen(from).kitchen;
            const toK = ensureKitchen(to).kitchen;
            const target = ensureKitchen({
              ...to,
              items: mergedItems,
              kitchen: {
                prep: mergeMapsAdd(toK.prep, fromK.prep),
                served: mergeMapsAdd(toK.served, fromK.served),
              },
              updatedAt: Date.now(),
            });
            db.tickets.put(target).catch(console.error);
            db.tickets.delete(from.id).catch(console.error);
            return {
              tickets: s.tickets
                .map((tk) => (tk.id === to.id ? target : tk))
                .filter((tk) => tk.id !== from.id),
            };
          } else {
            const moved = ensureKitchen({
              ...from,
              tableId: toTableId,
              updatedAt: Date.now(),
            });
            db.tickets.put(moved).catch(console.error);
            return { tickets: s.tickets.map((tk) => (tk.id === from.id ? moved : tk)) };
          }
        }),

      mergeTables: (sourceTableId, targetTableId) =>
        get().transferTicket(sourceTableId, targetTableId),

      isTableOccupied: (tableId) =>
        !!get().tickets.find((tk) => tk.tableId === tableId),

      /* =========================
       * Kitchen (KDS) + per-table status
       * ========================= */
      // Send only deltas to KDS; update per-ticket kitchen.prep counts
      // Send only deltas to KDS; update per-table kitchen.prep counts (and persist)
      sendToKitchenFromCart: (tableId = null, { alsoParkToTable = true } = {}) => {
        const cart = get().cart;
        if (!cart.length) return null;

        const label = tableId
          ? (get().tables.find(t => t.id === tableId)?.label || "Table")
          : "TAKEAWAY";

        let existingTicket = null;
        let toSend = cart;

        if (tableId) {
          existingTicket = get().tickets.find(tk => tk.tableId === tableId) || null;
          if (existingTicket) {
            toSend = deltaLines(existingTicket.items || [], cart);
          }
        }

        // If nothing new, keep the ticket snapshot in sync and return
        if (tableId && existingTicket && toSend.length === 0) {
          const replaced = ensureKitchen({
            ...existingTicket,
            items: cart.map(l => ({ ...l })),
            updatedAt: Date.now(),
          });
          db.tickets.put(replaced).catch(console.error);
          set((s) => ({
            tickets: s.tickets.map(tk => (tk.id === replaced.id ? replaced : tk)),
          }));
          return { ticketId: null, tableLabel: label, sent: [] };
        }

        // Build KDS items FIRST (so we can use kItems below)
        const kItems = toSend.map(l => {
          const it = get().getItem(l.itemId) || {};
          const itemKey = lineKeyFrom(l.itemId, l.mods || []);
          return {
            id: rid(),
            lineId: l.id,
            itemKey,                         // used for kitchen counters
            name: it.name || "Unknown",
            modsText: modsLabel(l.mods || []),
            qty: l.qty,
            status: "pending",
          };
        });

        // Create and persist the KDS ticket
        const kTicket = {
          id: rid(),
          tableId: tableId || null,
          label,
          items: kItems,
          priority: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        db.kitchen.put(kTicket).catch(console.error);

        // Keep the table ticket snapshot up-to-date (replace)
        if (alsoParkToTable && tableId) {
          if (existingTicket) {
            const replaced = ensureKitchen({
              ...existingTicket,
              items: cart.map(l => ({ ...l })),
              updatedAt: Date.now(),
            });
            db.tickets.put(replaced).catch(console.error);
            set((s) => ({
              tickets: s.tickets.map(tk => (tk.id === replaced.id ? replaced : tk)),
            }));
          } else {
            const newTk = ensureKitchen({
              id: rid(),
              tableId,
              items: cart.map(l => ({ ...l })),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            db.tickets.put(newTk).catch(console.error);
            set((s) => ({ tickets: [...s.tickets, newTk] }));
          }
        }

        // Update in-memory queue and per-table counters
        set((s) => {
          const nextQueue = [...(s.kitchenQueue || []), kTicket];

          let nextKB = s.kitchenByTable || {};
          if (tableId) {
            const bucket = { prep: {}, served: {}, ...(nextKB[tableId] || {}) };
            for (const ki of kItems) {
              const q = Number(ki.qty || 0);
              if (q > 0) bucket.prep = addCount(bucket.prep, ki.itemKey, q);
            }
            nextKB = { ...nextKB, [tableId]: bucket };
          }

          return {
            kitchenQueue: nextQueue,
            // keep cart for table flow; clear for takeaway
            cart: tableId ? s.cart : [],
            kitchenByTable: nextKB,
          };
        });

        // Persist counters into the table ticket so they survive refresh
        if (tableId) {
          const stateNow = get();
          const tk = stateNow.tickets.find(t => t.tableId === tableId);
          if (tk) {
            const safe = ensureKitchen(tk);
            const prep = { ...safe.kitchen.prep };
            const served = { ...safe.kitchen.served };
            for (const ki of kItems) {
              const q = Number(ki.qty || 0);
              if (q > 0) prep[ki.itemKey] = (prep[ki.itemKey] || 0) + q;
            }
            const updatedTk = ensureKitchen({
              ...safe,
              kitchen: { prep, served },
              updatedAt: Date.now(),
            });
            db.tickets.put(updatedTk).catch(console.error);
            set((s) => ({
              tickets: s.tickets.map(t => (t.id === updatedTk.id ? updatedTk : t)),
            }));
          }
        }

        // Summary for UI toast
        const sentSummary = toSend.map(l => {
          const it = get().getItem(l.itemId) || {};
          return { name: it.name || "Unknown", qty: l.qty };
        });

        return { ticketId: kTicket.id, tableLabel: label, sent: sentSummary };
      },



      // Move specific quantities from prep -> served for a table (when KDS marks done)
      // moves: [{ itemId, mods, qty }]
      markKitchenDoneForTable: (tableId, moves = []) =>
        set((s) => {
          if (!tableId || !moves?.length) return {};
          const tk = s.tickets.find((t) => t.tableId === tableId);
          if (!tk) return {};
          const safe = ensureKitchen(tk);
          const prep = { ...safe.kitchen.prep };
          const served = { ...safe.kitchen.served };

          for (const mv of moves) {
            const key = lineKeyFrom(mv.itemId, mv.mods || []);
            const want = Math.max(0, Number(mv.qty) || 0);
            if (want === 0) continue;
            const available = Math.max(0, prep[key] || 0);
            const take = Math.min(available, want);
            if (take > 0) {
              prep[key] = available - take;
              served[key] = (served[key] || 0) + take;
            }
          }

          const updated = ensureKitchen({
            ...safe,
            kitchen: { prep, served },
            updatedAt: Date.now(),
          });
          db.tickets.put(updated).catch(console.error);
          return {
            tickets: s.tickets.map((t) => (t.id === updated.id ? updated : t)),
          };
        }),

      // Selector for UI
      getKitchenCountsForTable: (tableId) => {
        const tk =
          get().tickets.find((t) => t.tableId === tableId) || null;
        const safe = tk ? ensureKitchen(tk) : null;
        return safe?.kitchen || { prep: {}, served: {} };
      },

      kitchenByTable: {}, // tableId -> { prep: {key:qty}, served: {key:qty} }

      getKitchenCountsForTable: (tableId) => {
        const m = get().kitchenByTable?.[tableId];
        return m || { prep: {}, served: {} };
      },


      /* --- KDS item status controls (toggle single item / mark all done) --- */
      setKitchenItemStatus: (ticketId, kItemId, status) =>
        set((s) => {
          let prevStatus = null;
          let itemKey = "";
          let qty = 0;
          let tkForTable = null;

          const nextQueue = (s.kitchenQueue || []).map((tk) => {
            if (tk.id !== ticketId) return tk;
            tkForTable = tk;
            const items = tk.items.map((it) => {
              if (it.id !== kItemId) return it;
              prevStatus = it.status;
              itemKey = it.itemKey || "";
              qty = Number(it.qty || 0);
              return it.status === status ? it : { ...it, status };
            });
            return { ...tk, items, updatedAt: Date.now() };
          });

          if (!tkForTable || prevStatus == null || prevStatus === status) {
            return { kitchenQueue: nextQueue }; // nothing to move
          }
          if (!tkForTable.tableId) {
            return { kitchenQueue: nextQueue }; // only track table tickets
          }

          const tableId = tkForTable.tableId;
          const kbAll = s.kitchenByTable || {};
          const bucket = { prep: {}, served: {}, ...(kbAll[tableId] || {}) };

          if (status === "done" && prevStatus !== "done") {
            bucket.prep = subCount(bucket.prep, itemKey, qty);
            bucket.served = addCount(bucket.served, itemKey, qty);
          } else if (status !== "done" && prevStatus === "done") {
            bucket.served = subCount(bucket.served, itemKey, qty);
            bucket.prep = addCount(bucket.prep, itemKey, qty);
          }

          return {
            kitchenQueue: nextQueue,
            kitchenByTable: { ...kbAll, [tableId]: bucket },
          };
        }),


      // alias expected by your KDS.jsx (fixes "setItemStatus is not a function")
      setKitchenItemStatus: (ticketId, kItemId, status) =>
        set((s) => {
          let prevStatus = null;
          let itemKey = "";
          let qty = 0;
          let tkForTable = null;

          const nextQueue = (s.kitchenQueue || []).map((tk) => {
            if (tk.id !== ticketId) return tk;
            tkForTable = tk;
            const items = tk.items.map((it) => {
              if (it.id !== kItemId) return it;
              prevStatus = it.status;
              itemKey = it.itemKey || "";
              qty = Number(it.qty || 0);
              return it.status === status ? it : { ...it, status };
            });
            const updated = { ...tk, items, updatedAt: Date.now() };
            // persist the KDS ticket
            db.kitchen.put(updated).catch(console.error);
            return updated;
          });

          if (!tkForTable || prevStatus == null || prevStatus === status) {
            return { kitchenQueue: nextQueue }; // nothing changed
          }

          // Update volatile map
          const tableId = tkForTable.tableId || null;
          const kbAll = s.kitchenByTable || {};
          const bucket = { prep: {}, served: {}, ...(tableId ? (kbAll[tableId] || {}) : {}) };

          if (status === "done" && prevStatus !== "done") {
            bucket.prep = subCount(bucket.prep, itemKey, qty);
            bucket.served = addCount(bucket.served, itemKey, qty);
          } else if (status !== "done" && prevStatus === "done") {
            bucket.served = subCount(bucket.served, itemKey, qty);
            bucket.prep = addCount(bucket.prep, itemKey, qty);
          }

          const out = {
            kitchenQueue: nextQueue,
            kitchenByTable: tableId ? { ...kbAll, [tableId]: bucket } : kbAll,
          };

          // Persist the counters back into the table ticket so they survive refresh
          if (tableId) {
            const tkt = s.tickets.find((t) => t.tableId === tableId);
            if (tkt) {
              const safe = ensureKitchen(tkt);
              const prep = { ...safe.kitchen.prep };
              const served = { ...safe.kitchen.served };
              if (status === "done" && prevStatus !== "done") {
                prep[itemKey] = Math.max(0, (prep[itemKey] || 0) - qty);
                served[itemKey] = (served[itemKey] || 0) + qty;
              } else if (status !== "done" && prevStatus === "done") {
                served[itemKey] = Math.max(0, (served[itemKey] || 0) - qty);
                prep[itemKey] = (prep[itemKey] || 0) + qty;
              }
              const updatedTk = ensureKitchen({
                ...safe,
                kitchen: { prep, served },
                updatedAt: Date.now(),
              });
              db.tickets.put(updatedTk).catch(console.error);
              out.tickets = s.tickets.map((t) => (t.id === updatedTk.id ? updatedTk : t));
            }
          }

          return out;
        }),


      markKitchenTicketAllDone: (ticketId) =>
        set((s) => {
          let tk = null;
          const nextQueue = (s.kitchenQueue || []).map((t) => {
            if (t.id !== ticketId) return t;
            tk = {
              ...t,
              items: t.items.map((it) => ({ ...it, status: "done" })),
              updatedAt: Date.now(),
            };
            db.kitchen.put(tk).catch(console.error); // persist KDS ticket
            return tk;
          });

          if (!tk || !tk.tableId) return { kitchenQueue: nextQueue };

          // Move all prep -> served in memory map
          const kbAll = s.kitchenByTable || {};
          const bucket = { prep: {}, served: {}, ...(kbAll[tk.tableId] || {}) };
          for (const it of tk.items) {
            const k = it.itemKey || "";
            const q = Number(it.qty || 0);
            bucket.prep = subCount(bucket.prep, k, q);
            bucket.served = addCount(bucket.served, k, q);
          }

          const out = {
            kitchenQueue: nextQueue,
            kitchenByTable: { ...kbAll, [tk.tableId]: bucket },
          };

          // Persist into the table ticket
          const tkt = s.tickets.find((t) => t.tableId === tk.tableId);
          if (tkt) {
            const safe = ensureKitchen(tkt);
            const prep = { ...safe.kitchen.prep };
            const served = { ...safe.kitchen.served };
            for (const it of tk.items) {
              const k = it.itemKey || "";
              const q = Number(it.qty || 0);
              prep[k] = Math.max(0, (prep[k] || 0) - q);
              served[k] = (served[k] || 0) + q;
            }
            const updatedTk = ensureKitchen({
              ...safe,
              kitchen: { prep, served },
              updatedAt: Date.now(),
            });
            db.tickets.put(updatedTk).catch(console.error);
            out.tickets = s.tickets.map((t) => (t.id === updatedTk.id ? updatedTk : t));
          }

          return out;
        }),



      bumpKitchenTicket: (ticketId, force = null) =>
        set((s) => {
          const next = s.kitchenQueue.map((tk) =>
            tk.id !== ticketId
              ? tk
              : {
                ...tk,
                priority: force == null ? (tk.priority ? 0 : 1) : force ? 1 : 0,
                updatedAt: Date.now(),
              }
          );
          const updated = next.find((t) => t.id === ticketId);
          if (updated) db.kitchen.put(updated).catch(console.error);
          return { kitchenQueue: next };
        }),
      deleteKitchenTicket: (ticketId) =>
        set((s) => {
          const tk = (s.kitchenQueue || []).find((t) => t.id === ticketId);
          let nextKB = s.kitchenByTable || {};
          let out = {};

          if (tk && tk.tableId) {
            const bucket = { prep: {}, served: {}, ...(nextKB[tk.tableId] || {}) };

            // subtract only the still-pending quantities
            for (const it of tk.items) {
              const k = it.itemKey || "";
              const q = Number(it.qty || 0);
              if (it.status !== "done") {
                bucket.prep = subCount(bucket.prep, k, q);
              }
            }
            nextKB = { ...nextKB, [tk.tableId]: bucket };

            // persist into the table ticket
            const tkt = s.tickets.find((t) => t.tableId === tk.tableId);
            if (tkt) {
              const safe = ensureKitchen(tkt);
              const prep = { ...safe.kitchen.prep };
              for (const it of tk.items) {
                const k = it.itemKey || "";
                const q = Number(it.qty || 0);
                if (it.status !== "done") {
                  prep[k] = Math.max(0, (prep[k] || 0) - q);
                }
              }
              const updatedTk = ensureKitchen({
                ...safe,
                kitchen: { prep, served: { ...safe.kitchen.served } },
                updatedAt: Date.now(),
              });
              db.tickets.put(updatedTk).catch(console.error);
              out.tickets = s.tickets.map((t) => (t.id === updatedTk.id ? updatedTk : t));
            }
          }

          db.kitchen.delete(ticketId).catch(console.error);
          return {
            kitchenQueue: (s.kitchenQueue || []).filter((t) => t.id !== ticketId),
            kitchenByTable: nextKB,
            ...out,
          };
        }),


      /* =========================
       * Orders / Checkout
       * ========================= */
      getOrder: (id) => get().orders.find((o) => o.id === id),
      clearLastOrder: () => set({ lastOrderId: null }),
      checkout: ({
        method = "cash",
        tendered = null,
        tableId = null,
        user = null,
      } = {}) => {
        const cart = get().cart;
        if (!cart.length) return null;

        const snapshot = cart.map((l) => {
          const it = get().getItem(l.itemId) || {};
          const mods = l.mods || [];
          const lineTotal = get().lineTotal(l);
          return {
            id: l.id,
            name: it.name || "Unknown",
            price: it.price || 0,
            qty: l.qty,
            mods,
            lineTotal,
          };
        });

        const br = get().cartBreakdown();
        const payment = {
          method,
          amount: br.totalGross,
          tendered: tendered != null ? Number(tendered) : null,
          change:
            method === "cash" && tendered != null
              ? round2(Number(tendered) - br.totalGross)
              : 0,
        };

        const order = {
          id: rid(),
          tableId: tableId || null,
          items: snapshot,
          subtotal: br.subtotalGross,
          tax: br.tax,
          total: br.totalGross,
          payments: [payment],
          createdAt: Date.now(),
          user: user ? { id: user.id, name: user.name, role: user.role } : null,
          adjustments: {
            discount: { ...get().discount, amount: br.discountGross },
            serviceCharge: { pct: get().serviceChargePct, amount: br.serviceChargeGross },
            tip: { ...get().tip, amount: br.tipGross },
          },
        };

        db.orders.add(order).catch(console.error);
        Promise.resolve()
          .then(() => fbAddOrder(order))
          .catch(console.error);

        const updates = {
          orders: [...get().orders, order],
          lastOrderId: order.id,
          cart: [],
        };
        if (tableId) {
          const cur = get().tickets;
          const tk = cur.find((t) => t.tableId === tableId);
          if (tk) db.tickets.delete(tk.id).catch(console.error);
          updates.tickets = cur.filter((t) => t.tableId !== tableId);

          // ⬇️ RESET per-table kitchen counters after payment
          const kb = { ...(get().kitchenByTable || {}) };
          if (kb[tableId]) delete kb[tableId];
          updates.kitchenByTable = kb;
        }
        updates.discount = { type: "none", value: 0 };
        updates.serviceChargePct = 0;
        updates.tip = { type: "none", value: 0 };
        set(updates);
        return order.id;
      },

      /* =========================
       * Reporting
       * ========================= */
      ordersInRange: (startMs, endMs) =>
        (get().orders || []).filter(
          (o) => o.createdAt >= startMs && o.createdAt <= endMs
        ),
      sumOrders: (orders) => {
        const sum = (k) =>
          orders.reduce((acc, o) => acc + (o[k] || 0), 0);
        return {
          count: orders.length,
          subtotal: round2(sum("subtotal")),
          tax: round2(sum("tax")),
          total: round2(sum("total")),
        };
      },
      salesByItem: (orders) => {
        const map = new Map();
        for (const o of orders)
          for (const l of o.items) {
            const cur = map.get(l.name) || { qty: 0, gross: 0 };
            cur.qty += l.qty || 0;
            cur.gross += l.lineTotal || 0;
            map.set(l.name, cur);
          }
        return [...map.entries()]
          .map(([name, v]) => ({ name, qty: v.qty, gross: round2(v.gross) }))
          .sort((a, b) => b.gross - a.gross);
      },
      salesByCategory: (orders) => {
        const map = new Map();
        for (const o of orders)
          for (const l of o.items) {
            const it = get().catalog.find((ci) => ci.name === l.name);
            const cat = it?.category || "Uncategorized";
            map.set(cat, (map.get(cat) || 0) + (l.lineTotal || 0));
          }
        return [...map.entries()]
          .map(([category, gross]) => ({ category, gross: round2(gross) }))
          .sort((a, b) => b.gross - a.gross);
      },
    }),
    {
      name: "hotel-pos-lite",
      storage: createJSONStorage(() => localStorage),
      // Only persist lightweight UI bits (not full DB mirrors)
      partialize: (s) => ({
        currency: s.currency,
        defaultTaxRate: s.defaultTaxRate,
        activeTableId: s.activeTableId,
        cart: s.cart,
        discount: s.discount,
        serviceChargePct: s.serviceChargePct,
        tip: s.tip,
        kitchenByTable: s.kitchenByTable,   // <— add this
      }),
    }
  )
);

// (Dev helper) Inspect in console: __POS.getState()
if (import.meta?.env?.DEV && typeof window !== "undefined") {
  window.__POS = usePOS;
}
