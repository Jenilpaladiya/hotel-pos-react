// src/components/InstallPWA.jsx
import { useEffect, useState } from "react";

export default function InstallPWA() {
  const [deferred, setDeferred] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      setCanInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!canInstall) return null;

  const onInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // outcome: "accepted" | "dismissed"
    setDeferred(null);
    setCanInstall(false);
  };

  return (
    <button onClick={onInstall} className="px-3 py-1.5 border rounded-lg">
      Install App
    </button>
  );
}
