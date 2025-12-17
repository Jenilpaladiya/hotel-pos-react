// src/pages/POS.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { usePOS } from "../store/posStore.js";
import { useAuth } from "../store/authStore.js";
import Receipt from "../components/Receipt.jsx";
import OptionPickerModal from "../components/OptionPickerModal.jsx";
import Toast from "../components/Toast.jsx";

// Build the same key the store uses (itemId + normalized mods).
// Accepts either (line) OR (itemId, mods).
const keyFromLine = (arg1, modsMaybe) => {
  let itemId, mods;
  if (typeof arg1 === "object" && arg1 !== null) {
    itemId = arg1.itemId;
    mods = arg1.mods;
  } else {
    itemId = arg1;
    mods = modsMaybe;
  }
  const mk = (mods || [])
    .map((m) => `${m.gid || m.groupId || m.group || ""}:${m.id}`)
    .sort()
    .join("|");
  return `${itemId}::${mk}`;
};

export default function POS() {
  // ---- store selectors ----
  const catalog = usePOS((s) => s.catalog);
  const cart = usePOS((s) => s.cart);
  const currency = usePOS((s) => s.currency);

  const addItem = usePOS((s) => s.addItem);
  const increment = usePOS((s) => s.increment);
  const decrement = usePOS((s) => s.decrement);
  const removeLine = usePOS((s) => s.removeLine);
  const clearCart = usePOS((s) => s.clearCart);

  const lineTotal = usePOS((s) => s.lineTotal);
  const breakdown = usePOS((s) => s.cartBreakdown)();

  const checkout = usePOS((s) => s.checkout);
  const lastOrderId = usePOS((s) => s.lastOrderId);
  const getOrder = usePOS((s) => s.getOrder);
  const clearLastOrder = usePOS((s) => s.clearLastOrder);

  // tables/tickets (POS cannot choose table; it’s fixed)
  const tables = usePOS((s) => s.tables);
  const activeTableId = usePOS((s) => s.activeTableId);
  const setActiveTable = usePOS((s) => s.setActiveTable); // used only for deep-link sync
  const loadTableToCart = usePOS((s) => s.loadTableToCart);
  const transferTicket = usePOS((s) => s.transferTicket);
  const getTicketByTable = usePOS((s) => s.getTicketByTable);
  const clearTableTicket = usePOS((s) => s.clearTableTicket);
  const setTicketGuestName = usePOS((s) => s.setTicketGuestName);
  const saveCartToTableReplace = usePOS((s) => s.saveCartToTableReplace);
  const startTicketForTable = usePOS((s) => s.startTicketForTable);

  // kitchen counters & send
  const getKitchenCountsForTable = usePOS((s) => s.getKitchenCountsForTable);
  
  const sendToKitchenFromCart = usePOS((s) => s.sendToKitchenFromCart);

  // adjustments
  const discount = usePOS((s) => s.discount);
  const setDiscountPercent = usePOS((s) => s.setDiscountPercent);
  const setDiscountAmount = usePOS((s) => s.setDiscountAmount);
  const clearDiscount = usePOS((s) => s.clearDiscount);

  const serviceChargePct = usePOS((s) => s.serviceChargePct);
  const setServiceChargePct = usePOS((s) => s.setServiceChargePct);

  const tip = usePOS((s) => s.tip);
  const setTipPercent = usePOS((s) => s.setTipPercent);
  const setTipAmount = usePOS((s) => s.setTipAmount);
  const clearTip = usePOS((s) => s.clearTip);

  // auth
  const user = useAuth((s) => s.user);

  // ---- local ui state ----
  const [showPay, setShowPay] = useState(false);
  const [method, setMethod] = useState("cash");
  const [tendered, setTendered] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [toast, setToast] = useState("");
  const [pickItem, setPickItem] = useState(null);
  const [params] = useSearchParams();

  const tableIdParam = params.get("tableId") || null;

  // guest name editing
  const ticket = activeTableId ? getTicketByTable(activeTableId) : null;
  const [guestNameDraft, setGuestNameDraft] = useState(ticket?.guestName || "");
  useEffect(() => {
    setGuestNameDraft(ticket?.guestName || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id, ticket?.guestName]);

  const order = lastOrderId ? getOrder(lastOrderId) : null;
  const ticketItemsCount = ticket ? ticket.items.reduce((n, l) => n + l.qty, 0) : 0;

  // hydrate/refresh guard
  const isHydrated = usePOS((s) => s.isHydrated);

  // ---------- Single bootstrap for deep-link table (no loops) ----------
  const bootRef = useRef(null);
  useEffect(() => {
    if (!isHydrated) return;
    if (!tableIdParam) return;

    if (bootRef.current === tableIdParam) {
      if (activeTableId === tableIdParam && cart.length === 0) {
        loadTableToCart(tableIdParam);
      }
      return;
    }

    bootRef.current = tableIdParam;

    if (activeTableId !== tableIdParam) {
      startTicketForTable?.(tableIdParam);
      setActiveTable?.(tableIdParam);
    }

    clearCart();
    loadTableToCart(tableIdParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, tableIdParam, activeTableId, cart.length]);

  // print receipt after checkout
  useEffect(() => {
    if (order) {
      setTimeout(() => {
        window.print();
        setTimeout(() => clearLastOrder(), 500);
      }, 100);
    }
  }, [order, clearLastOrder]);

  // ---------- Kitchen status (single source of truth) ----------
  // const kitchenCounts = useMemo(() => {
  //   const empty = { prep: {}, served: {} };
  //   if (!activeTableId || typeof getKitchenCountsForTable !== "function") return empty;
  //   return getKitchenCountsForTable(activeTableId) || empty;
  // }, [activeTableId, getKitchenCountsForTable]);

  const kitchenCounts = activeTableId
  ? getKitchenCountsForTable(activeTableId)
  : { prep: {}, served: {} };

  // header totals calculated from cart + kitchenCounts
  const totals = useMemo(() => {
    const prepMap = kitchenCounts?.prep || {};
    const servedMap = kitchenCounts?.served || {};
    let not = 0, inK = 0, serv = 0;
    for (const l of cart) {
      const k = keyFromLine(l);
      const p = prepMap[k] || 0;
      const s = servedMap[k] || 0;
      not += Math.max(0, (l.qty || 0) - p - s);
      inK += Math.max(0, p - s);
      serv += s;
    }
    return { not, inK, serv };
  }, [cart, kitchenCounts]);

  // ---- handlers ----
  const handleSaveClick = () => {
    if (!activeTableId) return;
    const name = (guestNameDraft || "").trim();
    setTicketGuestName(activeTableId, name);
    if (cart.length > 0) {
      saveCartToTableReplace(activeTableId, { guestName: name });
    }
  };

  const onMenuClick = (it) => {
    if (Array.isArray(it.optionGroups) && it.optionGroups.length > 0) {
      setPickItem(it);
    } else {
      addItem(it, 1, []);
    }
  };

  const onConfirmMods = (mods) => {
    if (!pickItem) return;
    addItem(pickItem, 1, mods);
    setPickItem(null);
  };

  const onSendToKitchen = () => {
    const res = sendToKitchenFromCart(activeTableId, { alsoParkToTable: true });
    if (!res) {
      setToast("Nothing to send.");
      setTimeout(() => setToast(""), 3000);
      return;
    }
    const { sent, tableLabel } = res;
    if (!sent || sent.length === 0) {
      setToast("Nothing new to send.");
    } else {
      const summary = sent.map((s) => `${s.qty}× ${s.name}`).join(", ");
      setToast(`${summary} sent to kitchen${activeTableId ? ` (${tableLabel})` : ""}`);
    }
    setTimeout(() => setToast(""), 3000);
  };

  const onPay = () => {
    const total = breakdown.totalGross;
    if (method === "cash") {
      const tn = Number(tendered);
      if (!tn || tn < total) return alert("Enter tendered cash ≥ total.");
      checkout({ method: "cash", tendered: tn, tableId: activeTableId || null, user });
    } else {
      checkout({ method: "card", tendered: null, tableId: activeTableId || null, user });
    }
    setShowPay(false);
    setTendered("");
    setMethod("cash");
  };

  return (
    <div className="space-y-4 app-shell">
      {/* Top bar: active table & quick links */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeTableId ? (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-gray-900 text-white">
              Table: <strong>{tables.find((t) => t.id === activeTableId)?.label}</strong>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border">
              No table selected
            </span>
          )}
          {ticket && (
            <span className="text-xs opacity-70">Saved items: {ticketItemsCount}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/tables" className="px-2 py-1 border rounded">
            Go to Tables
          </Link>
          {activeTableId && (
            <Link to="/pos" className="px-2 py-1 border rounded">
              Clear (Stay on POS)
            </Link>
          )}
        </div>
      </div>

      {/* Kitchen status summary */}
      {activeTableId && (
        <div className="text-sm px-3 py-2 rounded-lg border bg-white flex flex-wrap gap-x-4 gap-y-1">
          <span className="opacity-80">Not sent: <strong>{totals.not}</strong></span>
          <span className="opacity-80">In kitchen: <strong>{totals.inK}</strong></span>
          <span className="opacity-80">Served: <strong>{totals.serv}</strong></span>
        </div>
      )}

      {/* Table toolbar (table is READ-ONLY here) */}
      <section className="bg-white border rounded-xl p-3">
        <Toolbar
          tables={tables}
          activeTableId={activeTableId}
          cart={cart}
          loadTableToCart={loadTableToCart}
          transferTo={transferTo}
          setTransferTo={setTransferTo}
          transferTicket={transferTicket}
          ticket={ticket}
          ticketItemsCount={ticketItemsCount}
          clearTableTicket={clearTableTicket}
          guestNameDraft={guestNameDraft}
          setGuestNameDraft={setGuestNameDraft}
          onSaveClick={handleSaveClick}
        />
      </section>

      {/* Main grid */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Menu */}
        <section className="lg:col-span-2">
          <h1 className="text-2xl font-semibold mb-2">Menu</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {catalog.map((it) => (
              <button
                key={it.id}
                onClick={() => onMenuClick(it)}
                className="border rounded-xl p-3 bg-white text-left hover:shadow"
              >
                <div className="font-medium">{it.name}</div>
                <div className="text-sm opacity-70">
                  {currency} {Number(it.price).toFixed(2)}
                </div>
                <div className="text-xs opacity-50">{it.category}</div>
                {it.optionGroups?.length ? (
                  <div className="mt-1 text-[11px] opacity-70">Options available</div>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        {/* Cart + Adjustments */}
        <CartPanel
          cart={cart}
          catalog={catalog}
          currency={currency}
          lineTotal={lineTotal}
          increment={increment}
          decrement={decrement}
          removeLine={removeLine}
          breakdown={breakdown}
          discount={discount}
          setDiscountPercent={setDiscountPercent}
          setDiscountAmount={setDiscountAmount}
          clearDiscount={clearDiscount}
          serviceChargePct={serviceChargePct}
          setServiceChargePct={setServiceChargePct}
          tip={tip}
          setTipPercent={setTipPercent}
          setTipAmount={setTipAmount}
          clearTip={clearTip}
          clearCart={clearCart}
          sendToKitchen={onSendToKitchen}
          setShowPay={setShowPay}
          activeTableId={activeTableId}
          tables={tables}
          toast={toast}
          // status props
          kitchenCounts={kitchenCounts}
          makeLineKey={keyFromLine}
        />
      </div>

      {/* Print-only receipt */}
      {order && (
        <div className="print-area">
          <Receipt order={order} currency={currency} />
        </div>
      )}

      {/* Pay modal */}
      {showPay && (
        <PayModal
          breakdown={breakdown}
          method={method}
          setMethod={setMethod}
          tendered={tendered}
          setTendered={setTendered}
          onCancel={() => setShowPay(false)}
          onConfirm={onPay}
          currency={currency}
          activeTableLabel={
            activeTableId ? tables.find((t) => t.id === activeTableId)?.label : ""
          }
        />
      )}

      {/* Options picker */}
      {pickItem && (
        <OptionPickerModal
          item={pickItem}
          onCancel={() => setPickItem(null)}
          onConfirm={onConfirmMods}
        />
      )}
    </div>
  );
}

/* ----------------- Subcomponents ----------------- */

function Toolbar({
  tables,
  activeTableId,
  cart,
  loadTableToCart,
  transferTo,
  setTransferTo,
  transferTicket,
  ticket,
  ticketItemsCount,
  clearTableTicket,
  guestNameDraft,
  setGuestNameDraft,
  onSaveClick,
}) {
  const activeLabel =
    activeTableId
      ? (tables.find((t) => t.id === activeTableId)?.label || activeTableId)
      : null;

  const disabledNoTable = !activeTableId;

  return (
    <>
      <div className="flex flex-wrap items-end gap-2">
        {/* Read-only Active Table */}
        <div>
          <label className="block text-sm mb-1">Active Table</label>
          <div className="px-3 py-2 min-w-[160px] rounded-lg border bg-gray-50">
            {activeLabel ? (
              <span className="font-medium">{activeLabel}</span>
            ) : (
              <span className="opacity-60">— None (Takeaway) —</span>
            )}
          </div>
          <div className="text-[11px] mt-1 opacity-70">
            Change table on <Link to="/tables" className="underline">Tables</Link> page.
          </div>
        </div>

        {/* Guest name */}
        <div>
          <label className="block text-sm mb-1">Guest name</label>
          <input
            className="border rounded-lg px-3 py-2 min-w-[200px]"
            placeholder="e.g., Alice / Family"
            value={guestNameDraft}
            onChange={(e) => setGuestNameDraft(e.target.value)}
            disabled={disabledNoTable}
          />
        </div>

        {/* Save/Update & Load/Clear */}
        <div className="flex gap-2">
          <button
            className="px-3 py-2 border rounded disabled:opacity-50"
            disabled={disabledNoTable}
            onClick={() => onSaveClick?.()}
            title={disabledNoTable ? "Pick a table from the Tables page" : ""}
          >
            {ticket ? "Update Table" : "Save to Table"}
          </button>

          <button
            className="px-3 py-2 border rounded disabled:opacity-50"
            disabled={disabledNoTable || !ticket}
            onClick={() => loadTableToCart(activeTableId)}
            title={disabledNoTable ? "Pick a table from the Tables page" : ""}
          >
            Load Ticket
          </button>

          {ticket && (
            <button
              className="px-3 py-2 border rounded"
              disabled={disabledNoTable}
              onClick={() => clearTableTicket(activeTableId)}
              title={disabledNoTable ? "Pick a table from the Tables page" : ""}
            >
              Clear Ticket
            </button>
          )}
        </div>

        {/* (Optional) Transfer/Merge */}
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="block text-sm mb-1">Transfer to</label>
            <select
              className="border rounded-lg px-3 py-2 min-w-[140px]"
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              disabled={disabledNoTable || !ticket}
              title={disabledNoTable ? "Pick a table from the Tables page" : ""}
            >
              <option value="">— Choose table —</option>
              {tables
                .filter((t) => t.id !== activeTableId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
            </select>
          </div>
          <button
            className="px-3 py-2 border rounded disabled:opacity-50"
            disabled={disabledNoTable || !transferTo || !ticket}
            onClick={() => {
              transferTicket(activeTableId, transferTo);
              setTransferTo("");
            }}
            title={disabledNoTable ? "Pick a table from the Tables page" : ""}
          >
            Transfer/Merge
          </button>
        </div>
      </div>

      {/* Status line */}
      {activeTableId && (
        <div className="mt-2 text-sm opacity-70">
          Table <strong>{activeLabel}</strong>
          {ticket?.guestName ? (
            <> • Guest: <strong>{ticket.guestName}</strong></>
          ) : null}
          {ticket ? (
            <> • <strong>{ticketItemsCount}</strong> items saved.</>
          ) : (
            <> • No saved ticket yet.</>
          )}
        </div>
      )}
    </>
  );
}

function CartPanel({
  cart,
  catalog,
  currency,
  lineTotal,
  increment,
  decrement,
  removeLine,
  breakdown,
  discount,
  setDiscountPercent,
  setDiscountAmount,
  clearDiscount,
  serviceChargePct,
  setServiceChargePct,
  tip,
  setTipPercent,
  setTipAmount,
  clearTip,
  clearCart,
  sendToKitchen,
  setShowPay,
  activeTableId,
  tables,
  toast,
  kitchenCounts,
  makeLineKey,
}) {
  return (
    <section className="lg:col-span-1">
      <h2 className="text-2xl font-semibold mb-2">Cart</h2>
      <div className="bg-white p-3 border rounded-xl">
        {cart.length === 0 && <div className="opacity-60">No items</div>}

        {cart.map((l) => {
          const item = catalog.find((it) => it.id === l.itemId);
          if (!item) return null;

          const key = makeLineKey(l.itemId, l.mods);
          const prepQty = (kitchenCounts?.prep && kitchenCounts.prep[key]) || 0;
          const servedQty = (kitchenCounts?.served && kitchenCounts.served[key]) || 0;
          const notSent = Math.max(0, (l.qty || 0) - prepQty - servedQty);
          const inKitchen = Math.max(0, prepQty - servedQty);
          const served = servedQty;

          return (
            <div key={l.id} className="py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  {l.mods?.length ? (
                    <div className="text-xs opacity-70">
                      {l.mods.map((m) => m.name).join(", ")}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-2 py-1 border rounded" onClick={() => decrement(l.id)}>
                    −
                  </button>
                  <span>{l.qty}</span>
                  <button className="px-2 py-1 border rounded" onClick={() => increment(l.id)}>
                    +
                  </button>
                </div>
                <div className="w-24 text-right">
                  {currency} {lineTotal(l).toFixed(2)}
                </div>
                <button className="text-xs underline" onClick={() => removeLine(l.id)}>
                  remove
                </button>
              </div>

              {/* per-line status badges */}
              <div className="text-[11px] opacity-70 flex gap-2 mt-1">
                 {(() => {
    const key = makeLineKey(l.itemId, l.mods);
    const prepQty = (kitchenCounts?.prep?.[key] || 0);
    const servedQty = (kitchenCounts?.served?.[key] || 0);

    const notSent = Math.max(0, (l.qty || 0) - prepQty - servedQty);
    const inKitchen = Math.max(0, prepQty - servedQty);
    const served = servedQty;

    return (
      <>
        <span className={`px-1.5 py-0.5 rounded ${notSent ? "bg-yellow-100" : "bg-gray-100"}`}>
          Not sent: {notSent}
        </span>
        <span className={`px-1.5 py-0.5 rounded ${inKitchen ? "bg-blue-100" : "bg-gray-100"}`}>
          In kitchen: {inKitchen}
        </span>
        <span className={`px-1.5 py-0.5 rounded ${served ? "bg-green-100" : "bg-gray-100"}`}>
          Served: {served}
        </span>
      </>
    );
  })()}
              </div>
            </div>
          );
        })}

        {/* Adjustments */}
        <div className="mt-3 border rounded-lg p-2 bg-gray-50">
          <div className="font-medium mb-2">Adjustments</div>

          {/* Discount */}
          <div className="flex items-end gap-2 mb-2">
            <label className="text-sm w-24">Discount</label>
            <select
              className="border rounded px-2 py-1"
              value={discount.type}
              onChange={(e) => {
                const t = e.target.value;
                if (t === "percent") setDiscountPercent(discount.value || 10);
                else if (t === "amount") setDiscountAmount(discount.value || 1);
                else clearDiscount();
              }}
            >
              <option value="none">None</option>
              <option value="percent">% Percent</option>
              <option value="amount">€ Amount</option>
            </select>
            {discount.type === "percent" && (
              <input
                type="number"
                className="border rounded px-2 py-1 w-24"
                value={discount.value}
                onChange={(e) => setDiscountPercent(e.target.value)}
                placeholder="10"
              />
            )}
            {discount.type === "amount" && (
              <input
                type="number"
                className="border rounded px-2 py-1 w-24"
                value={discount.value}
                onChange={(e) => setDiscountAmount(e.target.value)}
                placeholder="2.00"
                step="0.01"
              />
            )}
            {breakdown.discountGross > 0 && (
              <div className="ml-auto text-sm">− {currency} {breakdown.discountGross.toFixed(2)}</div>
            )}
          </div>

          {/* Service charge */}
          <div className="flex items-end gap-2 mb-2">
            <label className="text-sm w-24">Service</label>
            <input
              type="number"
              className="border rounded px-2 py-1 w-24"
              value={serviceChargePct}
              onChange={(e) => setServiceChargePct(e.target.value)}
              placeholder="10"
            />
            <span className="text-sm">%</span>
            {breakdown.serviceChargeGross > 0 && (
              <div className="ml-auto text-sm">+ {currency} {breakdown.serviceChargeGross.toFixed(2)}</div>
            )}
          </div>

          {/* Tip */}
          <div className="flex items-end gap-2">
            <label className="text-sm w-24">Tip</label>
            <select
              className="border rounded px-2 py-1"
              value={tip.type}
              onChange={(e) => {
                const t = e.target.value;
                if (t === "percent") setTipPercent(tip.value || 10);
                else if (t === "amount") setTipAmount(tip.value || 1);
                else clearTip();
              }}
            >
              <option value="none">None</option>
              <option value="percent">% Percent</option>
              <option value="amount">€ Amount</option>
            </select>
            {tip.type === "percent" && (
              <input
                type="number"
                className="border rounded px-2 py-1 w-24"
                value={tip.value}
                onChange={(e) => setTipPercent(e.target.value)}
                placeholder="10"
              />
            )}
            {tip.type === "amount" && (
              <input
                type="number"
                className="border rounded px-2 py-1 w-24"
                value={tip.value}
                onChange={(e) => setTipAmount(e.target.value)}
                placeholder="2.00"
                step="0.01"
              />
            )}
            {breakdown.tipGross > 0 && (
              <div className="ml-auto text-sm">+ {currency} {breakdown.tipGross.toFixed(2)}</div>
            )}
          </div>
        </div>

        <hr className="my-2" />

        {/* Totals */}
        <Row label="Items" value={`${currency} ${breakdown.itemsGross.toFixed(2)}`} />
        {breakdown.discountGross > 0 && (
          <Row label="Discount" value={`− ${currency} ${breakdown.discountGross.toFixed(2)}`} />
        )}
        {breakdown.serviceChargeGross > 0 && (
          <Row label="Service" value={`+ ${currency} ${breakdown.serviceChargeGross.toFixed(2)}`} />
        )}
        <Row label="Subtotal" value={`${currency} ${breakdown.subtotalGross.toFixed(2)}`} />
        {breakdown.tax > 0 && <Row label="Tax (incl.)" value={`${currency} ${breakdown.tax.toFixed(2)}`} />}
        {breakdown.tipGross > 0 && <Row label="Tip" value={`+ ${currency} ${breakdown.tipGross.toFixed(2)}`} />}
        <Row label="Total" value={`${currency} ${breakdown.totalGross.toFixed(2)}`} bold />

        <div className="mt-3 flex flex-wrap gap-2">
          <button className="px-4 py-2 rounded-xl border" onClick={clearCart}>
            Clear
          </button>
          <button
            className="px-4 py-2 rounded-xl border disabled:opacity-50"
            disabled={cart.length === 0}
            onClick={sendToKitchen}
          >
            Send to Kitchen
          </button>
          <button
            className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
            disabled={cart.length === 0}
            onClick={() => setShowPay(true)}
          >
            Pay / Print {activeTableId ? `(${tables.find((t) => t.id === activeTableId)?.label})` : ""}
          </button>
        </div>

        {toast && (
          <Toast message={toast} variant="success" onClose={() => setToast("")} />
        )}
      </div>
    </section>
  );
}

function PayModal({
  breakdown,
  method,
  setMethod,
  tendered,
  setTendered,
  onCancel,
  onConfirm,
  currency,
  activeTableLabel,
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-4 w-[420px] max-w-[92vw]">
        <h3 className="text-xl font-semibold mb-2">Payment</h3>
        <div className="mb-2">
          Total: <strong>{currency} {breakdown.totalGross.toFixed(2)}</strong>
          {activeTableLabel && <span className="ml-2 opacity-70">({activeTableLabel})</span>}
        </div>
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setMethod("cash")}
            className={`px-3 py-2 border rounded ${method === "cash" ? "bg-gray-900 text-white" : ""}`}
          >
            Cash
          </button>
          <button
            onClick={() => setMethod("card")}
            className={`px-3 py-2 border rounded ${method === "card" ? "bg-gray-900 text-white" : ""}`}
          >
            Card
          </button>
        </div>
        {method === "cash" && (
          <div className="mb-3">
            <label className="block text-sm mb-1">Tendered Amount</label>
            <input
              type="number"
              step="0.01"
              className="w-full border rounded-lg px-3 py-2"
              value={tendered}
              onChange={(e) => setTendered(e.target.value)}
              placeholder="e.g., 20.00"
            />
            {tendered && Number(tendered) >= breakdown.totalGross && (
              <div className="mt-1 text-sm">
                Change: <strong>{currency} {(Number(tendered) - breakdown.totalGross).toFixed(2)}</strong>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 rounded-xl border" onClick={onCancel}>
            Cancel
          </button>
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={onConfirm}>
            Confirm & Print
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
