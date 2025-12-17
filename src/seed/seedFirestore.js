import { collection, doc, writeBatch, getDocs } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { fdb, auth } from "../lib/firebase";
import { seedProducts, seedTables } from "./data";

/** Pushes seedProducts & seedTables into Firestore using fixed IDs */
export async function seedFirestore() {
  await signInAnonymously(auth).catch(() => {});
  const batch = writeBatch(fdb);

  const prodCol = collection(fdb, "products");
  const tabCol  = collection(fdb, "tables");

  seedProducts.forEach((p) => batch.set(doc(prodCol, p.id), p));
  seedTables.forEach((t) => batch.set(doc(tabCol, t.id), t));

  await batch.commit();

  // verify sizes
  const [pSnap, tSnap] = await Promise.all([getDocs(prodCol), getDocs(tabCol)]);
  return { products: pSnap.size, tables: tSnap.size };
}
