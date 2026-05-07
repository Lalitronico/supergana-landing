"use client";

import Image from "next/image";
import { motion } from "framer-motion";

type Props = {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  delay?: number;
  amplitude?: number;
  duration?: number;
  rotate?: number;
  priority?: boolean;
};

export function CharacterFloat({
  src,
  alt,
  width,
  height,
  className = "",
  delay = 0,
  amplitude = 14,
  duration = 4.5,
  rotate = 0,
  priority = false,
}: Props) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24, rotate: rotate - 6 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        animate={{ y: [0, -amplitude, 0] }}
        transition={{
          duration,
          repeat: Infinity,
          ease: "easeInOut",
          delay,
        }}
        style={{ willChange: "transform" }}
      >
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className="select-none drop-shadow-[6px_8px_0_rgba(10,10,10,0.18)]"
          draggable={false}
        />
      </motion.div>
    </motion.div>
  );
}
