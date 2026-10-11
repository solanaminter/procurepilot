// ProcurePilot adapter contracts (Phase 1).
// These interfaces are the team-wide contracts. Do NOT rename fields or
// interfaces here without coordinating with all teammates.

export interface ProductOffer {
  id: string;
  title: string;
  merchant: string;
  priceCents: number;
  currency: "USD";
  shippingCents: number;
  shippingEtaDays: number;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  productUrl?: string;
}

export interface ProductSearchQuery {
  query: string;
  maxPriceCents?: number;
  maxShippingEtaDays?: number;
  limit?: number;
}

export interface Channel3Adapter {
  searchProducts(q: ProductSearchQuery): Promise<ProductOffer[]>;
}

export interface ProcurementIntent {
  itemDescription: string;
  quantity: number;
  maxUnitPriceCents?: number;
  maxTotalCents?: number;
  maxShippingEtaDays?: number;
  notes?: string;
}

export interface OrderLine {
  offerId: string;
  title: string;
  merchant: string;
  quantity: number;
  unitPriceCents: number;
  shippingCents: number;
}

export interface CreatedOrder {
  orderId: string;
  status: "CREATED" | "APPROVED" | "COMPLETED";
  approvalUrl?: string;
  totalCents: number;
  currency: "USD";
  lines: OrderLine[];
  createdAt: string;
}

export interface PayPalAdapter {
  createOrder(lines: OrderLine[]): Promise<CreatedOrder>;
  captureOrder(orderId: string): Promise<CreatedOrder>;
  getOrder(orderId: string): Promise<CreatedOrder>;
}

export interface RankedOffer extends ProductOffer {
  totalCents: number;
  rank: number;
  reason: string;
}

export interface ComparisonResult {
  ranked: RankedOffer[];
  best: RankedOffer;
  savingsCents: number;
  savingsPct: number;
  summary: string;
}
