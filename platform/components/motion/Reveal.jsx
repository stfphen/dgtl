"use client";

import { motion, useReducedMotion } from "framer-motion";

// Scroll-triggered fade/slide-up. Wraps existing markup without changing its
// structure — pass `as` to control the rendered element (default <div>).
//
// Reduced motion keeps the SAME rendered markup and collapses the transition
// to zero duration instead of switching to a plain element: the server always
// renders the motion element with its initial inline style (opacity 0), and a
// client branch that renders a different element leaves that stale attribute
// unpatched after hydration, permanently hiding content for reduced-motion
// users.
export default function Reveal({
  children,
  as = "div",
  className,
  delay = 0,
  y = 24,
  once = true,
  amount = 0.2,
  ...rest
}) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }
      }
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
