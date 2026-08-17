import DgtlWordmark from "../../../components/brand/DgtlWordmark";
export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = params?.error;

  return (
    <main className="admin-login" data-theme="dark">
      <section className="admin-login__panel">
        <a href="https://dgtlgroup.io" className="admin-login__brand" aria-label="DGTL">
          <DgtlWordmark />
        </a>
        <h1 className="sr-only">Sign in to DGTL</h1>
        <form action="/api/admin/login" method="post" className="admin-form">
          <label>
            Email
            <input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" required />
          </label>
          <button className="button button--primary" type="submit">Sign In</button>
          {error ? <p className="admin-error">Invalid admin credentials.</p> : null}
        </form>
      </section>
    </main>
  );
}
