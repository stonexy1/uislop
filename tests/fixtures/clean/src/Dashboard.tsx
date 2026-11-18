import { useState } from "react";

interface Deploy {
  id: string;
  service: string;
  author: string;
  durationSeconds: number;
  status: "passed" | "failed";
}

const deploys: Deploy[] = [
  { id: "d-1042", service: "billing-api", author: "Priya Raman", durationSeconds: 184, status: "passed" },
  { id: "d-1041", service: "web", author: "Tomás Ibarra", durationSeconds: 97, status: "failed" },
];

export function Dashboard({ retry }: { retry: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-8 p-8">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 p-4 shadow-sm">
          <dt className="text-sm text-zinc-600">Deploys this week</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">38</dd>
        </div>
        <div className="col-span-3 rounded-lg border border-zinc-200 p-4">
          <dt className="text-sm text-zinc-600">Median build time</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">2m 41s</dd>
          <p className="mt-2 text-sm text-zinc-600">Down from 3m 05s after the cache change on March 4.</p>
        </div>
      </dl>

      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th>Service</th>
            <th>Author</th>
            <th className="tabular-nums">Duration (s)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {deploys.map((deploy) => (
            <tr key={deploy.id} className={selected === deploy.id ? "bg-zinc-100" : undefined}>
              <td>{deploy.service}</td>
              <td>{deploy.author}</td>
              <td className="tabular-nums">{deploy.durationSeconds}</td>
              <td>
                {deploy.status === "failed" ? (
                  <button type="button" onClick={() => retry(deploy.id)} className="text-red-700 underline">
                    Retry
                  </button>
                ) : (
                  "Passed"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">What changed</h2>
        <dl className="mt-4 space-y-3">
          <dt className="font-medium text-zinc-900">Rollback previews</dt>
          <dd className="text-zinc-600">See the diff a rollback will apply before you confirm it.</dd>
          <dt className="font-medium text-zinc-900">Quieter alerts</dt>
          <dd className="text-zinc-600">Flaky health checks retry twice before paging anyone.</dd>
        </dl>
        <button type="button" onClick={() => setSelected(null)} className="mt-4 text-sm text-zinc-600 underline">
          Clear selection
        </button>
      </section>
    </div>
  );
}
