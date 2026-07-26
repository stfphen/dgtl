"use client";

import { motion, useReducedMotion } from "framer-motion";

// Staggered entrance for grids/lists. Use <Stagger> around a group and
// <StaggerItem> for each child so they cascade in on scroll. Structure-neutral:
// renders a plain element of the chosen tag with the same className.
//
// Reduced motion keeps the SAME rendered markup and collapses transitions to
// zero duration instead of switching to a plain element — see Reveal.jsx for
// why (a divergent client branch strands the server's inline opacity:0 style
// after hydration, permanently hiding content for reduced-motion users).

export function Stagger({
  children,
  as = "div",
  className,
  stagger = 0.08,
  once = true,
  amount = 0.2,
  ...rest
}) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: reduceMotion ? 0 : stagger } },
      }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerItem({ children, as = "div", className, y = 22, ...rest }) {
  const reduceMotion = useReducedMotion();
  const MotionTag = motion[as] || motion.div;

  return (
    <MotionTag
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: {
          opacity: 1,
          y: 0,
          transition: reduceMotion
            ? { duration: 0 }
            : { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
