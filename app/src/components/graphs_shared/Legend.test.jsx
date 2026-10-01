// @vitest-environment jsdom
//
// On a phone the legend folds behind one button: in full it wrapped to three
// lines above the graph. Folded, it still filters, and the button says so.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { Legend } from "./Legend.jsx";

afterEach(cleanup);

const toggle = () => screen.getByRole("button", { name: /Legend/ });

describe("the legend", () => {
  it("is laid out in full where there is room", () => {
    render(<Legend hiddenLegendKeys={new Set()} />);
    expect(screen.queryByRole("button", { name: /Legend/ })).toBeNull();
    expect(screen.getByText("Principle")).toBeTruthy();
  });

  it("folds behind one button on a phone, and opens on it", () => {
    render(<Legend hiddenLegendKeys={new Set()} collapsible />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Principle")).toBeNull();

    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Principle")).toBeTruthy();
  });

  it("says, folded, how much it is hiding", () => {
    render(
      <Legend
        hiddenLegendKeys={new Set(["withdrawn", "conflicts"])}
        collapsible
      />,
    );
    expect(toggle().textContent).toContain("2 hidden");
  });
});
