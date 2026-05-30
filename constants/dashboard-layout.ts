/** Set on `document.documentElement` from the dashboard header `ResizeObserver`. */
export const DASHBOARD_HEADER_HEIGHT_VAR = "--dashboard-header-height";

/** Mobile stacked panels: viewport below the measured header. */
export const mobileDashboardPanelMinHeightClassName =
  "max-lg:min-h-[calc(100dvh-var(--dashboard-header-height,0px))]";

/** Mobile panels with internal scroll (symbol list). */
export const mobileDashboardPanelFixedHeightClassName =
  "max-lg:h-[calc(100dvh-var(--dashboard-header-height,0px))] max-lg:min-h-0";
