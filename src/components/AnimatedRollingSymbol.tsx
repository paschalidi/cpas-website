import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export const AnimatedRollingSymbol = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: false, margin: "-50px" });

  return (
    <div className="relative w-full overflow-hidden py-8 md:py-12" ref={containerRef}>
      <motion.div
        className="flex items-center whitespace-nowrap"
        animate={isInView ? { x: ["-100%", "0%"] } : {}}
        transition={{
          duration: 20,
          ease: "linear",
          repeat: Infinity,
        }}
      >
        {[...Array(30)].map((_, index) => (
          <span key={index} className="text-5xl md:text-7xl lg:text-8xl font-light mx-4 text-[#0d2418]/10">
            Let&apos;s get the ball rolling{" "}
            <motion.span
              className="text-[rgb(243,198,173)] mx-4 inline-block"
              animate={{ rotate: 360 }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear"
              }}
            >
              ✻
            </motion.span>
          </span>
        ))}
      </motion.div>
    </div>
  );
};
