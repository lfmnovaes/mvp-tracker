import { FISHNET_RPC_MAP } from "../fishnet/generated/rpc-map";
import type { FishNetRpcMap } from "../fishnet/types";
import evidence from "./public-25647861-evidence.json";
// Only RPCs used by timers, identity resets and position decoding are admitted.
// Other RPCs remain raw/unresolved; obsolete numeric IDs cannot masquerade as channel context.
export const PUBLIC_GAME_MAP: FishNetRpcMap = {
  ...FISHNET_RPC_MAP, buildFingerprint: evidence.gameAssemblySha256,
  behaviours: FISHNET_RPC_MAP.behaviours.map(behaviour => ({
    ...behaviour,
    rpcs: behaviour.rpcs.flatMap(rpc => {
      const type = behaviour.typeName.split(".").at(-1);
      const current = evidence.verifiedRpcs.find(item => item.methodName === rpc.methodName && item.packetKind === rpc.packetKind
        && (item.typeName === type || item.typeName === "BaseUnitController" && ["PlayerController", "MonsterController"].includes(type!)));
      return current ? [{ ...rpc, wireHash: current.wireHash }] : [];
    }),
  })),
};
