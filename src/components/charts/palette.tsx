/**
 * The parts of the chart module that do not touch recharts. They live apart so
 * that a page can name a series colour without pulling the charting library
 * into its first load — see the facade in `index.tsx`.
 */

export const SERIES_COLORS = [
  "var(--color-chart-exchange)",
  "var(--color-chart-deposit)",
  "var(--color-chart-withdrawal)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
];
