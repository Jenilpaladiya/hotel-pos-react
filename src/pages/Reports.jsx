// src/pages/Reports.jsx
import { useEffect, useMemo, useState } from "react";
import { usePOS } from "../store/posStore.js";
import { useAuth } from "../store/authStore.js";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Legend
} from "recharts";

const fmt = (n, c = "€") => `${c} ${Number(n || 0).toFixed(2)}`;
const pad = (x) => String(x).padStart(2, "0");
const yyyy_mm_dd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoLocal = (ms) => new Date(ms).toLocaleString();

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6); // last 7 days
  return { from: yyyy_mm_dd(start), to: yyyy_mm_dd(end) };
}

export default function Reports() {
  // Auth guard
  const user = useAuth((s) => s.user);
  const hasRole = useAuth((s) => s.hasRole);
  const users = useAuth((s) => s.users);

  // POS data & helpers
  const orders = usePOS((s) => s.orders);
  const currency = usePOS((s) => s.currency);
  const salesByItem = usePOS((s) => s.salesByItem);
  const salesByCategory = usePOS((s) => s.salesByCategory);

  // Filters
  const { from: defFrom, to: defTo } = defaultRange();
  const [fromDate, setFromDate] = useState(defFrom);
  const [toDate, setToDate] = useState(defTo);
  const [cashier, setCashier] = useState("ALL"); // userId or "ALL"
  const [payment, setPayment] = useState("ALL"); // "ALL" | "cash" | "card"

  useEffect(() => {
    // allow admin & cashier
  }, []);

  if (!user) {
    return <div className="bg-white border rounded-xl p-4">Please <a className="underline" href="/login">login</a> to view reports.</div>;
  }
  if (!hasRole(["admin", "cashier"])) {
    return <div className="bg-white border rounded-xl p-4">Reports: Admin or Cashier only.</div>;
  }

  // Build range
  const rangeMs = useMemo(() => {
    if (!fromDate || !toDate) return null;
    const s = new Date(`${fromDate}T00:00:00`).getTime();
    const e = new Date(`${toDate}T23:59:59.999`).getTime();
    if (Number.isNaN(s) || Number.isNaN(e) || s > e) return null;
    return { s, e };
  }, [fromDate, toDate]);

  // Filtered orders
  const filtered = useMemo(() => {
    if (!rangeMs) return [];
    return (orders || []).filter((o) => {
      if (o.createdAt < rangeMs.s || o.createdAt > rangeMs.e) return false;
      if (cashier !== "ALL" && o.user?.id !== cashier) return false;
      const pm = o.payments?.[0]?.method || "";
      if (payment !== "ALL" && pm !== payment) return false;
      return true;
    });
  }, [orders, rangeMs, cashier, payment]);

  // KPI totals
  const kpis = useMemo(() => {
    const out = {
      count: 0,
      subtotal: 0,
      tax: 0,
      total: 0,
      discount: 0,
      service: 0,
      tip: 0,
      cashTotal: 0,
      cardTotal: 0,
    };
    for (const o of filtered) {
      out.count += 1;
      out.subtotal += o.subtotal || 0; // gross-style subtotal from your store
      out.tax += o.tax || 0;           // info
      out.total += o.total || 0;

      const adj = o.adjustments || {};
      out.discount += adj?.discount?.amount || 0;
      out.service += adj?.serviceCharge?.amount || 0;
      out.tip += adj?.tip?.amount || 0;

      const pm = o.payments?.[0];
      if (pm?.method === "cash") out.cashTotal += pm.amount || 0;
      if (pm?.method === "card") out.cardTotal += pm.amount || 0;
    }
    return out;
  }, [filtered]);

  const avg = kpis.count ? kpis.total / kpis.count : 0;

  // Daily line chart
  const daily = useMemo(() => {
    const map = new Map();
    for (const o of filtered) {
      const d = yyyy_mm_dd(new Date(o.createdAt));
      const row = map.get(d) || { day: d, total: 0, count: 0 };
      row.total += o.total || 0;
      row.count += 1;
      map.set(d, row);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [filtered]);

  // Payment bar chart
  const paymentsData = useMemo(() => ([
    { name: "Cash", amount: Number(kpis.cashTotal.toFixed(2)) },
    { name: "Card", amount: Number(kpis.cardTotal.toFixed(2)) },
  ]), [kpis.cashTotal, kpis.cardTotal]);

  // Hour of day bar chart
  const hourly = useMemo(() => {
    const arr = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0 }));
    for (const o of filtered) {
      const h = new Date(o.createdAt).getHours();
      arr[h].total += o.total || 0;
    }
    return arr;
  }, [filtered]);

  // Top lists (merged “basic” feature)
  const topItems = useMemo(() => salesByItem(filtered).slice(0, 10), [filtered, salesByItem]);
  const topCats  = useMemo(() => salesByCategory(filtered).slice(0, 10), [filtered, salesByCategory]);

  // CSV export
  const exportCSV = () => {
    const header = [
      "orderId","createdAtISO","cashier","payment","subtotal","discount","serviceCharge","tip","tax","total","items"
    ];
    const rows = filtered.map((o) => {
      const pm = o.payments?.[0]?.method || "";
      const itemsText = (o.items || [])
        .map((l) => `x${l.qty} ${l.name}${l.mods?.length ? ` [${l.mods.map((m) => m.name).join("; ")}]` : ""}`)
        .join(" | ");
      const adj = o.adjustments || {};
      return [
        o.id,
        new Date(o.createdAt).toISOString(),
        o.user?.name || "",
        pm,
        (o.subtotal ?? 0).toFixed(2),
        (adj?.discount?.amount ?? 0).toFixed(2),
        (adj?.serviceCharge?.amount ?? 0).toFixed(2),
        (adj?.tip?.amount ?? 0).toFixed(2),
        (o.tax ?? 0).toFixed(2),
        (o.total ?? 0).toFixed(2),
        `"${itemsText.replace(/"/g, '""')}"`
      ].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hotel-pos-report_${fromDate.replaceAll("-","")}_${toDate.replaceAll("-","")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print (browser PDF)
  const onPrint = () => window.print();

  const quickSet = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setFromDate(yyyy_mm_dd(start));
    setToDate(yyyy_mm_dd(end));
  };

  return (
    <div className="space-y-6">
      {/* print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-block { display: block !important; }
          body { background: white; }
        }
      `}</style>

      <section className="bg-white border rounded-xl p-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3">
          <h1 className="text-2xl font-semibold mr-auto">Reports</h1>

          <div>
            <label className="block text-xs opacity-70">From</label>
            <input type="date" className="border rounded px-2 py-1" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs opacity-70">To</label>
            <input type="date" className="border rounded px-2 py-1" value={toDate} onChange={(e)=>setToDate(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs opacity-70">Cashier</label>
            <select className="border rounded px-2 py-1 min-w-[160px]" value={cashier} onChange={(e)=>setCashier(e.target.value)}>
              <option value="ALL">All</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs opacity-70">Payment</label>
            <select className="border rounded px-2 py-1" value={payment} onChange={(e)=>setPayment(e.target.value)}>
              <option value="ALL">All</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button className="px-2 py-1 border rounded no-print" onClick={()=>quickSet(1)}>Today</button>
            <button className="px-2 py-1 border rounded no-print" onClick={()=>quickSet(7)}>7d</button>
            <button className="px-2 py-1 border rounded no-print" onClick={()=>quickSet(30)}>30d</button>
          </div>

          <button className="px-3 py-2 rounded-xl border no-print" onClick={exportCSV}>Export CSV</button>
          <button className="px-3 py-2 rounded-xl bg-black text-white no-print" onClick={onPrint}>Print / PDF</button>
        </div>

        {/* KPIs */}
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <Tile label="Orders" value={kpis.count} />
          <Tile label="Total" value={fmt(kpis.total, currency)} bold />
          <Tile label="Avg Order" value={fmt(kpis.count ? kpis.total / kpis.count : 0, currency)} />
          <Tile label="Discounts" value={`− ${fmt(kpis.discount, currency)}`} />
          <Tile label="Service" value={`+ ${fmt(kpis.service, currency)}`} />
          <Tile label="Tips" value={`+ ${fmt(kpis.tip, currency)}`} />
        </div>

        {/* Charts */}
        <div className="mt-4 grid lg:grid-cols-2 gap-4">
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-2">Daily Sales</div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="font-medium mb-2">Payment Breakdown</div>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="amount" name="Amount" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Hourly */}
        <div className="mt-4 border rounded-lg p-3">
          <div className="font-medium mb-2">Sales by Hour</div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top lists */}
        <div className="mt-4 grid lg:grid-cols-2 gap-4">
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-2">Top Items</div>
            <Table
              cols={["Item", "Qty", "Gross"]}
              rows={topItems.map(i => [i.name, i.qty, fmt(i.gross, currency)])}
              empty="No sales."
            />
          </div>
          <div className="border rounded-lg p-3">
            <div className="font-medium mb-2">Top Categories</div>
            <Table
              cols={["Category", "Gross"]}
              rows={topCats.map(c => [c.category, fmt(c.gross, currency)])}
              empty="No sales."
            />
          </div>
        </div>

        {/* Orders table */}
        <div className="mt-4 border rounded-lg p-3">
          <div className="font-medium mb-2">Orders ({filtered.length})</div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  {["Date/Time","Order","Cashier","Payment","Subtotal","Discount","Service","Tip","Tax","Total"].map((h)=>(
                    <th key={h} className="py-1 pr-2 border-b">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const pm = o.payments?.[0]?.method || "";
                  const adj = o.adjustments || {};
                  return (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-1 pr-2">{isoLocal(o.createdAt)}</td>
                      <td className="py-1 pr-2">#{o.id.slice(-6)}</td>
                      <td className="py-1 pr-2">{o.user?.name || "-"}</td>
                      <td className="py-1 pr-2">{pm || "-"}</td>
                      <td className="py-1 pr-2">{fmt(o.subtotal ?? 0, currency)}</td>
                      <td className="py-1 pr-2">− {fmt(adj?.discount?.amount ?? 0, currency)}</td>
                      <td className="py-1 pr-2">+ {fmt(adj?.serviceCharge?.amount ?? 0, currency)}</td>
                      <td className="py-1 pr-2">+ {fmt(adj?.tip?.amount ?? 0, currency)}</td>
                      <td className="py-1 pr-2">{fmt(o.tax ?? 0, currency)}</td>
                      <td className="py-1 pr-2 font-medium">{fmt(o.total ?? 0, currency)}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="py-2 opacity-60">No orders in this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Print footer */}
        <div className="hidden print-block mt-4 text-sm opacity-70">
          Generated: {new Date().toLocaleString()} · Range: {fromDate} → {toDate} · Cashier: {cashier === "ALL" ? "All" : (users.find(u=>u.id===cashier)?.name || "")}
        </div>
      </section>
    </div>
  );
}

function Tile({ label, value, bold }) {
  return (
    <div className={`border rounded-lg p-3 ${bold ? "font-semibold" : ""}`}>
      <div className="text-sm opacity-70">{label}</div>
      <div className="text-xl">{value}</div>
    </div>
  );
}

function Table({ cols, rows, empty }) {
  if (!rows?.length) return <div className="opacity-60 text-sm">{empty}</div>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left">
            {cols.map((c) => (
              <th key={c} className="py-1 pr-2 border-b">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0">
              {r.map((cell, j) => (
                <td key={j} className="py-1 pr-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
