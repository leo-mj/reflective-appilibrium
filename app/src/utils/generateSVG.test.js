// @vitest-environment jsdom
//
// jsdom is here for DOMParser: the export is embedded verbatim in a markdown
// file, so "does this actually parse as SVG" is the assertion that matters, and
// string matching alone would miss unescaped user text breaking the markup.
import { describe, it, expect } from "vitest";
import { generateGraphSVG, svgToDataUrl } from "./generateSVG.js";
import { statementCard } from "./statementCards.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const el = (id, overrides = {}) => ({
  id,
  type: id.startsWith("P") ? "principle" : id.startsWith("T") ? "theory" : "judgment",
  status: "active",
  confidence: 1,
  origin: "user",
  text: `Text for ${id}`,
  addedRound: 1,
  ...overrides,
});

const rel = (from, to, overrides = {}) => ({
  from,
  to,
  type: "supports",
  explanation: "",
  addedRound: 1,
  ...overrides,
});

/** Two nodes 200px apart, which is enough for an edge to have length. */
const POSITIONS = { J1: { x: 0, y: 0 }, P1: { x: 200, y: 0 }, T1: { x: 0, y: 200 } };

/** The node labels present in an SVG, in document order. Nodes are labelled by id. */
const labelsIn = (svg) =>
  [...new DOMParser().parseFromString(svg, "image/svg+xml").querySelectorAll("text")]
    .map((t) => t.textContent)
    .sort();

// ─── generateGraphSVG ─────────────────────────────────────────────────────────

describe("generateGraphSVG", () => {
  it("returns null when nothing has a known position", () => {
    expect(generateGraphSVG([el("J1")], [], {})).toBeNull();
    expect(generateGraphSVG([], [], POSITIONS)).toBeNull();
  });

  it("produces a well-formed, self-contained svg root", () => {
    const svg = generateGraphSVG([el("J1"), el("P1")], [], POSITIONS);
    expect(svg.startsWith("<svg xmlns=")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    // The export is embedded in a markdown file with no stylesheet to lean on.
    expect(svg).not.toContain("<link");
    expect(svg).not.toContain("<script");
  });

  it("parses as XML", () => {
    const svg = generateGraphSVG(
      [el("J1"), el("P1"), el("T1")],
      [rel("J1", "P1"), rel("P1", "T1", { type: "conflicts" })],
      POSITIONS,
    );
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.tagName).toBe("svg");
  });

  it("sizes the viewport to the node bounding box plus padding", () => {
    const svg = generateGraphSVG([el("J1"), el("P1")], [], POSITIONS);
    // Nodes span 200px on x and 0 on y; padding is 70 on each side.
    expect(svg).toContain('width="340"');
    expect(svg).toContain('height="140"');
  });

  it("hides withdrawn elements by default and shows them on request", () => {
    const elements = [el("J1"), el("P1", { status: "withdrawn" })];
    const hidden = generateGraphSVG(elements, [], POSITIONS);
    const shown = generateGraphSVG(elements, [], POSITIONS, { showWithdrawn: true });
    expect(labelsIn(hidden)).toEqual(["J1"]);
    expect(labelsIn(shown)).toEqual(["J1", "P1"]);
  });

  it("drops edges whose endpoints are not visible", () => {
    // The relation points at a withdrawn node, so it must not be drawn dangling.
    const elements = [el("J1"), el("P1", { status: "withdrawn" })];
    const svg = generateGraphSVG(elements, [rel("J1", "P1")], POSITIONS);
    expect(svg).not.toContain("<line");
    expect(svg).not.toContain("marker-end");
  });

  it("drops edges whose endpoints have no position", () => {
    const svg = generateGraphSVG(
      [el("J1"), el("P1")],
      [rel("J1", "MISSING")],
      POSITIONS,
    );
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
  });

  it("renders one node per visible element", () => {
    const svg = generateGraphSVG([el("J1"), el("P1"), el("T1")], [], POSITIONS);
    expect(labelsIn(svg)).toEqual(["J1", "P1", "T1"]);
  });

  it("gives each element type its own shape", () => {
    const svg = generateGraphSVG([el("J1"), el("P1"), el("T1")], [], POSITIONS);
    expect(svg).toContain("<circle"); // judgment
    expect(svg).toContain("<rect"); // principle
    expect(svg).toContain("<polygon"); // theory
  });

  it("labels nodes by id and never embeds their text", () => {
    // The export is a diagram of ids; the prose lives in the markdown around it.
    // That is also why user-authored text cannot break this markup.
    const svg = generateGraphSVG(
      [el("J1", { text: 'Rights & duties <b>"conflict"</b>' })],
      [],
      POSITIONS,
    );
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(svg).not.toContain("<b>");
    expect(svg).not.toContain("Rights");
    expect(labelsIn(svg)).toEqual(["J1"]);
  });
});

// ─── svgToDataUrl ─────────────────────────────────────────────────────────────

describe("generateGraphSVG — merged processes", () => {
  it("puts each node's process letters on it, and still parses", () => {
    const svg = generateGraphSVG([el("J1"), el("P1")], [], POSITIONS, {
      processTags: new Map([["J1", "A+B"], ["P1", "B"]]),
    });
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(labelsIn(svg)).toEqual(["A+B", "B", "J1", "P1"]);
  });

  it("draws no tag for a process never merged", () => {
    expect(labelsIn(generateGraphSVG([el("J1")], [], POSITIONS))).toEqual(["J1"]);
  });
});

describe("svgToDataUrl", () => {
  it("produces a base64 image/svg+xml data URL", () => {
    const url = svgToDataUrl("<svg></svg>");
    expect(url.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  it("round-trips the svg content", () => {
    const svg = '<svg><text>hello</text></svg>';
    const decoded = atob(svgToDataUrl(svg).split(",")[1]);
    expect(decodeURIComponent(escape(decoded))).toBe(svg);
  });

  it("survives non-ASCII text, which plain btoa would choke on", () => {
    // Element text is user-authored prose — em dashes and accents are routine.
    const svg = "<svg><text>Autonomie — Fürsorge</text></svg>";
    const decoded = decodeURIComponent(escape(atob(svgToDataUrl(svg).split(",")[1])));
    expect(decoded).toBe(svg);
  });
});

// ─── Groups ───────────────────────────────────────────────────────────────────

describe("generateGraphSVG — groups", () => {
  const ELS = [el("J1"), el("P1"), el("T1")];
  const parse = (svg) =>
    new DOMParser().parseFromString(svg, "image/svg+xml");

  it("draws an expanded group's hull and name", () => {
    const svg = generateGraphSVG(ELS, [], POSITIONS, {
      groups: [
        { id: "G1", label: "Duties", members: ["J1", "P1"], collapsed: false },
      ],
    });
    expect(labelsIn(svg)).toEqual(["Duties", "J1", "P1", "T1"]);
    // Dashed, so it never reads as a relation.
    expect(svg).toContain('stroke-dasharray="7 5"');
  });

  it("takes the hull into the viewport, not just the nodes", () => {
    // The box clears the outermost member by a wide margin; forgetting it in
    // the bounding box would have the outline clipped at the edge of the file.
    const plain = parse(generateGraphSVG(ELS, [], POSITIONS));
    const grouped = parse(
      generateGraphSVG(ELS, [], POSITIONS, {
        groups: [
          { id: "G1", label: "Duties", members: ["J1", "P1"], collapsed: false },
        ],
      }),
    );
    const width = (doc) => Number(doc.documentElement.getAttribute("width"));
    expect(width(grouped)).toBeGreaterThan(width(plain));
  });

  it("draws a collapsed group as one node, with the members gone", () => {
    const svg = generateGraphSVG(ELS, [], POSITIONS, {
      groups: [
        { id: "G1", label: "Duties", members: ["J1", "P1"], collapsed: true },
      ],
    });
    // The disc carries the group's name and how much it stands for; only T1 is
    // still drawn as itself.
    expect(labelsIn(svg)).toEqual(["2 elements", "Duties", "T1"]);
  });

  it("keeps a crossing relation and drops an internal one", () => {
    const relations = [rel("J1", "P1"), rel("J1", "T1")];
    const svg = generateGraphSVG(ELS, relations, POSITIONS, {
      groups: [
        { id: "G1", label: "Duties", members: ["J1", "P1"], collapsed: true },
      ],
    });
    // One line: J1→T1, re-pointed to G1→T1. J1→P1 went inside the group.
    expect(parse(svg).querySelectorAll("line")).toHaveLength(1);
  });

  it("escapes a group name that would otherwise break the markup", () => {
    const svg = generateGraphSVG(ELS, [], POSITIONS, {
      groups: [
        {
          id: "G1",
          label: 'Rights & <duties>',
          members: ["J1", "P1"],
          collapsed: true,
        },
      ],
    });
    const doc = parse(svg);
    expect(doc.querySelector("parsererror")).toBeNull();
    // The name is wrapped to fit the disc, so it comes back as its lines —
    // each one parsed straight back to the characters that were written.
    const lines = [...doc.querySelectorAll("text")].map((t) => t.textContent);
    expect(lines).toContain("Rights &");
    expect(lines).toContain("<duties>");
  });
});

// ─── The statement view, as the Graph tab's download draws it ─────────────────

describe("generateGraphSVG, with statement cards", () => {
  const LONG = "Promises bind even when <breaking> one would go unnoticed & unpunished.";
  const carded = (e) => ({ ...e, card: statementCard(e) });
  const parse = (svg) => new DOMParser().parseFromString(svg, "image/svg+xml");
  const POS = { J1: { x: 0, y: 0 }, P1: { x: 600, y: 0 } };

  it("draws each element as a card: badge with its id, and its wording", () => {
    const els = [carded(el("J1", { text: LONG })), carded(el("P1"))];
    const doc = parse(generateGraphSVG(els, [], POS));
    expect(doc.querySelector("parsererror")).toBeNull();
    const text = [...doc.querySelectorAll("text")].map((t) => t.textContent);
    expect(text).toContain("J1");
    // User text is escaped, and arrives whole across the card's lines.
    expect(text.join(" ")).toContain("<breaking>");
    expect(text.join(" ")).toContain("&");
    expect(text.some((t) => t.startsWith("Promises bind"))).toBe(true);
  });

  it("puts card fills under the edges and the cards over them", () => {
    const els = [carded(el("J1")), carded(el("P1"))];
    const svg = generateGraphSVG(els, [rel("J1", "P1")], POS);
    const edge = svg.indexOf("<line");
    const firstFill = svg.indexOf('rx="8" fill="var(--c-panel)"');
    // The card's outline rect — hollow arrowheads in <defs> are `fill="none"` too.
    const firstOutline = svg.indexOf('rx="8" fill="none" stroke=');
    expect(firstFill).toBeGreaterThan(-1);
    expect(firstFill).toBeLessThan(edge);
    expect(firstOutline).toBeGreaterThan(edge);
  });

  it("ends an edge at the card's border, not at a node's radius", () => {
    const j1 = carded(el("J1"));
    const p1 = carded(el("P1"));
    const doc = parse(generateGraphSVG([j1, p1], [rel("J1", "P1")], POS));
    // J1's centre, off its own background: the export shifts everything by an
    // offset of its own choosing.
    const fill = doc.querySelector('rect[fill="var(--c-panel)"]');
    const j1CentreX = +fill.getAttribute("x") + j1.card.hw;
    const x1 = +doc.querySelector("line").getAttribute("x1");
    // Straight across to P1, so the edge leaves through J1's right-hand side.
    expect(x1 - j1CentreX).toBeCloseTo(j1.card.hw, 0);
    expect(j1.card.hw).toBeGreaterThan(j1.card.hh);
  });

  it("fades a withdrawn card's badge and outline, and greys its wording", () => {
    const j1 = carded(el("J1", { status: "withdrawn" }));
    const doc = parse(
      generateGraphSVG([j1], [], { J1: { x: 0, y: 0 } }, { showWithdrawn: true }),
    );
    const fill = doc.querySelector('rect[fill="var(--c-panel)"]');
    expect(fill.getAttribute("opacity")).toBeNull();
    const outline = doc.querySelector('rect[fill="none"]');
    expect(outline.getAttribute("stroke-opacity")).toBe("0.25");
    const [badgeId, wording] = [...doc.querySelectorAll("text")];
    expect(badgeId.parentElement.getAttribute("opacity")).toBe("0.25");
    expect(badgeId.getAttribute("text-decoration")).toBe("line-through");
    expect(wording.getAttribute("fill")).toBe("var(--c-dim)");
    expect(wording.closest("g").getAttribute("opacity")).toBeNull();
  });

  it("holds each line to its measured width, so it fits in any font", () => {
    const j1 = carded(el("J1", { text: LONG }));
    const doc = parse(generateGraphSVG([j1], [], { J1: { x: 0, y: 0 } }));
    const spans = [...doc.querySelectorAll("tspan")];
    expect(spans).toHaveLength(j1.card.lines.length);
    spans.forEach((span, i) => {
      expect(+span.getAttribute("textLength")).toBeCloseTo(j1.card.widths[i], 1);
      expect(span.getAttribute("lengthAdjust")).toBe("spacingAndGlyphs");
    });
  });

  it("makes room in the frame for the whole card", () => {
    const j1 = carded(el("J1", { text: LONG }));
    const svg = parse(generateGraphSVG([j1], [], { J1: { x: 0, y: 0 } })).documentElement;
    expect(+svg.getAttribute("width")).toBeGreaterThan(2 * j1.card.hw);
    expect(+svg.getAttribute("height")).toBeGreaterThan(2 * j1.card.hh);
  });

  it("names the font the cards were measured in, quotes and all", () => {
    const fontFamily = '"SF Mono", Menlo, monospace';
    const svg = generateGraphSVG([carded(el("J1"))], [], { J1: { x: 0, y: 0 } }, {
      fontFamily,
    });
    const doc = parse(svg);
    expect(doc.querySelector("parsererror")).toBeNull();
    const fonts = [...doc.querySelectorAll("text")].map((t) =>
      t.getAttribute("font-family"),
    );
    expect(fonts).toContain(fontFamily);
  });

  it("still draws plain elements as the ids view's nodes", () => {
    const svg = generateGraphSVG([el("J1")], [], { J1: { x: 0, y: 0 } });
    expect(svg).not.toContain("--c-panel);");
    expect(labelsIn(svg)).toEqual(["J1"]);
  });
});

// ─── Arrowheads ───────────────────────────────────────────────────────────────

describe("generateGraphSVG arrowheads", () => {
  const TYPES = [
    "supports",
    "conflicts",
    "undermines",
    "entails",
    "precludes",
    "jointly_entails",
    "jointly_precludes",
  ];
  const parse = (svg) => new DOMParser().parseFromString(svg, "image/svg+xml");

  it.each(TYPES)("gives a %s edge a head that exists", (type) => {
    const doc = parse(
      generateGraphSVG([el("J1"), el("P1")], [rel("J1", "P1", { type })], POSITIONS),
    );
    const ref = doc.querySelector("line").getAttribute("marker-end");
    const id = ref.match(/^url\(#(.+)\)$/)[1];
    expect(doc.getElementById(id)).not.toBeNull();
  });

  it("draws the single-premise heads hollow and the joint ones filled, as the canvas does", () => {
    const head = (type) => {
      const doc = parse(
        generateGraphSVG([el("J1"), el("P1")], [rel("J1", "P1", { type })], POSITIONS),
      );
      const id = doc.querySelector("line").getAttribute("marker-end").slice(5, -1);
      return doc.getElementById(id).querySelector("path");
    };
    expect(head("entails").getAttribute("fill")).toBe("none");
    expect(head("precludes").getAttribute("fill")).toBe("none");
    expect(head("jointly_entails").getAttribute("fill")).not.toBe("none");
    expect(head("supports").getAttribute("fill")).not.toBe("none");
  });

  it("sizes heads in pixels and puts the tip on the target's border", () => {
    const doc = parse(
      generateGraphSVG([el("J1"), el("P1")], [rel("J1", "P1", { type: "entails" })], POSITIONS),
    );
    const marker = doc.querySelector("marker");
    expect(marker.getAttribute("markerUnits")).toBe("userSpaceOnUse");
    // Anchored at the base, where the line stops 10px short of the border.
    expect(marker.getAttribute("refX")).toBe("0");
  });
});

