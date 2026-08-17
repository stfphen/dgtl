import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Inbox } from "lucide-react";
import { statusTone } from "../../lib/core/statusTone";

export function PageHeader({ eyebrow = "DGTL Core", title, description, backHref, backLabel = "Back" }) {
  return (
    <header className="core-page-header">
      {backHref ? (
        <Link className="core-back" href={backHref}><ArrowLeft size={15} aria-hidden /> {backLabel}</Link>
      ) : null}
      <p className="core-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description ? <p className="core-page-header__description">{description}</p> : null}
    </header>
  );
}
export function Section({ title, description, count, children, className = "" }) {
  return (
    <section className={`core-card ${className}`.trim()}>
      <header className="core-card__header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {count !== undefined ? <span className="core-count">{count}</span> : null}
      </header>
      <div className="core-card__body">{children}</div>
    </section>
  );
}

export function EmptyState({ children = "Nothing recorded yet.", hint }) {
  return (
    <div className="core-empty">
      <span className="core-empty__icon" aria-hidden><Inbox size={20} strokeWidth={1.75} /></span>
      <p>{children}</p>
      {hint ? <small>{hint}</small> : null}
    </div>
  );
}

// Tone comes from the value itself so a failure reads red and a healthy state
// reads green. Gold is not a status colour — see lib/core/statusTone.js.
export function Status({ value }) {
  return <span className={`core-status is-${statusTone(value)}`}>{String(value || "unknown").replaceAll("_", " ")}</span>;
}

export function DefinitionGrid({ items }) {
  return (
    <dl className="core-definition-grid">
      {items.filter((item) => item.value !== undefined).map((item) => (
        <div key={item.label} className={item.wide ? "is-wide" : ""}>
          <dt>{item.label}</dt>
          <dd>{item.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RecordLink({ href, title, meta, status }) {
  return (
    <Link className="core-record-link" href={href}>
      <span>
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
      <span className="core-record-link__right">
        {status ? <Status value={status} /> : null}
        <ArrowUpRight size={16} aria-hidden />
      </span>
    </Link>
  );
}

export function DateText({ value, includeTime = false }) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-CA", includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" }).format(date);
}

export function ExternalLinkList({ links = [] }) {
  if (!links.length) return <EmptyState>No external systems linked yet.</EmptyState>;
  return (
    <div className="core-stack">
      {links.map((link) => (
        <a className="core-record-link" key={link.id} href={link.externalUrl || "#"} target={link.externalUrl ? "_blank" : undefined} rel="noreferrer">
          <span>
            <strong>{link.externalSystem}</strong>
            <small>{link.externalObjectType} · {link.externalId}</small>
          </span>
          <Status value={link.syncState} />
        </a>
      ))}
    </div>
  );
}
