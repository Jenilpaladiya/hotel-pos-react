// src/pages/Shifts.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../store/authStore.js";
import { useShift } from "../store/shiftStore.js";
import { usePOS } from "../store/posStore.js";

const fmt = (n, c = "€") => `${c} ${Number(n || 0).toFixed(2)}`;

export default function Shifts() {
  const user = useAuth((s) => s.user);
  const hasRole = useAuth((s) => s.hasRole);

  const orders = usePOS((s) => s.orders);
  const currency = usePOS((s) => s.currency);

  const active = useShift((s) => s.activeShift);
  const loadActiveShift = useShift((s) => s.loadActiveShift);
  const openShift = useShift((s) => s.openShift);
  const closeShift = useShift((s) => s.closeShift);
  const recordCash = useShift((s) => s.recordCash);
  const listShifts = useShift((s) => s.listShifts);
  const listCashForShift = useShift((s) => s.listCashForShift);

  const [history, setHistory] = useState([]);
  const [cashRows, setCashRows] = useState([]);
  const [openingFloat, setOpeningFloat] = useState(0);
  const [closingCounted, setClosingCounted] = useState(0);
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [cashType, setCashType] = useState("in");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    loadActiveShift(user.id).then(async (s) => {
      setHistory(await listShifts(user.id));
      if (s) setCashRows(await listCashForShift(s.id));
    });
  }, [user, loadActiveShift, listShifts, listCashForShift]);

  useEffect(() => {
    (async () => {
      if (active) setCashRows(await listCashForShift(active.id));
    })();
  }, [active, listCashForShift]);

  if (!user) {
    return <div className="bg-white border rounded-xl p-4">Please <a className="underline" href="/login">login</a> to manage shifts.</div>;
  }
  if (!hasRole(["cashier", "admin"])) {
    return <div className="bg-white border rounded-xl p-4">Access denied. Cashier or Admin only.</div>;
  }

  // Compute running sales totals for this user within this shift window
  const totals = useMemo(() => {
    if (!active) return { salesGross: 0, cashSales: 0, cardSales: 0 };
    const from = active.openedAt;
    const userId = user.id;
    let salesGross = 0, cashSales = 0, cardSales = 0;
    for (const o of orders) {
      if (o.createdAt < from) continue;
      if (o.user?.id !== userId) continue; // per-cashier shift
      salesGross += o.total || 0;
      const p = (o.payments && o.payments[0]) || null;
      if (p?.method === "cash") cashSales += p.amount || 0;
      else cardSales += p?.amount || 0;
    }
    // cash movements
    let cashIn = 0, cashOut = 0;
    for (const r of cashRows) {
      if (r.type === "in") cashIn += r.amount || 0;
      else cashOut += r.amount || 0;
    }
    return { salesGross, cashSales, cardSales, cashIn, cashOut };
  }, [active, orders, cashRows, user]);

  const expectedTill = active
    ? (Number(active.openingFloat || 0) + totals.cashIn - totals.cashOut + totals.cashSales)
    : 0;

  const openNow = async () => {
    setMsg("");
    try {
      await openShift({ user, openingFloat, note });
      setOpeningFloat(0); setNote("");
      setHistory(await listShifts(user.id));
      setMsg("Shift opened.");
    } catch (e) {
      setMsg(e?.message || String(e));
    }
  };

  const addCash = async () => {
    setMsg("");
    try {
      await recordCash({ type: cashType, amount, reason: note });
      setAmount("");
      setCashRows(await listCashForShift(active.id));
    } catch (e) {
      setMsg(e?.message || String(e));
    }
  };

  const closeNow = async () => {
    setMsg("");
    try {
      await closeShift({
        salesGross: totals.salesGross,
        cashSales: totals.cashSales,
        cardSales: totals.cardSales,
        cashIn: totals.cashIn,
        cashOut: totals.cashOut,
        closingCounted,
        note,
      });
      setClosingCounted(0); setNote("");
      setHistory(await listShifts(user.id));
      setCashRows([]);
      setMsg("Shift closed.");
    } catch (e) {
      setMsg(e?.message || String(e));
    }
  };

  return (
    <div className="space-y-6">
      {/* Open / Active / Close */}
      <section className="bg-white border rounded-xl p-4">
        <h1 className="text-2xl font-semibold mb-2">Shifts</h1>

        {!active ? (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-3">
              <div className="font-medium mb-2">Open Shift</div>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm mb-1">Opening Float ({currency})</label>
                  <input type="number" className="border rounded px-2 py-1 w-40" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm mb-1">Note</label>
                  <input className="border rounded px-2 py-1 w-full" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={openNow}>Open Shift</button>
              </div>
            </div>

            <div className="border rounded-lg p-3">
              <div className="font-medium mb-2">History (recent)</div>
              <ShiftList rows={history} currency={currency} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border rounded-lg p-3">
              <div className="font-medium">Active Shift</div>
              <div className="text-sm opacity-70">
                Opened: {new Date(active.openedAt).toLocaleString()} · Float: <strong>{fmt(active.openingFloat, currency)}</strong>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-3">
                <div className="font-medium mb-1">Running Totals</div>
                <Stat label="Sales (gross)" value={fmt(totals.salesGross, currency)} />
                <Stat label="Cash sales" value={fmt(totals.cashSales, currency)} />
                <Stat label="Card sales" value={fmt(totals.cardSales, currency)} />
                <Stat label="Cash In" value={fmt(totals.cashIn, currency)} />
                <Stat label="Cash Out" value={fmt(totals.cashOut, currency)} />
                <Stat label="Expected till" value={fmt(expectedTill, currency)} bold />
              </div>

              <div className="border rounded-lg p-3">
                <div className="font-medium mb-2">Cash Movement</div>
                <div className="flex items-end gap-2">
                  <select className="border rounded px-2 py-1" value={cashType} onChange={(e) => setCashType(e.target.value)}>
                    <option value="in">Cash IN (drop)</option>
                    <option value="out">Cash OUT (payout)</option>
                  </select>
                  <input type="number" className="border rounded px-2 py-1 w-32" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  <input className="border rounded px-2 py-1 flex-1" placeholder="Reason / note" value={note} onChange={(e) => setNote(e.target.value)} />
                  <button className="px-3 py-1 border rounded" onClick={addCash}>Record</button>
                </div>
                <div className="mt-2 text-sm opacity-70">This updates your expected till instantly.</div>
              </div>
            </div>

            <div className="border rounded-lg p-3">
              <div className="font-medium mb-2">Close Shift</div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-sm mb-1">Counted in Till ({currency})</label>
                  <input type="number" className="border rounded px-2 py-1 w-40" value={closingCounted} onChange={(e) => setClosingCounted(e.target.value)} />
                </div>
                <input className="border rounded px-2 py-1 flex-1" placeholder="Closing note" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={closeNow}>Close Shift</button>
              </div>
              <div className="mt-2 text-sm">
                Difference: <strong>{fmt((Number(closingCounted || 0) - expectedTill), currency)}</strong>
              </div>
            </div>

            <div className="border rounded-lg p-3">
              <div className="font-medium mb-1">Cash Movements (this shift)</div>
              <ul className="text-sm space-y-1 max-h-48 overflow-auto pr-1">
                {cashRows.map((r) => (
                  <li key={r.id} className="flex justify-between">
                    <span>{new Date(r.createdAt).toLocaleTimeString()} — {r.type.toUpperCase()} {r.reason ? `· ${r.reason}` : ""}</span>
                    <span>{fmt(r.amount, currency)}</span>
                  </li>
                ))}
                {cashRows.length === 0 && <li className="opacity-60">None</li>}
              </ul>
            </div>
          </div>
        )}

        {msg && <div className="mt-3 text-sm">{msg}</div>}
      </section>
    </div>
  );
}

function Stat({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

function ShiftList({ rows, currency }) {
  if (!rows?.length) return <div className="text-sm opacity-60">No previous shifts.</div>;
  return (
    <ul className="text-sm space-y-1 max-h-56 overflow-auto pr-1">
      {rows.map((s) => (
        <li key={s.id} className="flex justify-between">
          <span>{new Date(s.openedAt).toLocaleDateString()} · {s.userName} {s.closedAt ? "(closed)" : "(open)"}</span>
          <span>{s.salesGross != null ? `Sales ${fmt(s.salesGross, currency)}` : ""}</span>
        </li>
      ))}
    </ul>
  );
}
