import { PUBLIC_GAME_MAP as PREVIOUS_PUBLIC_GAME_MAP } from "./public-25647861";
import type { FishNetRpcMap } from "../fishnet/types";
import evidence from "./public-25832491-evidence.json";

// Reviewed against the public executable/metadata. Historical profiles stay unchanged.
export const PUBLIC_GAME_MAP: FishNetRpcMap = {
  ...PREVIOUS_PUBLIC_GAME_MAP, buildFingerprint: evidence.gameAssemblySha256,
  behaviours: PREVIOUS_PUBLIC_GAME_MAP.behaviours.map(behaviour => ({
    ...behaviour,
    rpcs: behaviour.rpcs.flatMap(rpc => {
      const type = behaviour.typeName.split(".").at(-1);
      const current = evidence.verifiedRpcs.find(item => item.methodName === rpc.methodName && item.packetKind === rpc.packetKind
        && (item.typeName === type || item.typeName === "BaseUnitController" && ["PlayerController", "MonsterController"].includes(type!)));
      if (!current) return [];
      return [{ ...rpc, wireHash: current.wireHash,
        ...(type === "PlayerController" && rpc.methodName === "ChannelList_T" ? {
          parameters: [...rpc.parameters!, { name: "pvpIndex", typeName: "System.Int32", codec: "packedInt32" as const }],
        } : {}),
      }];
    }),
    syncTypes: behaviour.typeName === "PlayerSave" ? [
      ...behaviour.syncTypes!, { index: 2, name: "ArenaPeakRating", typeName: "Single", codec: "float32" as const },
    ] : behaviour.syncTypes,
  })),
};
