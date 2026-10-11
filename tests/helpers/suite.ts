import { it } from "vitest";

/**
 * For the long end-to-end scenarios (a mail sink, a fake database, ports): they run in order while the file
 * is collected, the way the scripts they come from always ran, and every check becomes one Vitest test with
 * its own name and its own failure. State shared between checks keeps working because nothing is reordered.
 */
export function suite() {
  const results: Array<{ name: string; error: unknown }> = [];
  let current = "";

  /** Names the following checks "A. title › check". */
  const section = (title: string) => {
    current = title;
  };

  const label = (name: string) => (current ? `${current} › ${name}` : name);

  /** `check(name, fn)`: a throwing function fails the check. */
  async function check(name: string, fn: () => Promise<void> | void): Promise<void>;
  /** `check(name, ok, extra)`: a boolean assertion with a detail shown on failure. */
  async function check(name: string, ok: boolean, extra?: string): Promise<void>;
  async function check(name: string, subject: (() => Promise<void> | void) | boolean, extra = "") {
    try {
      if (typeof subject === "boolean") {
        if (!subject) throw new Error(`${name}${extra ? ` — ${extra}` : ""}`);
      } else {
        await subject();
      }
      results.push({ name: label(name), error: null });
    } catch (error) {
      results.push({ name: label(name), error });
    }
  }

  /** Turns what ran into Vitest tests. Call it once, at the end of the file. */
  const report = () => {
    for (const result of results) {
      it(result.name, () => {
        if (result.error) throw result.error;
      });
    }
  };

  return { check, section, report };
}
