// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./index.css";

import App from "./App.jsx";

// Pages
import Home from "./pages/Home.jsx";
import POS from "./pages/POS.jsx";
import KDS from "./pages/KDS.jsx";
import Admin from "./pages/Admin.jsx";
import Backup from "./pages/Backup.jsx";
import Reports from "./pages/Reports.jsx";
import Login from "./pages/Login.jsx";
import Shifts from "./pages/Shifts.jsx";
import Tables from "./pages/Tables.jsx";
import Seed from "./pages/Seed.jsx";
import DBCheck from "./debug/DBCheck.jsx";
import Clean from "./pages/Clean.jsx";

// (PWA registration if you added it)
import { registerSW } from "./pwaRegister.js";
registerSW();

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // layout (header + <Outlet />)
    children: [
      { index: true, element: <Home /> },
      { path: "pos", element: <POS /> },
      { path: "kds", element: <KDS /> },
      { path: "admin", element: <Admin /> },
      { path: "backup", element: <Backup /> },
      { path: "reports", element: <Reports /> },
      { path: "login", element: <Login /> },
      { path: "shifts", element: <Shifts /> },
      { path: "*", element: <Navigate to="/" replace /> },
      { path: "tables", element: <Tables /> },
      { path: "debug/db", element: <DBCheck /> },
      { path: "/dev/seed", element: <Seed /> },
      { path: "/dev/clean", element: <Clean /> },

    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
