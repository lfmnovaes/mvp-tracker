import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
export const observation = v.object({
  mobId: v.string(), region: v.string(), channel: v.number(), observationId: v.string(), diedAt: v.optional(v.number()), gatheredAt: v.number(),
  source: v.union(v.literal("manual"), v.literal("gravestone"), v.literal("alive")), timePrecision: v.union(v.literal("minute"), v.literal("second"), v.literal("millisecond")),
  position: v.optional(v.object({ x: v.number(), y: v.number(), z: v.number() })),
  killedBy: v.optional(v.string()), observedByCharacter: v.optional(v.string()), instanceId: v.optional(v.string()), replacesObservationId: v.optional(v.string()),
  submission: v.optional(v.object({ submittedByCharacter: v.union(v.string(), v.null()), serverAcceptedAt: v.number() })),
});
export default defineSchema({
  trackerMeta: defineTable({ singleton: v.literal("tracker"), schema: v.number(), catalog: v.number(), datasetId: v.string(), generation: v.number(), resetAt: v.number(), revision: v.number(), prunedRevision: v.optional(v.number()), nextExpiry: v.optional(v.number()), cleanupJob: v.optional(v.id("_scheduled_functions")), cleanupToken: v.optional(v.number()) }).index("by_singleton", ["singleton"]),
  bossTimers: defineTable({ key: v.string(), mobId: v.string(), region: v.string(), channel: v.number(), observation: v.optional(observation), outdated: v.boolean(), revision: v.number(), expiresAt: v.optional(v.number()) })
    .index("by_slot", ["key"]).index("by_revision", ["revision"]).index("by_expiry", ["expiresAt"]).index("by_observation", ["observation.observationId"]),
  resetReceipts: defineTable({ requestId: v.string(), datasetId: v.string(), expectedGeneration: v.number(), generation: v.number(), resetAt: v.number(), revision: v.number() }).index("by_request", ["requestId"]).index("by_time", ["resetAt"]),
});
