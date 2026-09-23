// A build served from a path it was not built for loads no assets at all, and
// the page is blank with nothing on it to say why.
import { describe, it, expect } from "vitest";
import { basePath } from "./basePath.js";

describe("basePath", () => {
  describe("without VITE_BASE_PATH, as before", () => {
    it("serves the dev server and build:local from the root", () => {
      expect(basePath({ mode: "development" })).toBe("/");
      expect(basePath({ mode: "local", githubRepository: "leo-mj/repo" })).toBe("/");
    });

    it("prefixes a Pages-bound build with the repo name from Actions", () => {
      expect(basePath({ mode: "production", githubRepository: "leo-mj/some-repo" })).toBe(
        "/some-repo/",
      );
      expect(basePath({ mode: "backend", githubRepository: "leo-mj/some-repo" })).toBe(
        "/some-repo/",
      );
    });

    it("falls back to the repo's own name outside Actions", () => {
      expect(basePath({ mode: "production" })).toBe("/reflective-appilibrium/");
    });
  });

  describe("with VITE_BASE_PATH", () => {
    // GitLab CI sets no GITHUB_REPOSITORY, and a site served from its root —
    // a university host, pages.dev — needs "/" whatever the mode.
    it("wins over the derived path", () => {
      expect(
        basePath({ mode: "backend", explicit: "/", githubRepository: "leo-mj/some-repo" }),
      ).toBe("/");
    });

    it.each([
      ["/", "/"],
      ["/re/", "/re/"],
      ["re", "/re/"],
      ["/re", "/re/"],
      ["re/", "/re/"],
      ["/tools/re", "/tools/re/"],
      ["  /re/  ", "/re/"],
    ])("normalises %j to %j", (explicit, expected) => {
      expect(basePath({ mode: "backend", explicit })).toBe(expected);
    });

    it("is ignored when empty, as an unset CI variable is", () => {
      expect(basePath({ mode: "production", explicit: "" })).toBe("/reflective-appilibrium/");
    });
  });
});
