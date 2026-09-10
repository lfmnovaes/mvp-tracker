import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { defaults, parseSettings, type Settings } from "../shared/protocol";

export class SettingsStore {
  readonly file: string;
  writable = true;
  warning: string | null = null;
  constructor(root: string) {
    this.file = join(root, "data", "settings.json");
    try {
      mkdirSync(join(root, "data"), { recursive: true });
      const probe = `${this.file}.probe-${process.pid}`;
      writeFileSync(probe, "", { flag: "wx" }); unlinkSync(probe);
    } catch { this.writable = false; this.warning = "Portable data folder is read-only. Move MVP Tracker to a writable folder to save settings."; }
  }
  load(): Settings {
    if (!existsSync(this.file)) return defaults();
    try { return parseSettings(JSON.parse(readFileSync(this.file, "utf8"))); }
    catch {
      this.warning = "Settings could not be read. Defaults are active; the original file is preserved until you save.";
      return defaults();
    }
  }
  save(settings: Settings): void {
    const checked = parseSettings(settings);
    if (!this.writable) throw new Error("Portable data folder is read-only.");
    const temporary = `${this.file}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(checked, null, 2) + "\n", { encoding: "utf8", flush: true });
      renameSync(temporary, this.file);
      this.warning = null;
    } catch {
      try { unlinkSync(temporary); } catch { /* Nothing to clean up. */ }
      throw new Error("Settings could not be saved. Check the portable folder's free space and write access.");
    }
  }
}
