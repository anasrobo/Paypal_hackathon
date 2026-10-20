/**
 * The PayPal provider seam.
 *
 * Two implementations: `mock` and `sandbox`. There is no `live`, and the
 * registry refuses one.
 *
 * The provider is the ONLY thing that talks to PayPal. It creates payouts
 * and it reports their status. It never decides whether a payout should
 * happen — that decision is made by the gate and recorded in the database
 * before the provider is ever called.
 */

export type PayoutItemStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "BLOCKED"
  | "DENIED"
  | "RETURNED"
  | "HELD"
  | "UNKNOWN";

export interface CreatePayoutInput {
  /**
   * The deterministic idempotency key. NEVER random, NEVER a timestamp.
   * A retry after a crash reuses it, and PayPal returns the original batch
   * instead of creating a second one.
   */
  senderBatchId: string;
  amountCents: number;
  currency: string;
  /** The human's email. This is who gets paid. */
  recipientEmail: string;
  emailSubject: string;
  note: string;
}

export interface CreatePayoutResult {
  /** The PayPal batch id. */
  batchId: string;
  /** The PayPal payout item id. */
  itemId: string;
  status: PayoutItemStatus;
  /** Set when the provider rejected the request outright. */
  errorMessage?: string;
}

export interface PayPalWebhookEvent {
  /** PayPal's event id. The idempotency key on our side. */
  id: string;
  type: string;
  itemId: string | null;
  senderBatchId: string | null;
  status: PayoutItemStatus | null;
}

export interface PayPalProvider {
  readonly name: "mock" | "sandbox";

  /**
   * Create a payout. Resolves with the initial status; it does NOT wait for
   * the money to arrive. The webhook (or the reconciler) confirms it.
   */
  createPayout(input: CreatePayoutInput): Promise<CreatePayoutResult>;

  /** Read the current status of a payout item. Used by the reconciler. */
  getPayoutStatus(itemId: string): Promise<PayoutItemStatus>;

  /**
   * Verify that a webhook really came from PayPal. Must fail closed.
   * `rawBody` is the exact bytes received, before any parsing.
   *
   * Asynchronous because the sandbox provider asks PayPal to confirm the
   * signature. The mock confirms it locally.
   */
  verifyWebhook(
    headers: Record<string, string | undefined>,
    rawBody: string,
  ): Promise<boolean>;

  /** Parse a verified webhook body into the shape the app uses. */
  parseWebhook(rawBody: string): PayPalWebhookEvent;
}
