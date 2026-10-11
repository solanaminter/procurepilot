// ProcurePilot — adapter factory (Phase 1).
// Always returns the mock adapters while MOCK_MODE is enabled (the default).
//
// Channel3 route-around: when MOCK_MODE is false but no CHANNEL3_API_KEY is
// set, product discovery falls back to the curated real-product catalog
// (RealCatalogAdapter) — Channel3's signup is blocked by a Cloudflare
// challenge, so there is no live API to call.
//
// ── EXTENSION POINT (Phase 2) ──────────────────────────────────────────
// When real credentials arrive, implement `Channel3HttpAdapter` and
// `PayPalRestAdapter` in this folder, then return them from getChannel3() /
// getPayPal() when isMockMode() is false. Keep the mock fallback so the
// full demo loop stays runnable with zero secrets.

import type { Channel3Adapter, PayPalAdapter } from "./types";
import { mockChannel3 } from "./mock-channel3";
import { mockPayPal } from "./mock-paypal";
import { RealCatalogAdapter } from "./real-catalog";

export function isMockMode(): boolean {
  // Explicit opt-out only: any value other than "false" means mock mode.
  return process.env.MOCK_MODE !== "false";
}

export function getChannel3(): Channel3Adapter {
  if (isMockMode()) {
    return mockChannel3;
  }
  if (!process.env.CHANNEL3_API_KEY) {
    // Route-around: curated real-product catalog, no credentials needed.
    return new RealCatalogAdapter();
  }
  // ── EXTENSION POINT ──
  // return new Channel3HttpAdapter({ apiKey: required("CHANNEL3_API_KEY") });
  throw new Error("Real Channel3 HTTP adapter is not implemented yet (Phase 2).");
}

export function getPayPal(): PayPalAdapter {
  if (isMockMode()) {
    return mockPayPal;
  }
  // ── EXTENSION POINT ──
  // return new PayPalRestAdapter({
  //   clientId: required("PAYPAL_CLIENT_ID"),
  //   clientSecret: required("PAYPAL_CLIENT_SECRET"),
  // });
  throw new Error("Real PayPal adapter is not implemented yet (Phase 2).");
}
