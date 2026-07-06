"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
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
        {format(time, "HH:mm")}
      </motion.div>
      <motion.div
        className="text-xl md:text-2xl mt-2 font-medium opacity-90"
        initial={motionProps.initial ?? { opacity: 0, y: 10 }}
        animate={motionProps.animate ?? { opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : 0.2 }}
      >
        {format(time, "yyyy年MM月dd日 EEEE", { locale: zhCN })}
      </motion.div>
    </motion.div>
  );
}