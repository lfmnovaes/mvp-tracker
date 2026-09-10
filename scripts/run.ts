import { resolve } from "node:path";
const root = resolve(import.meta.dir, "..");
// This is the interactive GUI, so let Neutralino manage visibility. windowsHide is for helpers only.
const child = Bun.spawn([resolve(root, "bin/neutralino-win_x64.exe"), `--path=${root}`], { cwd: root, stdout: "inherit", stderr: "inherit" });
process.exit(await child.exited);
