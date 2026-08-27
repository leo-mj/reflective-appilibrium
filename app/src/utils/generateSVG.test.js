// @vitest-environment jsdom
//
// jsdom is here for DOMParser: the export is embedded verbatim in a markdown
// file, so "does this actually parse as SVG" is the assertion that matters, and
// string matching alone would miss unescaped user text breaking the markup.
import { describe, it, expect } from "vitest";
import { generateGraphSVG, svgToDataUrl } from "./generateSVG.js";

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
