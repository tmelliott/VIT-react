import { useRserve, type AppType } from "@tmelliott/react-rserve";
import vitAppSchema from "@/lib/vit.rserve";
import { VitSessionPanel } from "@/components/VitSessionPanel";

const schema = vitAppSchema;

const rhost =
  typeof import.meta !== "undefined" && import.meta.env
    ? String(
        (import.meta.env as { VITE_RSERVE?: string }).VITE_RSERVE ||
          "http://localhost:6311",
      )
    : "http://localhost:6311";

type AppT = AppType<typeof schema>;

function VitShell() {
  const s = useRserve(schema, { host: rhost });
  if (s.error) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4 text-amber-900/90"
        style={{
          background:
            "linear-gradient(165deg, #0f1419 0%, #1a2332 45%, #111823 100%)",
        }}
      >
        <p className="max-w-md text-center text-sm text-slate-100">
          Cannot reach Rserve at <code className="text-amber-200">{rhost}</code>{" "}
          — start the server with: <br />
          <code className="text-xs text-slate-200">
            Rscript server/vit.rserve.R
          </code>{" "}
          from the
          <code> VIT-react/server</code> directory, then refresh.
          <br />
          <span className="text-red-200">Error: {String(s.error)}</span>
        </p>
      </div>
    );
  }
  if (s.loading || !s.app) {
    return (
      <div
        className="flex min-h-screen items-center justify-center p-4 text-slate-100"
        style={{
          background: "linear-gradient(165deg, #0f1419 0%, #1a2332 100%)",
        }}
      >
        <p
          className="text-sm font-light tracking-tight"
          style={{ textShadow: "0 0 1px #0006" }}
        >
          Connecting to Rserve…
        </p>
      </div>
    );
  }
  return (
    <div
      className="min-h-screen w-full p-0 text-slate-900"
      style={{
        background:
          "linear-gradient(195deg, #e8e6e0 0%, #f0ede6 30%, #faf6ef 100%)",
      }}
    >
      <header className="border-b border-amber-900/10 bg-white/20 px-4 py-2 backdrop-blur">
        <h1 className="text-left text-sm font-bold tracking-tight text-slate-800">
          VIT (React + R) —{" "}
          <span className="font-light text-amber-900/90">
            sampling &amp; bootstrap
          </span>
        </h1>
        <p className="text-[0.7rem] text-slate-500/90">
          Phase 1: sampling variation &amp; bootstrap
        </p>
      </header>
      <main className="mx-auto max-w-6xl p-0">
        <VitSessionPanel app={s.app as AppT} />
      </main>
    </div>
  );
}

export function App() {
  return <VitShell />;
}
