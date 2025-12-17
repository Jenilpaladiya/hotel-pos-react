// src/store/settingsStore.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useSettings = create(
  persist(
    (set) => ({
      // Receipt / brand
      bizName: "Hotel POS Demo",
      address1: "123 Demo Street",
      address2: "City, Country",
      phone: "+00 000 0000",
      taxLabel: "VAT",
      taxId: "DE-000000000",
      logoUrl: "/logo.png", // put a logo file in /public/logo.png

      // Paper width: "80" or "58"
      paperWidth: "80",

      // Footer
      receiptFooter: "Thanks for visiting!",
      kitchenChitHeader: "KITCHEN ORDER",

      // Mutators (optional, for later UI)
      set: (patch) => set(patch),
    }),
    {
      name: "pos-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
