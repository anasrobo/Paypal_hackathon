/**
 * The PayPal provider registry.
 *
 * There is no `live` option, and the schema that validates
 * PAYPAL_PROVIDER does not accept one. That is deliberate: the switch to a
 * live environment is not a value anyone can type into an env var.
 */

import { getEnv } from "../env";
import { mockPayPal } from "./mock";
import { sandboxPayPal } from "./sandbox";
import type { PayPalProvider } from "./provider";

export type {
  PayPalProvider,
  CreatePayoutInput,
  CreatePayoutResult,
  PayPalWebhookEvent,
  PayoutItemStatus,
} from "./provider";
export { SIGNATURE_HEADER, signBody, verifySignature } from "./sign";

let cached: PayPalProvider | null = null;

export function getPayPalProvider(): PayPalProvider {
  // The environment is validated on EVERY call, even when the provider is
  // cached. A cached provider must never be able to mask an invalid
  // environment, because the environment is what decides which PayPal host
  // the application can reach.
  const { PAYPAL_PROVIDER } = getEnv();
  if (cached) return cached;
  cached = PAYPAL_PROVIDER === "sandbox" ? sandboxPayPal : mockPayPal;
  return cached;
}

/** Test seam: forget the memoised provider. */
export function resetPayPalProvider(): void {
  cached = null;
}
