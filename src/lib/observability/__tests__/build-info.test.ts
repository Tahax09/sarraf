import { buildLabel, isStampedBuild } from "@/lib/observability/build-info";

/**
 * The footer and the diagnostics card both read these. A developer build has
 * no commit, and the label still has to be something a person can read out.
 */
describe("build info", () => {
  it("reads as version alone when the build was never stamped", () => {
    const info = {
      version: "1.4.0",
      commit: null,
      builtAt: null,
      environment: "development",
    };
    expect(buildLabel(info)).toBe("1.4.0");
    expect(isStampedBuild(info)).toBe(false);
  });

  it("pairs version with commit for a pipeline build", () => {
    const info = {
      version: "1.4.0",
      commit: "a1b2c3d4e5f6",
      builtAt: "2026-08-06T09:00:00.000Z",
      environment: "production",
    };
    // Middle dot, not a slash: the line gets pasted into chat clients that
    // would turn a slash-separated string into a link.
    expect(buildLabel(info)).toBe("1.4.0 · a1b2c3d4e5f6");
    expect(isStampedBuild(info)).toBe(true);
  });
});
