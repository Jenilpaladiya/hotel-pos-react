import { useEffect, useState } from "react";
import { fdb } from "../lib/firebase";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";

export default function FirebaseHealth() {
  const [ok, setOk] = useState(null); // null=checking, true=ok, false=fail

  useEffect(() => {
    const ref = doc(fdb, "health", "ping");
    const unsub = onSnapshot(ref, (snap) => setOk(snap.exists()));
    setDoc(ref, { t: serverTimestamp() }, { merge: true })
      .catch(() => setOk(false));
    return () => unsub();
  }, []);

  return (
    <span className={`inline-flex items-center gap-1 text-xs
      ${ok===true ? "text-green-700" : ok===false ? "text-red-700" : "text-gray-500"}`}>
      <span className={`w-2 h-2 rounded-full
        ${ok===true ? "bg-green-500" : ok===false ? "bg-red-500" : "bg-gray-400"}`} />
      {ok===true ? "Firestore live" : ok===false ? "Firestore error" : "Checking…"}
    </span>
  );
}
