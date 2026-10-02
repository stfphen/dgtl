import DgtlWordmark from "../../components/brand/DgtlWordmark";

// One page for every miss: unknown, malformed, rotated or another venue's
// credential all look exactly alike, so a guess learns nothing.
export const metadata = { title: "Pass not found" };

export default function PassNotFound() {
  return (
    <main className="pp pp-missing">
      <DgtlWordmark className="pp-wordmark" title="DGTL" />
      <section className="pp-state">
        <span className="pp-pill">Not found</span>
        <h1>We couldn&apos;t find this pass.</h1>
        <p>Check that the whole link was copied. If your pass was replaced, use the newest link you were sent.</p>
      </section>
    </main>
  );
}
