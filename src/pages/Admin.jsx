// src/pages/Admin.jsx
import { useState } from "react";
import { usePOS } from "../store/posStore.js";
import { useAuth } from "../store/authStore.js";
import OptionGroupsEditor from "../components/OptionGroupsEditor.jsx";

export default function Admin() {
  // ✅ Role guard INSIDE the component
  const user = useAuth((s) => s.user);
  if (!user || user.role !== "admin") {
    return (
      <div className="bg-white border rounded-xl p-4">
        Admin only.
      </div>
    );
  }

  const catalog = usePOS((s) => s.catalog);
  const addItem = usePOS((s) => s.addCatalogItem);
  const update  = usePOS((s) => s.updateCatalogItem);
  const remove  = usePOS((s) => s.deleteCatalogItem);

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    name: "",
    category: "",
    price: 0,
    taxRate: 0.07,
    optionGroups: [],
  });

  const startEdit = (it) => {
    setEditingId(it.id);
    setDraft({
      name: it.name,
      category: it.category,
      price: it.price,
      taxRate: it.taxRate ?? 0.07,
      optionGroups: it.optionGroups || [],
    });
  };

  const saveEdit = () => {
    update(editingId, {
      name: draft.name,
      category: draft.category,
      price: Number(draft.price) || 0,
      taxRate: Number(draft.taxRate) || 0,
      optionGroups: draft.optionGroups || [],
    });
    setEditingId(null);
  };

  const create = () => {
    addItem({
      name: draft.name,
      category: draft.category,
      price: Number(draft.price) || 0,
      taxRate: Number(draft.taxRate) || 0,
      optionGroups: draft.optionGroups || [],
    });
    setDraft({ name: "", category: "", price: 0, taxRate: 0.07, optionGroups: [] });
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border rounded-xl p-4">
        <h1 className="text-2xl font-semibold mb-2">Catalog</h1>

        {/* New item */}
        <div className="border rounded-lg p-3 mb-4">
          <div className="font-medium mb-2">New Item</div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
            <input
              className="border rounded px-3 py-2"
              placeholder="Name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              className="border rounded px-3 py-2"
              placeholder="Price"
              value={draft.price}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
            <input
              type="number"
              step="0.01"
              className="border rounded px-3 py-2"
              placeholder="Tax Rate (0.07)"
              value={draft.taxRate}
              onChange={(e) => setDraft({ ...draft, taxRate: e.target.value })}
            />
          </div>

          <div className="mt-2">
            <div className="text-sm font-medium mb-1">Option Groups</div>
            <OptionGroupsEditor
              value={draft.optionGroups}
              onChange={(v) => setDraft({ ...draft, optionGroups: v })}
            />
          </div>

          <div className="mt-3">
            <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={create}>
              Add Item
            </button>
          </div>
        </div>

        {/* Existing items */}
        <div className="grid md:grid-cols-2 gap-3">
          {catalog.map((it) => (
            <div key={it.id} className="border rounded-xl p-3 bg-white">
              {editingId === it.id ? (
                <>
                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                    <input
                      className="border rounded px-3 py-2"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                    <input
                      className="border rounded px-3 py-2"
                      value={draft.category}
                      onChange={(e) =>
                        setDraft({ ...draft, category: e.target.value })
                      }
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="border rounded px-3 py-2"
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="border rounded px-3 py-2"
                      value={draft.taxRate}
                      onChange={(e) =>
                        setDraft({ ...draft, taxRate: e.target.value })
                      }
                    />
                  </div>

                  <div className="mt-2">
                    <div className="text-sm font-medium mb-1">Option Groups</div>
                    <OptionGroupsEditor
                      value={draft.optionGroups}
                      onChange={(v) => setDraft({ ...draft, optionGroups: v })}
                    />
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button
                      className="px-4 py-2 rounded-xl bg-black text-white"
                      onClick={saveEdit}
                    >
                      Save
                    </button>
                    <button
                      className="px-4 py-2 rounded-xl border"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium">
                    {it.name} <span className="opacity-60">({it.category})</span>
                  </div>
                  <div className="text-sm opacity-70">
                    € {Number(it.price).toFixed(2)} · tax{" "}
                    {Number(it.taxRate || 0).toFixed(2)}
                  </div>
                  {it.optionGroups?.length ? (
                    <div className="mt-1 text-xs opacity-70">
                      {it.optionGroups.length} option group(s)
                    </div>
                  ) : (
                    <div className="mt-1 text-xs opacity-50">No options</div>
                  )}

                  <div className="mt-2 flex gap-2">
                    <button
                      className="px-3 py-1 border rounded"
                      onClick={() => startEdit(it)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-3 py-1 border rounded text-red-600"
                      onClick={() => remove(it.id)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
