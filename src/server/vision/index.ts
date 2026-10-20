/**
 * The vision provider registry.
 *
 * One env var swaps the implementation. Nothing else changes.
 */

import { getEnv } from "../env";
import { mockVision } from "./mock";
import type { VisionProvider } from "./provider";

export type { VisionProvider, VisionRequest, MockScenario } from "./provider";

export function getVisionProvider(): VisionProvider {
  const { VISION_PROVIDER } = getEnv();
  switch (VISION_PROVIDER) {
    case "openai":
      // The real provider lands here as one file. Until then, the mock
      // answers, so the product is never blocked on an API key.
      return mockVision;
    case "mock":
    default:
      return mockVision;
  }
}
