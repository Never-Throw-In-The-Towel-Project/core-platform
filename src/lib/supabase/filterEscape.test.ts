import { describe, expect, it } from "vitest";
import { escapeFilterValue } from "./filterEscape";

describe("escapeFilterValue", () => {
  it("leaves an ordinary value unchanged", () => {
    expect(escapeFilterValue("addiction")).toBe("addiction");
  });

  it("escapes a literal double quote", () => {
    expect(escapeFilterValue('say "hello"')).toBe('say \\"hello\\"');
  });

  it("escapes a backslash before the quote, so it can't escape the closing quote", () => {
    // A trailing backslash inside a quoted PostgREST value would otherwise
    // escape the closing `"` and let the rest break out into filter syntax.
    expect(escapeFilterValue("ends with\\")).toBe("ends with\\\\");
    // Backslash + quote together must not collapse into a single escaped
    // quote: both get escaped independently.
    expect(escapeFilterValue('a\\"b')).toBe('a\\\\\\"b');
  });

  it("does not need to escape commas or parens themselves -- the surrounding quotes neutralize them", () => {
    // This is the actual injection this helper defends against: a raw
    // comma/paren in an unquoted PostgREST filter value would be
    // interpreted as a filter delimiter, letting an attacker smuggle in an
    // extra condition (e.g. `,is_removed.eq.false` to bypass moderation
    // filtering). Escaping quotes and always wrapping the value in quotes
    // at the call site (not this function's job) is what neutralizes that --
    // this test documents the case the surrounding `"..."` wrapping exists
    // to close off, even though this function itself only touches quotes.
    const malicious = 'x",is_removed.eq.false,y."z';
    const escaped = escapeFilterValue(malicious);
    // A wrapped, escaped value can only ever be interpreted as one literal
    // string value by PostgREST, never as extra filter syntax.
    expect(escaped).toBe('x\\",is_removed.eq.false,y.\\"z');
  });
});
