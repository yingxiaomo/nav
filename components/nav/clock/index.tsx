"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

export function ClockWidget() {
  const [time, setTime] = useState<Date>(new Date());
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // 只在页面可见时更新时钟，标签页隐藏时暂停以节省资源
    const tick = () => {
      if (!document.hidden) {
        setTime(new Date());
      }
    };
    const timer = setInterval(tick, 1000);

    // 切回可见时立即刷新
    const handleVisibility = () => {
      if (!document.hidden) {
        setTime(new Date());
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // 减少动画模式下跳过 framer-motion 入口动画
  const motionProps = prefersReducedMotion
    ? { initial: false as const, animate: { opacity: 1, y: 0, scale: 1 } as const }
    : {};

  const timeStr = time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = time.toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return (
    <motion.div
      className="text-center text-white mb-8"
      initial={motionProps.initial ?? { opacity: 0, y: -20 }}
      animate={motionProps.animate ?? { opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: "easeOut" }}
      whileHover={prefersReducedMotion ? undefined : { scale: 1.02 }}
    >
      <motion.div
        className="text-6xl md:text-8xl font-light tracking-tighter"
        initial={motionProps.initial ?? { opacity: 0, scale: 0.95 }}
        animate={motionProps.animate ?? { opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      >
        {timeStr}
      </motion.div>
      <motion.div
        className="text-xl md:text-2xl mt-2 font-medium opacity-90"
        initial={motionProps.initial ?? { opacity: 0, y: 10 }}
        animate={motionProps.animate ?? { opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : 0.2 }}
      >
        {dateStr}
      </motion.div>
    </motion.div>
  );
}
