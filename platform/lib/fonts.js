import { Manrope } from "next/font/google";

// The DGTL brand typeface, shared by every authenticated surface (Core OS, the
// admin shell, login). One instance so the two layouts cannot drift apart.
//
// preload: true — this face IS the body font wherever this module is imported,
// and both importers are nested layouts that only wrap authenticated routes, so
// the public tenant funnels never pay for the preload. (The root layout keeps
// its own preload:false Manrope instance for the "platform" marketing template,
// which needs the variable on <html> but does not render in Manrope.)
export const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  preload: true,
});
