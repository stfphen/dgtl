"use client";

import Link from "next/link";
import CommandPalette from "./CommandPalette";
import { usePathname } from "next/navigation";
import { Building2, ContactRound, Home, Import, LayoutDashboard, ListChecks, LogOut, Mail, MessageCircle, PackageOpen, Siren, Sparkles, Target } from "lucide-react";

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
          {/* The DGTL wordmark, same art as the admin shell and login screen —
              a text lockup was the one place the OS didn't carry the mark. */}
          <svg viewBox="73 148 987 453" aria-hidden="true">
            <path d="M221.797 286.332H138.578L93.3214 455.354H176.532C211.656 455.354 243.005 442.391 265.166 421.412C287.089 400.433 299.108 371.906 299.108 344.568C299.108 309.674 275.537 286.332 221.797 286.332ZM242.3 394.296C228.861 409.852 207.176 418.105 183.842 418.105H143.295L168.754 322.875H209.301C242.3 322.875 257.388 332.302 257.388 353.519C257.388 368.607 251.727 383.687 242.3 394.296Z" fill="currentColor"/>
            <path d="M379.743 394.066H436.79L432.072 411.509C424.294 416.456 412.98 421.88 390.581 421.88C355.22 421.88 339.196 410.804 339.196 388.643C339.196 369.551 348.156 350.689 361.825 338.669C374.558 327.593 391.763 320.988 411.799 320.988C445.035 320.988 459.418 329.004 466.72 339.612L496.658 312.505C484.868 295.529 463.66 283.51 425.229 283.51C387.045 283.51 356.163 295.062 334.003 315.335C311.136 336.552 297.23 368.14 297.23 397.84C297.23 440.037 331.41 459.367 378.791 459.367C401.896 459.367 444.797 452.056 468.131 427.541L486.279 359.886H388.932L379.743 394.066Z" fill="currentColor"/>
            <path d="M660.921 322.875L670.824 286.332H508.882L498.979 322.875H559.8L524.438 455.354H564.747L600.109 322.875H660.921Z" fill="currentColor"/>
            <path d="M716.191 286.332H676.111L630.855 455.354H769.93L779.833 418.105H680.829L716.191 286.332Z" fill="currentColor"/>
            <path d="M1039.67 371.642V371.583C1039.67 371.515 1039.66 371.447 1039.66 371.387C1039.65 371.243 1039.65 371.098 1039.63 370.962C1039.3 363.626 1033.27 357.778 1025.85 357.778H945.286C937.661 357.778 931.473 363.958 931.473 371.591V372.178C931.473 379.803 937.652 385.991 945.286 385.991H991.486L858.641 516.6L973.771 183.638C975.717 178.019 973.805 172.009 969.461 168.448C969.376 168.363 969.308 168.269 969.223 168.176C963.757 162.617 954.832 162.549 949.272 168.006L752.513 361.476C749.529 364.408 748.144 368.344 748.331 372.22C748.331 372.246 748.331 372.28 748.331 372.305V372.892C748.331 380.517 754.511 386.705 762.144 386.705H843.451C851.075 386.705 857.264 380.525 857.264 372.892V372.305C857.264 364.68 851.084 358.492 843.451 358.492H795.797L928.625 227.891L813.461 560.93C810.97 568.138 814.796 576.001 822.004 578.5L822.556 578.696C822.573 578.704 822.599 578.704 822.616 578.713C827.801 581.135 834.151 581.135 838.469 576.001L1035.47 382.31C1038.44 379.386 1039.83 375.493 1039.67 371.642Z" fill="#F0CF50"/>
          </svg>
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
