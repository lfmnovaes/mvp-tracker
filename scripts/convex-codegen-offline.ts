// Bootstrap types from the exact pinned CLI templates without cloud credentials.
// Normal owner setup regenerates these files with `npx convex dev --once`.
import { mkdir, writeFile } from "node:fs/promises";
import { apiCodegen } from "../node_modules/convex/src/cli/codegen_templates/api";
import { serverCodegen } from "../node_modules/convex/src/cli/codegen_templates/server";
const api = apiCodegen(["timers.ts"], { useTypeScript: false });
const server = serverCodegen({ useTypeScript: false, envVars: undefined });
const dataModel = `// Schema-derived bootstrap types; owner setup regenerates with npx convex dev --once.
import type { DataModelFromSchemaDefinition, DocumentByName, TableNamesInDataModel, SystemTableNames } from "convex/server";
import type { GenericId } from "convex/values";
import schema from "../schema.js";
export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type TableNames = TableNamesInDataModel<DataModel>;
export type Doc<T extends TableNames> = DocumentByName<DataModel, T>;
export type Id<T extends TableNames | SystemTableNames> = GenericId<T>;
`;
await mkdir("convex/_generated", { recursive: true });
for (const [file, contents] of Object.entries({ "api.js": api.JS, "api.d.ts": api.DTS, "server.js": server.JS, "server.d.ts": server.DTS, "dataModel.d.ts": dataModel })) {
  if (typeof contents !== "string") throw new Error("Pinned Convex templates changed.");
  await writeFile(`convex/_generated/${file}`, contents.split("\n").map(line => line.trimEnd()).join("\n").trimEnd() + "\n");
}
