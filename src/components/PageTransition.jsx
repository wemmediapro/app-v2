/**
 * Wrapper pour les transitions de page (framer-motion) — évite la duplication dans App.jsx.
 */
import React from 'react';
import { motion } from 'framer-motion';

const transition = { duration: 0.25 };

function PageTransition({ keyProp, children, className }) {
  return (
    <motion.div
      key={keyProp}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default React.memo(PageTransition);
