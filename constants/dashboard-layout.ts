/** Set on `document.documentElement` from the dashboard header `ResizeObserver`. */
export const DASHBOARD_HEADER_HEIGHT_VAR = "--dashboard-header-height";

/** Mobile stacked panels: viewport below the measured header. */
export const MOBILE_DASHBOARD_PANEL_MIN_HEIGHT_CLASS_NAME =
  "max-lg:min-h-[calc(100dvh-var(--dashboard-header-height,0px))]";

/** Mobile panels with internal scroll (symbol list). */
export const MOBILE_DASHBOARD_PANEL_FIXED_HEIGHT_CLASS_NAME =
  "max-lg:h-[calc(100dvh-var(--dashboard-header-height,0px))] max-lg:min-h-0";
