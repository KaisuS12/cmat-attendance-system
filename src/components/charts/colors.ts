// Chart colors, in this order: blue → teal → gold. The trio passes the
// dataviz validator in light mode (lightness band, colorblind separation
// between neighbours, ≥3:1 contrast on white), so the series stay
// distinguishable for everyone.
// Values live in globals.css, with their own validated set for the dark theme.
export const SERIES_BLUE = "var(--chart-blue)"; // "Signed in"
export const SERIES_TEAL = "var(--chart-teal)"; // "Signed out"
export const SERIES_GOLD = "var(--chart-gold)"; // "Completed" (signed in and out)
export const GRID = "var(--chart-grid)";
export const AXIS_TEXT = "var(--chart-axis)";
