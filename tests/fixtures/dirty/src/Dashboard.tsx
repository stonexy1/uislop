import { useState } from "react";

export function Dashboard({ revenue }: { revenue: number }) {
  const [query, setQuery] = useState("");
  const kpis = [{ title: "Uptime", value: "99.99%" }];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <header className="rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome back, Jane Smith 🎉</h1>
        <span className="text-2xl">📈</span>
        <span className="text-black">Last sync 2 minutes ago</span>
      </header>

      <div className="mt-8 grid grid-cols-3 gap-6">
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <h3 className="text-sm text-gray-500">Revenue</h3>
          <p className="text-3xl font-bold">$48,210</p>
          <span className="text-xs text-gray-400">vs last week</span>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <h3 className="text-sm text-gray-500">Active users</h3>
          <p className="text-3xl font-bold">8,421</p>
          <span className="text-xs text-gray-400">vs last week</span>
        </div>
        <div className="rounded-xl bg-white p-6">
          <h3 className="text-sm text-gray-500">Conversion</h3>
          <p className="text-3xl font-bold">3.2%</p>
          <span className="text-xs text-gray-400">vs last week</span>
        </div>
      </div>

      <table className="mt-8 w-full">
        <tbody>
          <tr>
            <td>$1,299</td>
            <td>98.2%</td>
            <td>1,204</td>
            <td>{revenue.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <form className="mt-8 flex gap-2" onSubmit={(e) => e.preventDefault()}>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
        <button onClick={() => {}}>Search</button>
      </form>

      <div className="mt-8 flex gap-4">
        <button onClick={() => console.log("clicked")}>Export</button>
        <button onClick={() => console.log("clicked")}>Share</button>
        <a href="#">View all</a>
        <a href="#">Settings</a>
      </div>

      <ul>
        {kpis.map((kpi) => (
          <li key={kpi.title}>{kpi.value}</li>
        ))}
      </ul>
    </div>
  );
}
