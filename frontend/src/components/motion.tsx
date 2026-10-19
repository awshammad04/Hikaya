import React from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Shared motion wrappers.
 *
 * Everything here checks `useReducedMotion` and collapses to a plain fade or no
 * animation at all when the visitor has asked their system for reduced motion.
 * Movement is decoration; the content has to arrive either way.
 */

/** Fades and lifts a page into view on route change. */
export const PageTransition: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduced ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Reveals a block as it scrolls into view, once.
 *
 * `viewport.once` matters: re-animating on every scroll past turns a long
 * location page into a flicker show.
 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className }) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: reduced ? 0.15 : 0.5, delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
};

/** Staggers a list so its items arrive one after another. */
export const StaggerList: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: reduced ? 0 : 0.07 } },
        hidden: {},
      }}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 14 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: reduced ? 0.15 : 0.4 }}
    >
      {children}
    </motion.div>
  );
};
