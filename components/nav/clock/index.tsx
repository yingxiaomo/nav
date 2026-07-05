"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { motion } from "framer-motion";

export function ClockWidget() {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    // 只在页面可见时更新时钟，标签页隐藏时暂停以节省资源
    let timer: ReturnType<typeof setInterval>;

    const tick = () => {
      if (!document.hidden) {
        setTime(new Date());
      }
    };

    timer = setInterval(tick, 1000);

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

  return (
    <motion.div 
      className="text-center text-white mb-8"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      whileHover={{ scale: 1.02 }}
    >
      <motion.div
        className="text-6xl md:text-8xl font-light tracking-tighter"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        {format(time, "HH:mm")}
      </motion.div>
      <motion.div
        className="text-xl md:text-2xl mt-2 font-medium opacity-90"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {format(time, "yyyy年MM月dd日 EEEE", { locale: zhCN })}
      </motion.div>
    </motion.div>
  );
}