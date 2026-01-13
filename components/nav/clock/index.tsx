"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export function ClockWidget() {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-center text-white mb-8">
      <div className="text-6xl md:text-8xl font-light tracking-tighter">
        {format(time, "HH:mm")}
      </div>
      <div className="text-xl md:text-2xl mt-2 font-medium opacity-90">
        {format(time, "yyyy年MM月dd日 EEEE", { locale: zhCN })}
      </div>
    </div>
  );
}