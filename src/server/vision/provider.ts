/**
 * The vision provider seam.
 *
 * The provider reads a price tag. That is ALL it does. It cannot decide
 * anything, it cannot move money, and its output is advisory — it feeds two
 * of the six gate rules and can only ever cause a rule to fail.
 *
 * A real provider is one file plus one environment variable.
 */

import type { ModelOutput } from "@/domain/types";

/**
 * The demo scenarios the mock provider can produce. A real provider ignores
 * this entirely.
 */
export type MockScenario = "match" | "mismatch" | "low_confidence" | "unreadable";

export interface VisionRequest {
  /** The evidence image bytes. */
  image: Buffer;
  mimeType: string;
  /** The price the requester expects, in cents. The mock reads this back. */
  expectedValueCents: number;
  /** Demo affordance. Null for a real provider. */
  scenario: MockScenario | null;
}

export interface VisionProvider {
  readonly name: string;
  readonly model: string;
  /**
   * Does this provider need the image bytes?
   *
   * The mock does not, so the verification service skips the download from
   * storage entirely. A real provider does, and the bytes are fetched only
   * when they are actually needed.
   */
  readonly needsImage: boolean;
  readPriceTag(request: VisionRequest): Promise<ModelOutput>;
}
