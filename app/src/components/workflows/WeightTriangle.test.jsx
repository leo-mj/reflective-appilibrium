// @vitest-environment jsdom
//
// The triangle is the only way to set the simulation weights, and a press
// beside it used to set them as well — projected onto the nearest edge, so a
// click in the margin quietly zeroed a weight.
import { vi, describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

import { WeightTriangle } from "./WeightTriangle.jsx";
import { DEFAULT_WEIGHTS } from "../../constants/simulationWeights.js";
import { tooltipText } from "../tooltipTestUtils.js";

afterEach(cleanup);

beforeAll(() => {
  // jsdom has no pointer capture. Its bounding boxes are all zero, so client
  // coordinates below are the SVG's own.
  SVGElement.prototype.setPointerCapture = () => {};
});

// The triangle's geometry, as WeightTriangle.jsx lays it out.
const CENTRE = { x: 110, y: 112 };
const TOP = { x: 110, y: 40 };

function setup() {
  const onChange = vi.fn();
  const { container } = render(
    <WeightTriangle weights={DEFAULT_WEIGHTS} onChange={onChange} />,
  );
  return { svg: container.querySelector("svg"), onChange };
}

const press = (svg, { x, y }) =>
  fireEvent.pointerDown(svg, { clientX: x, clientY: y, pointerId: 1 });
const move = (svg, { x, y }) =>
  fireEvent.pointerMove(svg, { clientX: x, clientY: y, pointerId: 1 });

describe("WeightTriangle", () => {
  it("sets the weights from a press inside the triangle", () => {
    const { svg, onChange } = setup();
    press(svg, CENTRE);
    expect(onChange).toHaveBeenCalledTimes(1);
    const w = onChange.mock.calls[0][0];
    expect(w.account).toBeCloseTo(1 / 3);
    expect(w.systematicity).toBeCloseTo(1 / 3);
    expect(w.faithfulness).toBeCloseTo(1 / 3);
  });

  it("ignores a press outside the triangle, and the moves after it", () => {
    const { svg, onChange } = setup();
    // Beside the top vertex, and below the base.
    press(svg, { x: 20, y: 40 });
    move(svg, CENTRE);
    press(svg, { x: 110, y: 190 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("follows a drag that started inside out of the triangle, onto its edge", () => {
    const { svg, onChange } = setup();
    press(svg, CENTRE);
    move(svg, { x: TOP.x, y: TOP.y - 30 });
    const w = onChange.mock.calls.at(-1)[0];
    expect(w.systematicity).toBeCloseTo(1);
  });

  it("takes a press on the handle where it overhangs the border", () => {
    const onChange = vi.fn();
    const { container } = render(
      <WeightTriangle
        weights={{ account: 0, systematicity: 1, faithfulness: 0 }}
        onChange={onChange}
      />,
    );
    // Just above the top vertex, where the handle sits.
    press(container.querySelector("svg"), { x: TOP.x, y: TOP.y - 5 });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("explains each weight on its label", () => {
    const { getByText, container } = render(
      <WeightTriangle weights={DEFAULT_WEIGHTS} onChange={() => {}} />,
    );
    expect(tooltipText(getByText("Faithfulness"))).toMatch(
      /simulation started from/,
    );
    expect(container.querySelector("title")).toBeNull();
  });
});
