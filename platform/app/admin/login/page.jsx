import DgtlWordmark from "../../../components/brand/DgtlWordmark";
import { googleConfig } from "../../../lib/oauth/google";

// absolute, not a plain string: the admin layout above sets a "%s · DGTL"
// template, and "DGTL Login · DGTL" reads as a mistake. absolute opts out of it.
export const metadata = { title: { absolute: "DGTL Login" } };

// What went wrong, in words the person can act on.
const ERRORS = {
  "1": "Invalid admin credentials.",
  rate_limited: "Too many attempts. Wait a minute and try again.",
  google_no_access: "That Google account doesn't have access. Ask your manager to add your email to the team.",
  google_cancelled: "Google sign-in was cancelled.",
  google_state: "That sign-in link expired. Start again with Continue with Google.",
  google_failed: "Google sign-in didn't complete. Try again, or use your email and password.",
  google_unavailable: "Google sign-in isn't set up here yet. Use your email and password."
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const error = params?.error ? ERRORS[params.error] || ERRORS["1"] : "";
  const google = googleConfig().enabled;

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
          {google ? (
            <a className="button button--secondary" href="/api/auth/google/start">
              Continue with Google
            </a>
          ) : null}
          {error ? <p className="admin-error" role="alert">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}
