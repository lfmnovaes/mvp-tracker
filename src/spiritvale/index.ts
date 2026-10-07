// Local capture/protocol API. See README.md for source provenance and maintenance.
export { FishNetSessionDecoder, FishNetProtocolError } from "./fishnet/decoding/decoder";
export { loadBundledFishNetRpcMap } from "./fishnet/mapping/bundled-rpc-map";
export { decodeBossGravestone, type BossGravestone } from "./fishnet/tracking/boss-gravestone";
export { FishNetTransportReplay } from "./fishnet/replay";
export type { CapturedFishNetPacket } from "./fishnet/types";
export type { CaptureConfig, CaptureTargetStatus, CaptureConnectionEvent, CapturedTransportPacket } from "./types";
export const CAPTURE_REVISION = "local-1";
export { CURRENT_GAME_BUILD_FINGERPRINT } from "./game-build";
