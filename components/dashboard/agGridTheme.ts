// ProcurePilot dashboard — AG Grid setup (client-side).
// Registers the community modules once and exposes the dark Quartz theme
// matched to the app's neutral-950 palette. Imported by every grid component.

import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

export const dashboardTheme = themeQuartz.withParams(
  {
    backgroundColor: "#0a0a0a",
    foregroundColor: "#e5e5e5",
    headerBackgroundColor: "#171717",
    headerTextColor: "#a3a3a3",
    oddRowBackgroundColor: "#101010",
    rowHoverColor: "#1c1c1c",
    borderColor: "#262626",
    accentColor: "#10b981",
    inputBackgroundColor: "#171717",
    inputBorder: { color: "#404040" },
    fontFamily: "inherit",
    headerFontSize: 12,
    fontSize: 13,
  },
  "dark",
);
