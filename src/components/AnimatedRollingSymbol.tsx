import React, { useRef, useEffect, useState } from 'react';
import { motion, useInView } from 'framer-motion';

export const AnimatedRollingSymbol = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: false, margin: "-100px" });
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: (e.clientX - rect.left - rect.width / 2) / 20,
          y: (e.clientY - rect.top - rect.height / 2) / 20,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative py-12 md:py-16" ref={containerRef}>
      {/* Single floating asterisk that rolls in place */}
      <motion.div
        className="flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div
          className="relative"
          animate={{
            rotate: 360,
            x: mousePosition.x,
            y: mousePosition.y,
          }}
          transition={{
            rotate: {
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            },
            x: {
              duration: 0.3,
              ease: "easeOut",
            },
            y: {
              duration: 0.3,
              ease: "easeOut",
            },
          }}
        >
          {/* The rolling ball/asterisk */}
          <span 
            className="text-[rgb(243,198,173)] text-6xl md:text-8xl lg:text-9xl font-light select-none block"
            style={{ 
              textShadow: '0 0 40px rgb(243 198 173 / 0.3)',
              lineHeight: 1,
            }}
          >
            ✻
          </span>
        </motion.div>
      </motion.div>

      {/* Subtle trail dots that fade out */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-[rgb(243,198,173)]"
            initial={{ opacity: 0, scale: 0 }}
            animate={isInView ? {
              opacity: [0, 0.4, 0],
              scale: [0, 1, 0],
              x: [0, (i - 2) * 30],
              y: [0, Math.sin(i * 1.5) * 15],
            } : {}}
            transition={{
              duration: 3,
              delay: i * 0.4,
              repeat: Infinity,
              repeatDelay: 2,
              ease: "easeOut",
            }}
            style={{ marginLeft: '-4px', marginTop: '-4px' }}
          />
        ))}
      </div>
    </div>
  );
};
