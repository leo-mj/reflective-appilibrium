import { describe, it, expect } from "vitest";

import {
  STATEMENT_CARD,
  cardFootprint,
  expandedCard,
  nextStatementLayout,
  separateFootprints,
  spreadPositions,
  statementCard,
  statementLines,
  widestCard,
} from "./statementCards.js";
import { elementRadius } from "./graphHelpers.js";

describe("statementLines", () => {
  it("keeps every line within the card width and line count", () => {
    const lines = statementLines(
      "It is wrong to break a promise merely because keeping it has become inconvenient, even when nobody would ever find out that it had been broken.",
    );
    expect(lines.length).toBeLessThanOrEqual(STATEMENT_CARD.maxLines);
    for (const line of lines)
      expect(line.length).toBeLessThanOrEqual(STATEMENT_CARD.maxChars);
    expect(lines.at(-1).endsWith("…")).toBe(true);
  });
});

describe("spreadPositions", () => {
  it("scales about the centroid, keeping the arrangement", () => {
    const out = spreadPositions(
      { A: { x: 0, y: 0 }, B: { x: 100, y: 50 } },
      2,
    );
    expect(out).toEqual({ A: { x: -50, y: -25 }, B: { x: 150, y: 75 } });
  });

  it("keeps any other fields on a position", () => {
    const out = spreadPositions({ A: { x: 1, y: 1, vx: 3 } }, 2);
    expect(out.A.vx).toBe(3);
  });

  it("hands back the same object when there is nothing to do", () => {
    const p = { A: { x: 1, y: 1 } };
    expect(spreadPositions(p, 1)).toBe(p);
    expect(spreadPositions({}, 2)).toEqual({});
  });
});

const BOX = { hw: 50, top: -20, bottom: 80 };

/** True when the two footprints overlap at these positions. */
function overlaps(p, f, a, b) {
  return (
    Math.abs(p[a].x - p[b].x) < f.get(a).hw + f.get(b).hw &&
    p[a].y + f.get(a).top < p[b].y + f.get(b).bottom &&
    p[b].y + f.get(b).top < p[a].y + f.get(a).bottom
  );
}

describe("separateFootprints", () => {
  it("pushes a node stacked over another apart until the boxes clear", () => {
    const positions = { A: { x: 0, y: 0 }, B: { x: 10, y: 40 } };
    const f = new Map([
      ["A", BOX],
      ["B", BOX],
    ]);
    const out = separateFootprints(positions, f);
    expect(overlaps(out, f, "A", "B")).toBe(false);
    // Each gave way, rather than one being shoved the whole distance.
    expect(out.A).not.toEqual(positions.A);
    expect(out.B).not.toEqual(positions.B);
  });

  it("leaves boxes that do not collide where they were", () => {
    const positions = { A: { x: 0, y: 0 }, B: { x: 500, y: 0 } };
    const f = new Map([
      ["A", BOX],
      ["B", BOX],
    ]);
    expect(separateFootprints(positions, f)).toEqual(positions);
  });

  it("holds connected boxes further apart, so the edge between them shows", () => {
    // Side by side, 110 apart centre to centre: a 10px gap between the boxes.
    const positions = { A: { x: 0, y: 0 }, B: { x: 110, y: 0 } };
    const f = new Map([
      ["A", BOX],
      ["B", BOX],
    ]);
    const gap = (p) => p.B.x - p.A.x - 2 * BOX.hw;
    const plain = separateFootprints(positions, f);
    const linked = separateFootprints(positions, f, {
      linked: new Set(["A|B", "B|A"]),
    });
    expect(gap(plain)).toBeCloseTo(12);
    expect(gap(linked)).toBeCloseTo(44);
  });

  it("separates nodes on exactly the same spot", () => {
    const positions = { A: { x: 0, y: 0 }, B: { x: 0, y: 0 } };
    const f = new Map([
      ["A", BOX],
      ["B", BOX],
    ]);
    expect(overlaps(separateFootprints(positions, f), f, "A", "B")).toBe(false);
  });

  it("resolves a crowd, and leaves positions it was not given alone", () => {
    const positions = { Z: { x: 3, y: 3, extra: 1 } };
    const f = new Map();
    for (let i = 0; i < 12; i++) {
      positions[`N${i}`] = { x: (i % 4) * 20, y: Math.floor(i / 4) * 20 };
      f.set(`N${i}`, BOX);
    }
    const out = separateFootprints(positions, f);
    const ids = [...f.keys()];
    for (let i = 0; i < ids.length; i++)
      for (let j = i + 1; j < ids.length; j++)
        expect(overlaps(out, f, ids[i], ids[j])).toBe(false);
    expect(out.Z).toBe(positions.Z);
  });
});

describe("nextStatementLayout", () => {
  const f = new Map([
    ["A", BOX],
    ["B", BOX],
  ]);
  const stacked = { A: { x: 0, y: 0 }, B: { x: 10, y: 40 } };
  const shift = (p, dx, dy) =>
    Object.fromEntries(
      Object.entries(p).map(([id, q]) => [id, { x: q.x + dx, y: q.y + dy }]),
    );

  it("runs the pass the first time", () => {
    const next = nextStatementLayout(null, stacked, f, "k");
    expect(next.output).toEqual(separateFootprints(stacked, f));
  });

  it("hands back the same layout for a move too small to see", () => {
    const first = nextStatementLayout(null, stacked, f, "k");
    const next = nextStatementLayout(first, shift(stacked, 0.5, -0.5), f, "k");
    expect(next).toBe(first);
  });

  it("carries the last result along with a visible move instead of redoing it", () => {
    const first = nextStatementLayout(null, stacked, f, "k");
    const next = nextStatementLayout(first, shift(stacked, 30, 0), f, "k");
    for (const id of ["A", "B"]) {
      expect(next.output[id].x).toBeCloseTo(first.output[id].x + 30);
      expect(next.output[id].y).toBeCloseTo(first.output[id].y);
    }
  });

  it("small moves of the input are small moves of the output", () => {
    // Nudge B across the point where a fresh pass flips which way it pushes.
    let prev = nextStatementLayout(null, stacked, f, "k");
    for (let dx = 0; dx <= 20; dx += 3) {
      const input = { A: stacked.A, B: { x: 10 - dx, y: 40 } };
      const next = nextStatementLayout(prev, input, f, "k");
      for (const id of ["A", "B"])
        expect(
          Math.hypot(
            next.output[id].x - prev.output[id].x,
            next.output[id].y - prev.output[id].y,
          ),
        ).toBeLessThan(10);
      prev = next;
    }
  });

  it("starts afresh when the footprints change", () => {
    const first = nextStatementLayout(null, stacked, f, "k");
    const next = nextStatementLayout(first, stacked, f, "k2");
    expect(next).not.toBe(first);
    expect(next.output).toEqual(separateFootprints(stacked, f));
  });
});

describe("statementCard", () => {
  const judgment = {
    id: "J1",
    type: "judgment",
    confidence: 1,
    text: "A statement long enough to wrap onto a second line of the card.",
  };

  it("holds the node at its usual size beside the wording", () => {
    const card = statementCard(judgment);
    const r = elementRadius(judgment);
    // The badge sits inside the left edge, the text starts right of it.
    expect(card.badgeX - r).toBeGreaterThanOrEqual(-card.hw);
    expect(card.textX).toBeGreaterThan(card.badgeX + r);
    expect(card.hh).toBeGreaterThanOrEqual(r);
    expect(card.lines.length).toBeGreaterThan(1);
  });

  it("is wide enough for its longest line", () => {
    const card = statementCard(judgment);
    const { fontSize, charWidth } = STATEMENT_CARD;
    const longest = Math.max(...card.lines.map((l) => l.length));
    expect(card.hw - card.textX).toBeGreaterThanOrEqual(
      longest * fontSize * charWidth - 1e-9,
    );
  });

  it("is as tall as a principle's badge when the wording is one line", () => {
    const el = { id: "P1", type: "principle", confidence: 1, text: "P" };
    const card = statementCard(el);
    expect(card.hh).toBeGreaterThanOrEqual(0.75 * elementRadius(el));
    expect(cardFootprint(card)).toEqual({
      hw: card.hw,
      top: -card.hh,
      bottom: card.hh,
    });
  });
});

describe("expandedCard", () => {
  const el = {
    id: "J1",
    type: "judgment",
    confidence: 0.5,
    text: "It is wrong to break a promise merely because keeping it has become inconvenient, even when nobody would ever find out that it had been broken.",
  };

  it("is null for a card that already shows everything", () => {
    const short = { ...el, text: "Promises bind." };
    expect(expandedCard(short, statementCard(short))).toBeNull();
  });

  it("carries the whole statement", () => {
    const { card } = expandedCard(el, statementCard(el));
    expect(card.lines.join(" ")).toBe(el.text);
    expect(card.expanded).toBe(true);
  });

  it("grows from the card's top-left corner, badge and first lines in place", () => {
    const card = statementCard(el);
    const { card: full, dx, dy } = expandedCard(el, card);
    // Same top-left corner, in the element's own coordinates.
    expect(dx - full.hw).toBeCloseTo(-card.hw);
    expect(dy - full.hh).toBeCloseTo(-card.hh);
    // Badge and first baseline where the card had them.
    expect(dx + full.badgeX).toBeCloseTo(card.badgeX);
    expect(dy + full.badgeY).toBeCloseTo(card.badgeY);
    expect(dy + full.textY).toBeCloseTo(card.textY);
    expect(full.lines.slice(0, card.lines.length - 1)).toEqual(
      card.lines.slice(0, -1),
    );
  });
});

describe("statementCard, measured", () => {
  const el = {
    id: "P6",
    type: "principle",
    confidence: 0.5,
    text: "Proximity (temporal, social, relational) modulates the strength but not the existence of moral obligations.",
  };
  const { fontSize, charWidth, padX } = STATEMENT_CARD;
  // A monospace running wider than the estimate assumes — the case that put
  // the last characters on the border.
  const wider = (s) => s.length * fontSize * (charWidth + 0.05);

  it("leaves the same gap after the longest line as before the badge", () => {
    const card = statementCard(el, { measure: wider });
    const longest = Math.max(...card.lines.map(wider));
    expect(card.hw - (card.textX + longest)).toBeCloseTo(padX);
  });

  it("wraps shorter lines in a wider font rather than growing the card", () => {
    const estimated = statementCard(el);
    const measured = statementCard(el, { measure: wider });
    expect(Math.max(...measured.lines.map(wider))).toBeLessThanOrEqual(
      Math.max(...estimated.lines.map((l) => l.length)) * fontSize * charWidth,
    );
  });

  it("grows a hovered card in the same measure", () => {
    const card = statementCard(el, { measure: wider });
    const { card: full } = expandedCard(el, card, { measure: wider });
    expect(full.lines.join(" ")).toBe(el.text);
    const longest = Math.max(...full.lines.map(wider));
    expect(full.hw - (full.textX + longest)).toBeCloseTo(padX);
  });
});

describe("statementCard widths", () => {
  it("carries each line's width, as it was measured", () => {
    const el = {
      id: "J1",
      type: "judgment",
      confidence: 1,
      text: "Promises bind even when breaking one would go unnoticed and unpunished.",
    };
    const measure = (s) => s.length * 9;
    const card = statementCard(el, { measure });
    expect(card.widths).toEqual(card.lines.map(measure));
  });
});

describe("widestCard", () => {
  it("is as large as the element's largest wording, over its whole history", () => {
    const el = {
      id: "J1",
      type: "judgment",
      confidence: 1,
      text: "Short now.",
      history: [
        {
          round: 2,
          type: "revised",
          previousText:
            "Once a much longer statement, which ran to several lines of a card before it was cut down.",
        },
      ],
    };
    const now = statementCard(el);
    const before = statementCard({ ...el, text: el.history[0].previousText });
    const widest = widestCard(el);
    expect(widest.hw).toBeCloseTo(Math.max(now.hw, before.hw));
    expect(widest.hh).toBeCloseTo(Math.max(now.hh, before.hh));
    expect(widest.hh).toBeGreaterThan(now.hh);
  });
});
