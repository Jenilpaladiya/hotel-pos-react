import FirebaseHealth from "../components/FirebaseHealth.jsx";

export default function FirebaseHealthPage() {
  return (
    <div className="max-w-xl mx-auto p-4 space-y-3">
      <h1 className="text-2xl font-semibold">Firebase Health</h1>
      <FirebaseHealth />
      <p className="text-sm opacity-70">
        Green = Firestore connected & realtime OK. Red = check .env/auth/rules.
      </p>
    </div>
  );
}