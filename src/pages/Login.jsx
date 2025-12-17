// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/authStore.js";

export default function Login() {
  const users = useAuth((s) => s.users);
  const login = useAuth((s) => s.login);
  const loginWithPin = useAuth((s) => s.loginWithPin);
  const lastError = useAuth((s) => s.lastError);
  const user = useAuth((s) => s.user);

  const [userId, setUserId] = useState(users[0]?.id || "");
  const [pin, setPin] = useState("");
  const nav = useNavigate();

  const onSubmit = (e) => {
    e.preventDefault();
    if (userId) login(userId, pin);
    else loginWithPin(pin);
  };

  if (user) {
    // already logged in
    return (
      <div className="max-w-md mx-auto mt-10 bg-white border rounded-xl p-4">
        <div className="text-lg">Hi, <strong>{user.name}</strong> ({user.role})</div>
        <div className="mt-3">
          <button className="px-4 py-2 rounded-xl bg-black text-white" onClick={() => nav("/")}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-white border rounded-xl p-4">
      <h1 className="text-2xl font-semibold mb-2">Login</h1>
      <p className="text-sm opacity-70 mb-4">Choose a user and enter PIN.</p>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">User</label>
          <select className="w-full border rounded-lg px-3 py-2" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">PIN</label>
          <input className="w-full border rounded-lg px-3 py-2" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="e.g., 1234" />
        </div>
        {lastError && <div className="text-sm text-red-600">{lastError}</div>}
        <div className="pt-2">
          <button className="px-4 py-2 rounded-xl bg-black text-white w-full">Login</button>
        </div>
      </form>
    </div>
  );
}
