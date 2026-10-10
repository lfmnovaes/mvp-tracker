import { PUBLIC_GAME_MAP } from "../../protocol/public-25832491.ts";
import { PUBLIC_GAME_MAP as PREVIOUS_PUBLIC_GAME_MAP } from "../../protocol/public-25647861.ts";
import { FISHNET_RPC_MAP } from "../generated/rpc-map/index.ts";
import type { FishNetRpcMap } from "../types.ts";
import {
  LEGACY_GAME_BUILD_FINGERPRINT,
  PREVIOUS_GAME_BUILD_FINGERPRINT,
  BUNDLED_GAME_BUILD_FINGERPRINTS,
  CURRENT_GAME_BUILD_FINGERPRINT,
} from "../../game-build.ts";

const MAPS = {
  [CURRENT_GAME_BUILD_FINGERPRINT]: PUBLIC_GAME_MAP,
  [PREVIOUS_GAME_BUILD_FINGERPRINT]: PREVIOUS_PUBLIC_GAME_MAP,
  [LEGACY_GAME_BUILD_FINGERPRINT]: FISHNET_RPC_MAP,
} as const;

export type BundledFishNetBuildFingerprint = keyof typeof MAPS;

export function loadBundledFishNetRpcMap(
  buildFingerprint: string = CURRENT_GAME_BUILD_FINGERPRINT,
): FishNetRpcMap {
  if (!isBundledFingerprint(buildFingerprint)) {
    throw new Error(
      `unsupported bundled FishNet build fingerprint ${JSON.stringify(buildFingerprint)}; supported: ` +
        BUNDLED_GAME_BUILD_FINGERPRINTS.join(", "),
    );
  }
  return MAPS[buildFingerprint];
}

function isBundledFingerprint(value: string): value is BundledFishNetBuildFingerprint {
  return Object.hasOwn(MAPS, value);
}
