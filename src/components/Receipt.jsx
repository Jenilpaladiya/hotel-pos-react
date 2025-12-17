// src/components/Receipt.jsx
// Renders a clean A4-friendly invoice that also works on thermal printers.
// Assumes order snapshot shape from your checkout(): items[{ name, qty, lineTotal, mods[] }], etc.

function money(n, currency) {
  const v = Number(n || 0);
  return `${currency} ${v.toFixed(2)}`;
}

function fmtDate(ms) {
  const d = new Date(ms || Date.now());
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Receipt({ order, currency = "€" }) {
  if (!order) return null;

  const {
    id,
    createdAt,
    tableId,
    user,
    items = [],
    subtotal = 0,
    tax = 0,
    total = 0,
    payments = [],
    adjustments = {},
  } = order;

  const pay = payments?.[0] || { method: "cash", amount: total, tendered: null, change: 0 };

  const discAmt = adjustments?.discount?.amount || 0;
  const svcAmt  = adjustments?.serviceCharge?.amount || 0;
  const svcPct  = adjustments?.serviceCharge?.pct || 0;
  const tipAmt  = adjustments?.tip?.amount || 0;

  return (
    // Hidden on screen, visible only when printing (and when window.print is called)
    <div className="hidden print:block">
      <div className="invoice-wrapper">
        {/* Header / Store identity — replace with your details */}
        <header className="mb-4">
          <div className="text-xl font-bold">Hotel POS</div>
          <div className="text-sm leading-5">
            123 Sample Street, Berlin<br/>
            +49 123 456789 • hello@example.com
          </div>
        </header>

        {/* Meta row */}
        <section className="grid grid-cols-2 gap-2 text-sm mb-3">
          <div>
            <div><span className="font-semibold">Invoice #</span> {id}</div>
            <div><span className="font-semibold">Date</span> {fmtDate(createdAt)}</div>
          </div>
          <div className="text-right">
            {tableId && <div><span className="font-semibold">Table</span> {tableId}</div>}
            {user && <div><span className="font-semibold">Cashier</span> {user.name} ({user.role})</div>}
            <div><span className="font-semibold">Payment</span> {pay.method.toUpperCase()}</div>
          </div>
        </section>

        {/* Items */}
        <section className="mb-3">
          <div className="border-b py-2 font-semibold text-sm grid grid-cols-12">
            <div className="col-span-7">Item</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-3 text-right">Total</div>
          </div>
          {items.map((l) => (
            <div key={l.id} className="py-2 border-b grid grid-cols-12 text-sm">
              <div className="col-span-7">
                <div className="font-medium">{l.name}</div>
                {!!(l.mods?.length) && (
                  <div className="text-[12px] opacity-80">
                    {l.mods.map((m) => m.name).join(", ")}
                  </div>
                )}
              </div>
              <div className="col-span-2 text-right">{l.qty}</div>
              <div className="col-span-3 text-right">{money(l.lineTotal, currency)}</div>
            </div>
          ))}
        </section>

        {/* Totals */}
        <section className="text-sm space-y-1">
          <Row label="Subtotal" value={money(subtotal, currency)} />
          {discAmt > 0 && <Row label="Discount" value={`− ${money(discAmt, currency)}`} />}
          {svcAmt > 0 && <Row label={`Service (${svcPct || 0}% )`} value={`+ ${money(svcAmt, currency)}`} />}
          {tax > 0 && <Row label="Tax (incl.)" value={money(tax, currency)} />}
          {tipAmt > 0 && <Row label="Tip" value={`+ ${money(tipAmt, currency)}`} />}
          <Row label="Total" value={money(total, currency)} bold />

          {/* Payment summary */}
          <div className="mt-2 grid grid-cols-2">
            <div className="font-medium">Paid via {pay.method.toUpperCase()}</div>
            <div className="text-right">
              {pay.tendered != null && (
                <div>Tendered: {money(pay.tendered, currency)}</div>
              )}
              {pay.change > 0 && (
                <div>Change: {money(pay.change, currency)}</div>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-6 text-center text-[12px] leading-5 opacity-80">
          Thanks for your visit!<br/>
          VAT included where applicable. Keep this invoice for your records.
        </footer>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`grid grid-cols-2 ${bold ? "font-semibold text-base" : ""}`}>
      <div>{label}</div>
      <div className="text-right">{value}</div>
    </div>
  );
}
