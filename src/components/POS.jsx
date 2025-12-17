import { useEffect } from "react";
import { usePOS } from "../store/posStore";
import { watchTicket } from "../lib/fbWatchers";

export default function POS() {
  const activeTableId = usePOS(s => s.activeTableId);
  useEffect(() => {
    if (!activeTableId) return;
    const un = watchTicket(activeTableId);
    return () => un();
  }, [activeTableId]);
  // ...
}
