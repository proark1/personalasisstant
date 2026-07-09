import Link from "next/link";

export default function NotFound() {
  return (
    <main className="workspace">
      <div className="topbar">
        <div>
          <div className="eyebrow">OneBrain Assistant</div>
          <h1 className="page-title">Page not found</h1>
        </div>
        <Link className="text-button" data-variant="primary" href="/">
          Today
        </Link>
      </div>
      <section className="stack">
        <div className="section-header">
          <h2 className="section-title">Unavailable route</h2>
          <span className="section-meta">404</span>
        </div>
        <div className="degraded-band">
          <strong>This assistant surface is not available.</strong>
          <span>Return to the live workspace to continue.</span>
        </div>
      </section>
    </main>
  );
}
