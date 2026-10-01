import { redirect } from "next/navigation";
import DgtlWordmark from "../../components/brand/DgtlWordmark";
import { canUsePass, loadSession } from "../../lib/permissions";

export const dynamic = "force-dynamic";

// Phase 1 landing for door staff: proves the sign-in, role and routing work
// end to end. The camera scanner replaces this page in build-plan Phase 3
// (docs/specs/dgtl-pass/06-scanner.md, previews/scanner.html).
export default async function ScanPage() {
  const session = await loadSession();
  if (!session) redirect("/admin/login");
  if (!canUsePass(session, "pass.verify")) redirect("/home");

  return (
    <main className="admin-login" data-theme="dark">
      <section className="admin-login__panel">
        <span className="admin-login__brand" aria-label="DGTL">
          <DgtlWordmark />
        </span>
        <h1 className="admin-login__title">Scanner</h1>
        <p className="admin-login__note">
          Signed in as <strong>{session.user?.name || session.email}</strong> · {session.role}
          {session.team?.name ? ` · ${session.team.name}` : ""}
        </p>
        <p className="admin-login__note admin-login__note--dim">The camera scanner arrives here next. Your sign-in and door access are ready.</p>
        <form action="/api/admin/logout" method="post" className="admin-form">
          <button className="button button--secondary" type="submit">Sign out</button>
        </form>
      </section>
    </main>
  );
}
