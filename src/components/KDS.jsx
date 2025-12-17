import { useEffect } from "react";
import { watchKitchen } from "../lib/fbWatchers";

export default function KDS() {
  useEffect(() => {
    const un = watchKitchen();
    return () => un();
  }, []);
  // ...
}
