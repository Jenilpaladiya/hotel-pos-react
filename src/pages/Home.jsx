// src/pages/Home.jsx
export default function Home() {
  return (
    <div className="bg-white border rounded-xl p-4">
      <h1 className="text-2xl font-semibold">Hotel POS</h1>
      <p className="opacity-70 mt-1">Welcome! Use the navigation to explore the app.</p>
      <ul className="list-disc ml-5 mt-3 space-y-1 text-sm">
        <li><strong>POS</strong>: create orders, send to kitchen, pay/print</li>
        <li><strong>Kitchen</strong>: view & complete tickets</li>
        <li><strong>Admin</strong>: manage catalog & options</li>
        <li><strong>Reports</strong> / <strong>Reports Pro</strong>: analytics & CSV export</li>
        <li><strong>Backup</strong>: export/import all data</li>
      </ul>
    </div>
  );
}
