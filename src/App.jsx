// src/App.jsx
import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { usePOS } from "./store/posStore.js";
import { useAuth } from "./store/authStore.js";
import InstallPWA from "./components/InstallPWA.jsx";
import { watchProducts, watchTables } from "./lib/fbWatchers.js";
import FirebaseHealthPage from "../src/pages/FirebaseHealthPage.jsx";


// ✅ Use the singleton from lib/firebase (do NOT init here)
import { auth } from "./lib/firebase.js";
import { signInAnonymously } from "firebase/auth";

export default function App() {
  const isHydrated = usePOS((s) => s.isHydrated);
  const hydrateError = usePOS((s) => s.hydrateError);
  const hydrateFromDB = usePOS((s) => s.hydrateFromDB);

  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const location = useLocation();

  // hydrate local IndexedDB store
  useEffect(() => { hydrateFromDB(); }, [hydrateFromDB]);

  // sign in (for Firestore Rules)
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
  }, []);

  // start Firestore listeners once
  useEffect(() => {
    const un1 = watchProducts();
    const un2 = watchTables();
    return () => { un1(); un2(); };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-3">
          <Link to="/" className="font-semibold">Hotel POS</Link>

          <NavLink to="/pos" currentPath={location.pathname}>POS</NavLink>
          <NavLink to="/kds" currentPath={location.pathname}>Kitchen</NavLink>
          <NavLink to="/tables" currentPath={location.pathname}>Tables</NavLink>
          <NavLink to="/admin" currentPath={location.pathname}>Admin</NavLink>
          <NavLink to="/reports" currentPath={location.pathname}>Reports</NavLink>
          <NavLink to="/backup" currentPath={location.pathname}>Backup</NavLink>
          {/* <NavLink to="/firebasehealth" currentPath={location.pathname}>Health</NavLink> */}
          {/* <NavLink to="/dev/seed" currentPath={location.pathname}>Seed</NavLink> */}


          <div className="ml-auto flex items-center gap-2">
            <InstallPWA />
            {!user ? (
              <Link to="/login" className="px-3 py-1.5 border rounded-lg">Login</Link>
            ) : (
              <>
                <span className="text-sm opacity-80">
                  Hi, <strong>{user.name}</strong> ({user.role})
                </span>
                <Link to="/shifts" className="px-3 py-1.5 border rounded-lg">Shifts</Link>
                <button onClick={logout} className="px-3 py-1.5 rounded-lg bg-black text-white">
                  Logout
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {!isHydrated ? (
        <div className="max-w-6xl mx-auto p-3">
          <div className="bg-white border rounded-xl p-4">Loading data…</div>
        </div>
      ) : (
        <>
          {hydrateError && (
            <div className="max-w-6xl mx-auto p-3">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 rounded-xl p-3">
                <div className="font-medium">Data loaded with fallback</div>
                <div className="text-sm opacity-80">Reason: {String(hydrateError)}</div>
              </div>
            </div>
          )}
          <main className="max-w-6xl mx-auto p-3">
            <Outlet />
          </main>
        </>
      )}
    </div>
  );
}

function NavLink({ to, currentPath, children }) {
  const isActive = currentPath === to || (to !== "/" && currentPath.startsWith(to));
  return (
    <Link
      to={to}
      className={`px-2 py-1.5 rounded-lg text-sm ${
        isActive ? "bg-gray-900 text-white" : "hover:bg-gray-100"
      }`}
    >
      {children}
    </Link>
  );
}
