import { maintainRecordings } from "./recording-files";
const [action, root, active] = process.argv.slice(2);
if (!["optimize", "clear"].includes(action ?? "") || !root) throw new Error("Invalid recording maintenance command.");
const report = await maintainRecordings(root, action as "optimize" | "clear", active || undefined);
console.log(JSON.stringify(report));
