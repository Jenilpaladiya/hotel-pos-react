# Hotel POS Lite — React + Zustand + Dexie + Tailwind

Offline-first restaurant POS with table tickets, a Kitchen Display System (KDS), live “Not sent / In kitchen / Served” counters, printable receipts, and basic reporting. Built with **React**, **Zustand**, **Dexie (IndexedDB)**, **Tailwind**, and Vite. Optional hooks for Firebase.

![POS Screenshot](docs/pos-screen.png)
![KDS Screenshot](docs/kds-screen.png)

---

## ✨ Features

- **Tables & Tickets**
  - Create/update tickets per table, merge/transfer between tables
  - Save guest name, park/load cart to ticket
- **Cart & Orders**
  - Modifiers/options per item, discounts, service charge, tip (incl. tax math)
  - Checkout with cash/card; auto-print receipt (print stylesheet included)
- **Kitchen Display System (KDS)**
  - Send only **deltas** to kitchen (prevents double-send)
  - Toggle item status: `pending ↔ done`, “All done”, priority bumping
  - **Live counters** on POS: _Not sent_, _In kitchen_, _Served_
- **Persistence & Offline**
  - Dexie/IndexedDB for catalog, tables, tickets, kitchen queue, orders
  - Zustand store persistence for lightweight UI state
- **Reporting (basic)**
  - Sales by item/category, totals in time range
- **Nice DX**
  - Tailwind component classes, clean layout, responsive grid
  - Small, readable store with pure helper functions

---

## 🛠️ Tech Stack

- **Frontend:** React (Vite), React Router
- **State:** Zustand (persist middleware)
- **Storage:** Dexie (IndexedDB)
- **Styling:** Tailwind CSS (+ @tailwindcss/forms)
- **Optional backend hooks:** Firebase (upsertProduct, addOrder, etc. — no hard requirement)

---

## 📦 Project Structure

