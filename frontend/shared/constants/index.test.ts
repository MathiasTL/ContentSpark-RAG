import { describe, expect, it } from "vitest";
import { TIMEZONES } from "./index";

describe("TIMEZONES", () => {
  it("es un arreglo no vacío de identificadores IANA", () => {
    expect(Array.isArray(TIMEZONES)).toBe(true);
    expect(TIMEZONES.length).toBeGreaterThan(0);
  });

  it("no tiene entradas duplicadas", () => {
    expect(new Set(TIMEZONES).size).toBe(TIMEZONES.length);
  });

  it("cada entrada tiene forma Area/Location (identificador IANA)", () => {
    TIMEZONES.forEach((tz) => {
      expect(tz).toMatch(/^[A-Za-z_]+\/[A-Za-z_/]+$/);
    });
  });
});
