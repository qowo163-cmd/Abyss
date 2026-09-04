import { describe, expect, it } from "vitest";
import { getAdminSetupReadiness } from "../../../server/memberAuth";

describe("initial administrator credential configuration", () => {
  it("reports a ready state when the managed administrator credentials are valid", () => {
    expect(getAdminSetupReadiness()).toEqual({ ready: true });
  });
});
