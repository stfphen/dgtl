"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Users,
  Landmark,
  Search,
  Mail,
  Phone,
  Building2,
  UsersRound,
  Briefcase,
  LogOut,
  Sun,
  Moon,
  MoreHorizontal,
  X,
} from "lucide-react";

const AdminTabsContext = createContext("pipeline");

const ICON_PROPS = { size: 24, strokeWidth: 2, "aria-hidden": true };

const navItems = [
  { id: "pipeline", label: "Pipeline", icon: <Users {...ICON_PROPS} /> },
  { id: "funding", label: "Funding", icon: <Landmark {...ICON_PROPS} /> },
  { id: "prospecting", label: "Prospecting", icon: <Search {...ICON_PROPS} /> },
  { id: "accounts", label: "Accounts", icon: <Briefcase {...ICON_PROPS} /> },
  { id: "outreach", label: "Outreach", icon: <Mail {...ICON_PROPS} /> },
  { id: "calls", label: "Calls", icon: <Phone {...ICON_PROPS} /> },
  { id: "tenants", label: "Tenants", icon: <Building2 {...ICON_PROPS} /> },
  { id: "team", label: "Team", icon: <UsersRound {...ICON_PROPS} /> },
];

// Light/dark theme for the admin shell only. Resolved after mount (so SSR markup
// matches the first client render — no hydration mismatch), persisted to
// localStorage, and defaulted from the OS preference. While unresolved the shell
// is hidden via CSS (.v2-admin-shell:not([data-theme])) to avoid a flash.
function useAdminTheme() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    let initial = null;
    try {
      initial = localStorage.getItem("admin-theme");
    } catch {
      initial = null;
    }
    if (initial !== "light" && initial !== "dark") {
      // Command-center admin is dark-first: default to dark regardless of OS
      // preference. The toggle still persists an explicit light choice.
      initial = "dark";
    }
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (!theme) return;
    try {
      localStorage.setItem("admin-theme", theme);
    } catch {
      /* ignore persistence failures (private mode, etc.) */
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return [theme, toggle];
}

function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
    </button>
  );
}

export function AdminTabbedShell({ notice, children, visibleTabs, navCounts = {}, user = null }) {
  const visibleNavItems = useMemo(() => {
    if (!visibleTabs?.length) return navItems;
    return navItems.filter((item) => visibleTabs.includes(item.id));
  }, [visibleTabs]);
  const [activeTab, setActiveTab] = useState(visibleNavItems[0]?.id || "pipeline");
  const [moreOpen, setMoreOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [theme, toggleTheme] = useAdminTheme();

  // A fresh notice (new redirect message) should re-surface even if the previous
  // one was dismissed within this mount.
  useEffect(() => {
    setNoticeDismissed(false);
  }, [notice]);
  const activeItem = useMemo(
    () => visibleNavItems.find((item) => item.id === activeTab) || visibleNavItems[0] || navItems[0],
    [activeTab, visibleNavItems]
  );

  // Mobile shows at most 5 bottom-bar slots: keep up to 4 primary tabs visible
  // and tuck the rest into a "More" sheet. Desktop renders every item in the
  // sidebar (the overflow group becomes display:contents there).
  const hasOverflow = visibleNavItems.length > 5;
  const primaryCount = hasOverflow ? 4 : visibleNavItems.length;
  const primaryItems = visibleNavItems.slice(0, primaryCount);
  const overflowItems = visibleNavItems.slice(primaryCount);
  const activeInOverflow = overflowItems.some((item) => item.id === activeTab);

  const selectTab = (id) => {
    setActiveTab(id);
    setMoreOpen(false);
  };

  // Sidebar user chip (DGTL frame). All optional — falls back gracefully when
  // the page doesn't pass a `user`.
  const userName = user?.name || user?.email || "Admin";
  const userRole = user?.role || "Owner";
  const userInitials =
    userName
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "A";

  const renderNavButton = (item) => {
    const count = navCounts?.[item.id];
    return (
      <button
        key={item.id}
        type="button"
        className={`v2-nav-item ${activeTab === item.id ? "is-active" : ""}`}
        aria-current={activeTab === item.id ? "page" : undefined}
        aria-controls={`admin-tab-${item.id}`}
        onClick={() => selectTab(item.id)}
      >
        {item.icon}
        <span>{item.label}</span>
        {count ? <span className="v2-nav-count">{count}</span> : null}
      </button>
    );
  };

  return (
    <AdminTabsContext.Provider value={activeTab}>
      <div className="v2-admin-shell" data-active-tab={activeTab} data-theme={theme || "dark"}>
        {moreOpen ? (
          <button
            type="button"
            className="v2-nav-scrim"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
          />
        ) : null}
        <nav
          className={`v2-nav-container ${moreOpen ? "is-more-open" : ""}`}
          aria-label="Admin navigation"
        >
          <a href="https://dgtlgroup.io" className="dgtl-brand desktop-only" aria-label="DGTL">
            <svg viewBox="73 148 987 453" aria-hidden="true">
              <path d="M221.797 286.332H138.578L93.3214 455.354H176.532C211.656 455.354 243.005 442.391 265.166 421.412C287.089 400.433 299.108 371.906 299.108 344.568C299.108 309.674 275.537 286.332 221.797 286.332ZM242.3 394.296C228.861 409.852 207.176 418.105 183.842 418.105H143.295L168.754 322.875H209.301C242.3 322.875 257.388 332.302 257.388 353.519C257.388 368.607 251.727 383.687 242.3 394.296Z" fill="currentColor"/>
              <path d="M379.743 394.066H436.79L432.072 411.509C424.294 416.456 412.98 421.88 390.581 421.88C355.22 421.88 339.196 410.804 339.196 388.643C339.196 369.551 348.156 350.689 361.825 338.669C374.558 327.593 391.763 320.988 411.799 320.988C445.035 320.988 459.418 329.004 466.72 339.612L496.658 312.505C484.868 295.529 463.66 283.51 425.229 283.51C387.045 283.51 356.163 295.062 334.003 315.335C311.136 336.552 297.23 368.14 297.23 397.84C297.23 440.037 331.41 459.367 378.791 459.367C401.896 459.367 444.797 452.056 468.131 427.541L486.279 359.886H388.932L379.743 394.066Z" fill="currentColor"/>
              <path d="M660.921 322.875L670.824 286.332H508.882L498.979 322.875H559.8L524.438 455.354H564.747L600.109 322.875H660.921Z" fill="currentColor"/>
              <path d="M716.191 286.332H676.111L630.855 455.354H769.93L779.833 418.105H680.829L716.191 286.332Z" fill="currentColor"/>
              <path d="M1039.67 371.642V371.583C1039.67 371.515 1039.66 371.447 1039.66 371.387C1039.65 371.243 1039.65 371.098 1039.63 370.962C1039.3 363.626 1033.27 357.778 1025.85 357.778H945.286C937.661 357.778 931.473 363.958 931.473 371.591V372.178C931.473 379.803 937.652 385.991 945.286 385.991H991.486L858.641 516.6L973.771 183.638C975.717 178.019 973.805 172.009 969.461 168.448C969.376 168.363 969.308 168.269 969.223 168.176C963.757 162.617 954.832 162.549 949.272 168.006L752.513 361.476C749.529 364.408 748.144 368.344 748.331 372.22C748.331 372.246 748.331 372.28 748.331 372.305V372.892C748.331 380.517 754.511 386.705 762.144 386.705H843.451C851.075 386.705 857.264 380.525 857.264 372.892V372.305C857.264 364.68 851.084 358.492 843.451 358.492H795.797L928.625 227.891L813.461 560.93C810.97 568.138 814.796 576.001 822.004 578.5L822.556 578.696C822.573 578.704 822.599 578.704 822.616 578.713C827.801 581.135 834.151 581.135 838.469 576.001L1035.47 382.31C1038.44 379.386 1039.83 375.493 1039.67 371.642Z" fill="#F0CF50"/>
            </svg>
          </a>
          <p className="dgtl-nav-label desktop-only">Workspace</p>
          {primaryItems.map(renderNavButton)}
          {hasOverflow ? (
            <button
              type="button"
              className={`v2-nav-item v2-nav-more ${activeInOverflow ? "is-active" : ""}`}
              aria-haspopup="true"
              aria-expanded={moreOpen}
              aria-controls="v2-nav-overflow"
              onClick={() => setMoreOpen((open) => !open)}
            >
              <MoreHorizontal {...ICON_PROPS} />
              <span>More</span>
            </button>
          ) : null}
          {hasOverflow ? (
            <div className="v2-nav-overflow" id="v2-nav-overflow">
              {overflowItems.map(renderNavButton)}
            </div>
          ) : null}
          <div className="dgtl-sidebar-foot desktop-only">
            <div className="dgtl-userchip">
              <span className="dgtl-avatar" aria-hidden="true">{userInitials}</span>
              <span className="dgtl-userchip__meta">
                <span className="dgtl-userchip__name">{userName}</span>
                <span className="dgtl-userchip__role">{userRole}</span>
              </span>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <form action="/api/admin/logout" method="post">
              <button className="dgtl-iconbtn" type="submit" aria-label="Log out" title="Log out">
                <LogOut size={18} strokeWidth={2} aria-hidden />
              </button>
            </form>
          </div>
        </nav>

        <main className="v2-dashboard-main admin-shell">
          <header className="dgtl-topbar">
            <div className="dgtl-topbar__title">
              {activeItem.label}
              <span className="dgtl-topbar__crumb"> · Admin</span>
            </div>
            <form className="dgtl-search" role="search" action="/admin" method="get">
              <Search size={16} strokeWidth={2} aria-hidden />
              <input
                type="search"
                name="q"
                placeholder="Search business, contact, city, notes"
                aria-label="Search leads"
              />
            </form>
            <div className="dgtl-topbar__actions">
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
              <form action="/api/admin/logout" method="post">
                <button className="dgtl-iconbtn" type="submit" aria-label="Log out" title="Log out">
                  <LogOut size={18} strokeWidth={2} aria-hidden />
                </button>
              </form>
            </div>
          </header>

          <div className="dgtl-content">
            <header className="admin-header v2-view-header">
              <div>
                <p className="eyebrow">Admin Dashboard</p>
                <h1>{activeItem.label}</h1>
                <p>Manage white-label funnels, prospects, leads, contractors, and outreach drafts from one place.</p>
              </div>
            </header>

            {notice && !noticeDismissed ? (
              <div className="admin-notice" role="status">
                <span className="admin-notice__text">{notice}</span>
                <button
                  type="button"
                  className="admin-notice__dismiss"
                  aria-label="Dismiss notification"
                  onClick={() => setNoticeDismissed(true)}
                >
                  <X size={18} strokeWidth={2} aria-hidden />
                </button>
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </AdminTabsContext.Provider>
  );
}

export function AdminTabPanel({ tabId, children }) {
  const activeTab = useContext(AdminTabsContext);
  const reduceMotion = useReducedMotion();
  if (activeTab !== tabId) return null;

  return (
    <motion.div
      id={`admin-tab-${tabId}`}
      className="admin-tab-panel"
      data-tab-panel={tabId}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
