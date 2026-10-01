// @vitest-environment jsdom
//
// After a merge, a node wears the letter of the process it came from, and the
// legend says which letter is which. Before one, neither says anything.
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { GraphNode } from "./GraphElements.jsx";
import { Legend } from "./Legend.jsx";

afterEach(cleanup);

const element = {
  id: "J1",
  type: "judgment",
  status: "active",
  confidence: 0.7,
  text: "x",
  addedRound: 1,
};

const node = (props) =>
  render(
    <svg>
      <GraphNode element={element} position={{ x: 0, y: 0 }} opacity={1} {...props} />
    </svg>,
  );

describe("process tag on a node", () => {
  it("shows the process letters when the node has them", () => {
    node({ processTag: "A+B" });
    expect(screen.getByTestId("process-tag").textContent).toBe("A+B");
  });

  it("draws nothing for a process never merged", () => {
    node({});
    expect(screen.queryByTestId("process-tag")).toBeNull();
  });
});

describe("process key in the legend", () => {
  it("names each process by its letter", () => {
    render(
      <Legend
        processes={[
          { id: "A", label: "Lying", members: [] },
          { id: "B", label: "Promises", members: [] },
        ]}
      />,
    );
    expect(screen.getAllByTestId("legend-process").map((e) => e.textContent)).toEqual([
      "ALying",
      "BPromises",
    ]);
  });

  it("is absent before a merge", () => {
    render(<Legend />);
    expect(screen.queryByTestId("legend-process")).toBeNull();
  });
});
