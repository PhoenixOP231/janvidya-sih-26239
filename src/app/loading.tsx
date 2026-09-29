export default function Loading() {
  return (
    <div className="loading-screen" role="status">
      <div className="skeleton skeleton-title" />
      <div className="metric-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
      <div className="skeleton skeleton-table" />
      <span className="sr-only">Loading JanVidya…</span>
    </div>
  );
}
