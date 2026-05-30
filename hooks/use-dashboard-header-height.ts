"use client";

import { useEffect, useRef } from "react";

import { DASHBOARD_HEADER_HEIGHT_VAR } from "@/constants/dashboard-layout";

export function useDashboardHeaderHeight() {
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    const update = () => {
      document.documentElement.style.setProperty(
        DASHBOARD_HEADER_HEIGHT_VAR,
        `${header.offsetHeight}px`,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty(
        DASHBOARD_HEADER_HEIGHT_VAR,
      );
    };
  }, []);

  return headerRef;
}
