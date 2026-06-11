export const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** UI mutations (close position, strategy toggle, push alerts) are dev-only. */
export const ALLOW_DASHBOARD_MUTATIONS = !IS_PRODUCTION;
