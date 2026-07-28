/* =========================================================================
   DGTL PROJECT NETWORK — data file
   -------------------------------------------------------------------------
   This is the ONLY file you edit to add / change projects.
   Edit by hand, save, reload the page. (Or use the in-page Admin panel,
   press "A" or the gear icon, which can export an updated copy of this file.)

   SHAPE
     groups[]        a discipline / constellation cluster
       .id           unique slug (no spaces)
       .name         cluster label shown in the galaxy
       .tagline      one short line under the cluster name
       .accent       optional hex; defaults to brand gold
       .projects[]   the sub-nodes inside this cluster
         .id         unique slug
         .name       project title
         .status     one of: working | delivered | in-progress | needs-finishing
         .blurb      1–2 sentence description
         .detail     optional longer paragraph shown in the preview
         .next       optional "what's next" line
         .stack      optional array of tech / tags
         .link       optional live URL ("" = Coming soon)
         .image      leave "" — fill the drag-and-drop slot in the preview instead
   ========================================================================= */

window.PROJECT_DATA = {
  brand: {
    title: "The DGTL Project Network",
    subtitle: "Everything we've built, mapped as one constellation.",
  },
  groups: [
    {
      id: "design-tools",
      name: "Design Tools",
      tagline: "Instruments we built to design faster.",
      projects: [
        {
          id: "floor-plan-studio",
          name: "Floor Plan Studio",
          status: "working",
          blurb: "A React + Vite + Tailwind floor-plan design tool, also shipped as a zero-install standalone HTML build.",
          detail: "Walls, grid/snap, image underlays, an icon library, layers & groups, a line tool with curves, eraser, copy/paste, and transform frames.",
          next: "Add the 3D viewport — Phase 2 hooks are already stubbed.",
          stack: ["React", "Vite", "Tailwind", "Canvas"],
          link: "",
          image: "",
        },
        {
          id: "moon-calendar",
          name: "Moon Calendar",
          status: "needs-finishing",
          blurb: "A lunar-cycle calendar UI.",
          detail: "Built on claude.ai / Claude Code. Not yet on this device — point us at the files when ready.",
          next: "Finish the UI and wire up Google Calendar integration.",
          stack: ["Calendar UI"],
          link: "",
          image: "",
        },
      ],
    },
    {
      id: "growth-pitch",
      name: "Growth & Pitch",
      tagline: "How we win and convert the room.",
      projects: [
        {
          id: "main-one-studios",
          name: "Main One Studios Pitch",
          status: "delivered",
          blurb: "A single-file, DGTL-branded HTML pitch page — creative direction + brand-growth partnership angle.",
          detail: "Shipped with a Netlify deploy zip. The three 'Malik pitch pivot' sessions all fed into this one page.",
          stack: ["HTML", "DGTL Brand", "Netlify"],
          link: "",
          image: "",
        },
        {
          id: "dgtl-pitch-skill",
          name: "DGTL Pitch Pages Skill",
          status: "working",
          blurb: "A reusable skill for generating branded pitch / offer landing pages.",
          detail: "Live and constantly updated. Built elsewhere — point us at the source when ready.",
          next: "Keep expanding the block library and variants.",
          stack: ["Skill", "Automation"],
          link: "",
          image: "",
        },
        {
          id: "content-day-funnel",
          name: "Content Day / Sales Funnel",
          status: "in-progress",
          blurb: "A multi-part system: a lead-generation tool, an email correspondence / outreach engine, plus other site pieces.",
          detail: "Several components in flight. Built elsewhere — files/links to come.",
          next: "Assemble the components into one funnel.",
          stack: ["Lead-gen", "Email", "Web"],
          link: "",
          image: "",
        },
      ],
    },
    {
      id: "team-ops",
      name: "Team Ops",
      tagline: "Keeping the team synced and growing.",
      projects: [
        {
          id: "team-task-board",
          name: "Team Task Board",
          status: "working",
          blurb: "A Supabase + Netlify app: magic-link login, email-gated team access, and a shared live-syncing board.",
          detail: "Multi-assignee tasks, statuses, due dates, an updates log, .ics export, plus setup SQL and a README.",
          next: "Google Calendar auto-sync.",
          stack: ["Supabase", "Netlify", "Realtime"],
          link: "",
          image: "",
        },
        {
          id: "team-growth-dashboard",
          name: "Team Growth Dashboard",
          status: "in-progress",
          blurb: "A team & growth-metrics dashboard.",
          detail: "Built/ongoing elsewhere — point us at the files when ready.",
          stack: ["Dashboard", "Metrics"],
          link: "",
          image: "",
        },
        {
          id: "daily-habit-tracker",
          name: "Daily Habit Tracker",
          status: "working",
          blurb: "A habit-tracking app.",
          detail: "Built elsewhere — files/links to come.",
          stack: ["App"],
          link: "",
          image: "",
        },
      ],
    },
    {
      id: "frameworks-apps",
      name: "Frameworks & Apps",
      tagline: "Systems and standalone utilities.",
      projects: [
        {
          id: "vst-workshop",
          name: "VST Workshop",
          status: "in-progress",
          blurb: "A teaching / build framework containing two projects: Detail Forge and Spectra Step.",
          detail: "Built on claude.ai / Claude Code. The framework wraps both sub-projects.",
          next: "Continue building out Detail Forge and Spectra Step.",
          stack: ["Framework", "Detail Forge", "Spectra Step"],
          link: "",
          image: "",
        },
        {
          id: "pack-list",
          name: "Pack List",
          status: "working",
          blurb: "An HTML web app for organizing packing lists.",
          detail: "Built elsewhere — point us at the files when ready.",
          stack: ["HTML", "App"],
          link: "",
          image: "",
        },
      ],
    },
  ],
};
