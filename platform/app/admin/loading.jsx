// Admin route loading fallback shown while the dashboard's async data loads.
export default function AdminLoading() {
  return (
    <main className="admin-login">
      <section className="admin-login__panel">
        <p className="admin-loading__text">Loading…</p>
      </section>
    </main>
  );
}
