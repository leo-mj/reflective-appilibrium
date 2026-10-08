// @vitest-environment jsdom
//
// The two ways a server can fail to answer are not equally serious: one still
// starting is a wait, one that cannot be reached is a fault. The banner shows
// the first in the notice amber and only the second in the danger red.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ErrorBanner } from "./SuggestionActions.jsx";
import {
  ServerStartingError,
  ServerUnreachableError,
} from "../utils/backendError.js";

afterEach(cleanup);

const banner = (message) => {
  render(<ErrorBanner message={message} />);
  return screen.getByText(message);
};

describe("ErrorBanner", () => {
  it("shows a server still starting as a wait, and announces it", () => {
    const el = banner(new ServerStartingError().message);
    expect(el.dataset.kind).toBe("starting");
    expect(el.getAttribute("role")).toBe("status");
  });

  it("shows a server that cannot be reached as an error", () => {
    const el = banner(new ServerUnreachableError().message);
    expect(el.dataset.kind).toBe("error");
  });

  it("shows any other failure as an error", () => {
    expect(
      banner("The backend failed while handling that request.").dataset.kind,
    ).toBe("error");
  });
});
