import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { checkPassword, PASSWORD_MIN_LENGTH } from "../../src/lib/passwordPolicy";
import { generateSecurePassword } from "../../src/lib/passwordGenerator";

const CASES: Array<[string, string | null]> = [
  ["Ab1de", "tooShort"], ["", "tooShort"], ["Ab1!d", "tooShort"],
  ["abcdef", "needsUppercase"], ["abc123", "needsUppercase"], ["abc!23", "needsUppercase"],
  ["Abcdef", "needsSpecial"], ["ABCDEF", "needsSpecial"], ["Abc def", "needsSpecial"],
  ["Abcde1", null], ["Abcde!", null], ["A1cdef", null], ["Ab#def", null], ["Àbcde9", null], ["Abcdef-", null],
  ["Password1", null], ["Ciao123", null], ["Zz$zzz", null],
  ["abcdef12", "needsUppercase"], ["Abcdefghijklmnop", "needsSpecial"],
];

describe("password policy: 6 characters, an uppercase letter, a number or a special character", () => {
  it("applies the rule to every case", () => {
    assert.equal(PASSWORD_MIN_LENGTH, 6);
    for (const [password, expected] of CASES) assert.equal(checkPassword(password), expected, JSON.stringify(password));
  });

  it("the generator satisfies the rule at every length it allows", () => {
    for (const length of [8, 12, 16, 24]) for (let i = 0; i < 200; i += 1) assert.equal(checkPassword(generateSecurePassword(length)), null);
  });
});
