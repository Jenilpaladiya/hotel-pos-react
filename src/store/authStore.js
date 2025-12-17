// src/store/authStore.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const USERS = [
  { id: "u-admin",  name: "Admin",   role: "admin",   pin: "1234" },
  { id: "u-cash",   name: "Cashier", role: "cashier", pin: "1111" },
  { id: "u-kitchen",name: "Chef",    role: "kitchen", pin: "2222" },
];

export const useAuth = create(
  persist(
    (set, get) => ({
      user: null,
      users: USERS,
      lastError: null,

      loginWithPin: (pin) => {
        const u = USERS.find((x) => x.pin === String(pin || "").trim());
        if (!u) return set({ lastError: "Invalid PIN" });
        set({ user: { id: u.id, name: u.name, role: u.role }, lastError: null });
      },

      login: (userId, pin) => {
        const u = USERS.find((x) => x.id === userId);
        if (!u || u.pin !== String(pin || "").trim()) return set({ lastError: "Invalid user or PIN" });
        set({ user: { id: u.id, name: u.name, role: u.role }, lastError: null });
      },

      logout: () => set({ user: null, lastError: null }),

      hasRole: (roles) => {
        const r = Array.isArray(roles) ? roles : [roles];
        const u = get().user;
        return !!u && r.includes(u.role);
      },
    }),
    { name: "hotel-pos-auth", storage: createJSONStorage(() => localStorage) }
  )
);
