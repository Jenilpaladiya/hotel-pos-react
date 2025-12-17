// src/components/OptionGroupsEditor.jsx
import { useState } from "react";

export default function OptionGroupsEditor({ value = [], onChange }) {
  const [groups, setGroups] = useState(() => JSON.parse(JSON.stringify(value || [])));

  const commit = (next) => {
    setGroups(next);
    onChange?.(next);
  };

  const addGroup = () => {
    commit([
      ...groups,
      {
        id: "g" + Math.random().toString(16).slice(2, 8),
        label: "New Group",
        type: "single", // "single" | "multi"
        required: false,
        min: 0,
        max: 1,
        options: [{ id: "o" + Math.random().toString(16).slice(2, 8), name: "Option", priceDelta: 0 }],
      },
    ]);
  };

  const addOption = (gi) => {
    const next = groups.map((g, i) =>
      i === gi
        ? { ...g, options: [...g.options, { id: "o" + Math.random().toString(16).slice(2, 8), name: "Option", priceDelta: 0 }] }
        : g
    );
    commit(next);
  };

  const delGroup = (gi) => commit(groups.filter((_, i) => i !== gi));
  const delOption = (gi, oi) => {
    const next = groups.map((g, i) =>
      i === gi ? { ...g, options: g.options.filter((_, j) => j !== oi) } : g
    );
    commit(next);
  };

  const patchGroup = (gi, p) => {
    const next = groups.map((g, i) => (i === gi ? { ...g, ...p } : g));
    commit(next);
  };

  const patchOption = (gi, oi, p) => {
    const next = groups.map((g, i) =>
      i === gi
        ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...p } : o)) }
        : g
    );
    commit(next);
  };

  return (
    <div className="space-y-3">
      {groups.map((g, gi) => (
        <div key={g.id} className="border rounded-lg p-2">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs opacity-70">Label</label>
              <input className="border rounded px-2 py-1" value={g.label} onChange={(e) => patchGroup(gi, { label: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs opacity-70">Type</label>
              <select className="border rounded px-2 py-1" value={g.type} onChange={(e) => patchGroup(gi, { type: e.target.value })}>
                <option value="single">Single</option>
                <option value="multi">Multi</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs opacity-70">Required</label>
              <input type="checkbox" checked={g.required} onChange={(e) => patchGroup(gi, { required: e.target.checked })} />
            </div>
            <div>
              <label className="block text-xs opacity-70">Min</label>
              <input type="number" className="border rounded px-2 py-1 w-20" value={g.min ?? 0} onChange={(e) => patchGroup(gi, { min: Number(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="block text-xs opacity-70">Max</label>
              <input type="number" className="border rounded px-2 py-1 w-20" value={g.max ?? (g.type === "single" ? 1 : 0)} onChange={(e) => patchGroup(gi, { max: Number(e.target.value) || 0 })} />
            </div>
            <button className="ml-auto px-3 py-1 border rounded text-red-600" onClick={() => delGroup(gi)}>Delete Group</button>
          </div>

          <div className="mt-2">
            <div className="text-sm font-medium mb-1">Options</div>
            {g.options.map((o, oi) => (
              <div key={o.id} className="flex flex-wrap items-end gap-2 mb-2">
                <input className="border rounded px-2 py-1" value={o.name} onChange={(e) => patchOption(gi, oi, { name: e.target.value })} />
                <div>
                  <label className="block text-xs opacity-70">Price Δ</label>
                  <input type="number" step="0.01" className="border rounded px-2 py-1 w-28" value={o.priceDelta} onChange={(e) => patchOption(gi, oi, { priceDelta: Number(e.target.value) || 0 })} />
                </div>
                <button className="px-3 py-1 border rounded text-red-600" onClick={() => delOption(gi, oi)}>Delete</button>
              </div>
            ))}
            <button className="px-3 py-1 border rounded" onClick={() => addOption(gi)}>Add Option</button>
          </div>
        </div>
      ))}

      <div className="pt-1">
        <button className="px-3 py-1 border rounded" onClick={addGroup}>Add Group</button>
      </div>
    </div>
  );
}
