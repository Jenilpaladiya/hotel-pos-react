// src/components/OptionPickerModal.jsx
import { useMemo, useState } from "react";

export default function OptionPickerModal({ item, onCancel, onConfirm }) {
  // selection: { [groupId]: Set<optionId> }
  const [sel, setSel] = useState(() => {
    const init = {};
    for (const g of item.optionGroups || []) {
      init[g.id] = new Set();
      // preselect first for required single groups
      if (g.type === "single" && g.required && g.options?.[0]) {
        init[g.id].add(g.options[0].id);
      }
    }
    return init;
  });

  const toggle = (group, opt) => {
    setSel((cur) => {
      const next = { ...cur };
      const set = new Set(next[group.id] || []);
      if (group.type === "single") {
        set.clear();
        set.add(opt.id);
      } else {
        if (set.has(opt.id)) set.delete(opt.id);
        else {
          if (group.max && set.size >= group.max) return cur; // respect max
          set.add(opt.id);
        }
      }
      next[group.id] = set;
      return next;
    });
  };

  const isValid = useMemo(() => {
    for (const g of item.optionGroups || []) {
      const set = sel[g.id] || new Set();
      const count = set.size;
      const min = g.min != null ? g.min : (g.required ? 1 : 0);
      const max = g.max || (g.type === "single" ? 1 : undefined);
      if (g.required && count < min) return false;
      if (max && count > max) return false;
      if (g.type === "single" && count > 1) return false;
    }
    return true;
  }, [sel, item.optionGroups]);

  const mods = useMemo(() => {
    const out = [];
    for (const g of item.optionGroups || []) {
      const set = sel[g.id] || new Set();
      for (const id of set) {
        const opt = g.options.find((o) => o.id === id);
        if (!opt) continue;
        out.push({ name: `${g.label}: ${opt.name}`, priceDelta: Number(opt.priceDelta || 0) });
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name)); // stable merge key order
    return out;
  }, [sel, item.optionGroups]);

  const totalDelta = mods.reduce((s, m) => s + (m.priceDelta || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl w-[560px] max-w-[92vw] p-4">
        <h3 className="text-xl font-semibold mb-1">{item.name}</h3>
        <p className="text-sm opacity-70 mb-3">Choose options</p>

        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          {(item.optionGroups || []).map((g) => {
            const set = sel[g.id] || new Set();
            const count = set.size;
            const min = g.min != null ? g.min : (g.required ? 1 : 0);
            const max = g.max || (g.type === "single" ? 1 : undefined);
            const remaining = max && g.type !== "single" ? max - count : null;

            return (
              <div key={g.id} className="border rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {g.label}
                    {g.required && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-900">
                        required{min > 1 ? ` (${min})` : ""}
                      </span>
                    )}
                    {max && g.type !== "single" && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100">max {max}</span>
                    )}
                  </div>
                  {remaining != null && (
                    <div className="text-xs opacity-60">{remaining} left</div>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {g.options.map((o) => {
                    const checked = set.has(o.id);
                    const price = Number(o.priceDelta || 0);
                    const label = `${o.name}${price ? ` (+${price.toFixed(2)})` : ""}`;
                    return (
                      <label key={o.id} className={`border rounded px-2 py-1 flex items-center gap-2 ${checked ? "bg-gray-900 text-white" : ""}`}>
                        <input
                          type={g.type === "single" ? "radio" : "checkbox"}
                          className="accent-black"
                          name={g.id}
                          checked={checked}
                          onChange={() => toggle(g, o)}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    );
                  })}
                </div>

                {g.required && (sel[g.id]?.size || 0) < min && (
                  <div className="text-xs text-red-600 mt-1">
                    Select at least {min} option{min > 1 ? "s" : ""}.
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm opacity-70">
            Price delta: <strong>{totalDelta > 0 ? `+${totalDelta.toFixed(2)}` : totalDelta.toFixed(2)}</strong>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl border" onClick={onCancel}>Cancel</button>
            <button
              className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-50"
              disabled={!isValid}
              onClick={() => onConfirm(mods)}
            >
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
