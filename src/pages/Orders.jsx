// src/pages/Orders.jsx
import { useEffect, useMemo, useState } from "react";
import { usePOS } from "../store/posStore.js";
import Receipt from "../components/Receipt.jsx";

const fmt2 = (n) => (Number(n || 0)).toFixed(2);

function dayRangeFromISO(isoDate) {
  const d = new Date(isoDate + "T00:00:00");
  const start = new Date(d).setHours(0, 0, 0, 0);
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
}

export default function Orders() {
  const currency        = usePOS((s) => s.currency);
  const getOrder        = usePOS((s) => s.getOrder);
  const ordersInRange   = usePOS((s) => s.ordersInRange);
  const sumOrders       = usePOS((s) => s.sumOrders);
  const salesByItem     = usePOS((s) => s.salesByItem);
  const salesByCategory = usePOS((s) => s.salesByCategory);

  const todayISO = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayISO);

  const { start, end } = useMemo(() => dayRangeFromISO(date), [date]);

  const rangeOrders = ordersInRange(start, end);
  const totals = sumOrders(rangeOrders);
  const byItem = salesByItem(rangeOrders);
  const byCat  = salesByCategory(rangeOrders);

  const [printOrderId, setPrintOrderId] = useState(null);
  const order = printOrderId ? getOrder(printOrderId) : null;
  useEffect(() => {
    if (order) {
      setTimeout(() => {
        window.print();
        setTimeout(() => setPrintOrderId(null), 300);
      }, 100);
    }
  }, [order]);

  const onExportCSV = () => {
    const rows = [
      ["Date", date],
      [],
      ["Totals"],
      ["Count", "Subtotal", "Tax", "Total"],
      [totals.count, totals.subtotal, totals.tax, totals.total],
      [],
      ["Sales by Item"],
      ["Item", "Qty", "Gross"],
      ...byItem.map(r => [r.name, r.qty, r.gross]),
      [],
      ["Sales by Category"],
      ["Category", "Gross"],
      ...byCat.map(r => [r.category, r.gross]),
    ];
    const csv = rows.map(r => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <section className="bg-white border rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div>
            <label className="block text-sm mb-1">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-2" />
          </div>
          <div className="md:ml-auto flex gap-2">
            <button className="px-4 py-2 rounded-xl border" onClick={() => setDate(todayISO)}>Today</button>
            <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={onExportCSV}>Export CSV</button>
          </div>
        </div>
      </section>

      {/* Day Summary */}
      <section className="bg-white border rounded-xl p-4">
        <h2 className="text-xl font-semibold mb-3">Day Summary</h2>
        <div className="grid sm:grid-cols-5 gap-3">
          <Stat label="Orders"   value={totals.count} />
          <Stat label="Subtotal" value={`${currency} ${fmt2(totals.subtotal)}`} />
          <Stat label="Tax"      value={`${currency} ${fmt2(totals.tax)}`} />
          <Stat label="Total"    value={`${currency} ${fmt2(totals.total)}`} />
          <Stat label="Avg Order" value={`${currency} ${fmt2(totals.count ? totals.total / totals.count : 0)}`} />
        </div>
      </section>

      {/* Sales by Item */}
      <section className="bg-white border rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-2">Sales by Item</h3>
        <Table columns={["Item", "Qty", "Gross"]} rows={byItem.map(r => [r.name, r.qty, `${currency} ${fmt2(r.gross)}`])} empty="No sales." />
      </section>

      {/* Sales by Category */}
      <section className="bg-white border rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-2">Sales by Category</h3>
        <Table columns={["Category", "Gross"]} rows={byCat.map(r => [r.category, `${currency} ${fmt2(r.gross)}`])} empty="No sales." />
      </section>

      {/* Orders list */}
      <section className="bg-white border rounded-xl p-4">
        <h3 className="text-lg font-semibold mb-3">Orders</h3>
        {rangeOrders.length === 0 ? (
          <div className="opacity-70">No orders for this date.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left border-b">
                <tr>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Items</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Payment</th>
                  <th className="py-2 pr-3">By</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rangeOrders.slice().sort((a, b) => b.createdAt - a.createdAt).map((o) => (
                  <tr key={o.id} className="border-b last:border-none">
                    <td className="py-2 pr-3">{new Date(o.createdAt).toLocaleTimeString()}</td>
                    <td className="py-2 pr-3">{o.items.map(i => `${i.qty}× ${i.name}`).join(", ")}</td>
                    <td className="py-2 pr-3">{currency} {fmt2(o.total)}</td>
                    <td className="py-2 pr-3">{o.payments?.[0]?.method || "-"}</td>
                    <td className="py-2 pr-3">{o.user?.name || "—"}{o.user?.role ? ` (${o.user.role})` : ""}</td>
                    <td className="py-2 pr-3">
                      <button className="px-3 py-1 border rounded" onClick={() => setPrintOrderId(o.id)}>Reprint</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Hidden print area for reprints */}
      {order && (
        <div className="print-area">
          <Receipt order={order} currency={currency} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="border rounded-xl p-3">
      <div className="text-sm opacity-60">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
function Table({ columns, rows, empty }) {
  if (!rows.length) return <div className="opacity-70">{empty}</div>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="text-left border-b">
          <tr>{columns.map((c, i) => <th key={i} className="py-2 pr-3">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-none">
              {r.map((cell, j) => <td key={j} className="py-2 pr-3">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
