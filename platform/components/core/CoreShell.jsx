"use client";

import Link from "next/link";
import CommandPalette from "./CommandPalette";
import { usePathname } from "next/navigation";
import { Building2, ContactRound, Home, Import, LayoutDashboard, ListChecks, LogOut, Mail, MessageCircle, PackageOpen, ReceiptText, Siren, Sparkles, Target } from "lucide-react";
import DgtlWordmark from "../brand/DgtlWordmark";

// Grouped navigation. Groups render as label rows inside ONE .core-nav grid so
// the mobile bottom bar stays a single horizontal strip (labels hide <=820px).
const navigation = [
  { label: "", items: [
    { href: "/home", label: "Home", icon: Home, mobile: true },
    { href: "/chat", label: "DGTL.chat", icon: MessageCircle, mobile: true },
  ] },
  {
    label: "Grow",
    items: [
      { href: "/companies", label: "Companies", icon: Building2, mobile: true },
      { href: "/contacts", label: "Contacts", icon: ContactRound, mobile: false },
      { href: "/opportunities", label: "Opportunities", icon: Target, mobile: true },
      { href: "/imports", label: "Imports", icon: Import, mobile: false },
      { href: "/campaigns", label: "Campaigns", icon: Mail, mobile: true },
    ],
  },
  {
    label: "Create",
    items: [
      { href: "/generation-jobs", label: "Generation", icon: Sparkles, mobile: false },
      { href: "/artifacts", label: "Artifacts", icon: PackageOpen, mobile: false },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/operations/worklog", label: "Worklog", icon: ListChecks, mobile: true },
      { href: "/operations/outbox", label: "Operations", icon: Siren, mobile: true },
      { href: "/invoices", label: "Invoices", icon: ReceiptText, mobile: false },
    ],
  },
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
  const renderItem = ({ href, label, icon: Icon, mobile }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);
    return (
      <Link key={href} href={href} className={`core-nav__item${active ? " is-active" : ""}${mobile ? "" : " is-desktop-only"}`} aria-current={active ? "page" : undefined}>
        <Icon size={18} strokeWidth={2} aria-hidden />
        <span>{label}</span>
      </Link>
    );
  };
  return (
    <div className="v2-admin-shell core-shell" data-theme="dark">
      <aside className="core-sidebar">
        <Link className="core-brand" href="/home" aria-label="DGTL Home">
          <DgtlWordmark className="core-brand__logo" />
          <span className="core-brand__product">Core</span>
        </Link>
        {/* Mounted in the shell, not on one page: the palette carries its own
            window keydown listener, so this is what makes Cmd/Ctrl+K work on
            every Core route rather than only on HOME. */}
        <CommandPalette />
        <nav className="core-nav" aria-label="Core navigation">
          {navigation.map((group) => (
            <div className="core-nav__group" key={group.label || "home"}>
              {group.label ? <p className="core-nav-label">{group.label}</p> : null}
              {group.items.map(renderItem)}
            </div>
          ))}
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
