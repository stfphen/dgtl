"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ContactRound, Import, LayoutDashboard, LogOut, Mail, Siren, Target } from "lucide-react";

const navigation = [
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/contacts", label: "Contacts", icon: ContactRound },
  { href: "/opportunities", label: "Opportunities", icon: Target },
  { href: "/imports", label: "Imports", icon: Import },
  { href: "/campaigns", label: "Campaigns", icon: Mail },
  { href: "/operations/outbox", label: "Operations", icon: Siren }
];

function initials(value) {
  return String(value || "DG")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function CoreShell({ user, children }) {
  const pathname = usePathname();
  return (
    <div className="v2-admin-shell core-shell" data-theme="dark">
      <aside className="core-sidebar">
        <Link className="core-brand" href="/companies" aria-label="DGTL Core">
          <span className="core-brand__mark">DGTL</span>
          <span className="core-brand__product">Core</span>
        </Link>
        <p className="core-nav-label">Commercial graph</p>
        <nav className="core-nav" aria-label="Core navigation">
          {navigation.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} className={`core-nav__item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={18} strokeWidth={2} aria-hidden />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="core-sidebar__spacer" />
        <Link className="core-nav__item core-nav__legacy" href="/admin">
          <LayoutDashboard size={18} strokeWidth={2} aria-hidden />
          <span>Legacy admin</span>
        </Link>
        <div className="core-user">
          <span className="core-user__avatar" aria-hidden>{initials(user?.name || user?.email)}</span>
          <span className="core-user__meta">
            <span className="core-user__name">{user?.name || user?.email || "Admin"}</span>
            <span className="core-user__role">{user?.role || "member"}</span>
          </span>
          <form action="/api/admin/logout" method="post">
            <button className="core-icon-button" type="submit" aria-label="Log out" title="Log out">
              <LogOut size={17} strokeWidth={2} aria-hidden />
            </button>
          </form>
        </div>
      </aside>
      <main className="core-main">{children}</main>
    </div>
  );
}
