// src/store/shiftStore.js
import { create } from "zustand";
import { db } from "../db/db.js";

const rid = () => (crypto?.randomUUID?.() || String(Date.now()) + Math.random().toString(16).slice(2));

export const useShift = create((set, get) => ({
  activeShift: null, // {id, userId, userName, openedAt, openingFloat, ...}

  // Load active shift for a user (call on page mount)
  loadActiveShift: async (userId) => {
    const rows = await db.shifts.where("userId").equals(userId).toArray();
    const open = rows.find((s) => !s.closedAt);
    set({ activeShift: open || null });
    return open || null;
  },

  openShift: async ({ user, openingFloat = 0, note = "" }) => {
    if (!user) throw new Error("No user");
    // Close any stale open shift for this user
    const rows = await db.shifts.where("userId").equals(user.id).toArray();
    const open = rows.find((s) => !s.closedAt);
    if (open) throw new Error("You already have an open shift.");

    const s = {
      id: rid(),
      userId: user.id,
      userName: user.name,
      openedAt: Date.now(),
      openingFloat: Number(openingFloat) || 0,
      noteOpen: String(note || ""),
      closedAt: null,
      closingCounted: null,
      salesGross: 0,
      cashSales: 0,
      cardSales: 0,
      cashIn: 0,
      cashOut: 0,
      noteClose: "",
    };
    await db.shifts.put(s);
    set({ activeShift: s });
    return s.id;
  },

  recordCash: async ({ type, amount, reason = "" }) => {
    const shift = get().activeShift;
    if (!shift) throw new Error("No active shift");
    const evt = {
      id: rid(),
      shiftId: shift.id,
      type: type === "out" ? "out" : "in",
      amount: Math.max(0, Number(amount) || 0),
      reason: String(reason || ""),
      createdAt: Date.now(),
    };
    await db.cash.put(evt);
    // no need to refetch everything; just bump cached sums
    const deltaIn = evt.type === "in" ? evt.amount : 0;
    const deltaOut = evt.type === "out" ? evt.amount : 0;
    set({ activeShift: { ...shift, cashIn: (shift.cashIn || 0) + deltaIn, cashOut: (shift.cashOut || 0) + deltaOut } });
    return evt.id;
  },

  // Provide history list for the current user (latest first)
  listShifts: async (userId, limit = 20) => {
    const all = await db.shifts.where("userId").equals(userId).toArray();
    return all.sort((a, b) => (b.openedAt || 0) - (a.openedAt || 0)).slice(0, limit);
  },

  // At close, compute and store snapshot totals (pass computed sales/cash totals from UI)
  closeShift: async ({ salesGross, cashSales, cardSales, cashIn, cashOut, closingCounted = 0, note = "" }) => {
    const shift = get().activeShift;
    if (!shift) throw new Error("No active shift");
    const updated = {
      ...shift,
      closedAt: Date.now(),
      salesGross: Number(salesGross) || 0,
      cashSales: Number(cashSales) || 0,
      cardSales: Number(cardSales) || 0,
      cashIn: Number(cashIn) || 0,
      cashOut: Number(cashOut) || 0,
      closingCounted: Number(closingCounted) || 0,
      noteClose: String(note || ""),
    };
    await db.shifts.put(updated);
    set({ activeShift: null });
    return updated.id;
  },

  // Utility to get cash movements for a shift
  listCashForShift: async (shiftId) => {
    const rows = await db.cash.where("shiftId").equals(shiftId).toArray();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    return rows;
  },
}));
