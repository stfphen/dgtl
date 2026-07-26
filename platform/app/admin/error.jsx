"use client";

// Admin route error boundary. The admin page fans out many async DB/store reads;
// without this, any thrown error surfaced Next's bare default 500 with no path
// back into the app.
export default function AdminError({ error, reset }) {
  return (
    <main className="admin-login">
      <section className="admin-login__panel">
        <p className="eyebrow">Admin</p>
        <h1>Something went wrong</h1>
        <p>The admin dashboard failed to load. This is usually transient.</p>
        {error?.digest ? <p style={{ opacity: 0.6, fontSize: "0.85rem" }}>Ref: {error.digest}</p> : null}
        <div className="admin-form">
          <button type="button" onClick={() => reset()}>Try again</button>
          <a href="/admin/login">Back to sign in</a>
        </div>
      </section>
    </main>
  );
}
