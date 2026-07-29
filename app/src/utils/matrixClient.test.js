// The relatedness matrix ships a 400-line JSON fixture that only this client
// reads. Nothing else would notice if the import broke or the shape drifted.
import { describe, it, expect } from "vitest";
import { fetchRelatednessMatrix } from "./matrixClient.js";
import sampleMatrix from "../sample-data/sample-matrix.json";

const STATE = { topic: "t", elements: [], relations: [] };

describe("sample relatedness matrix", () => {
  it("has the three sections the tab renders", () => {
    expect(Object.keys(sampleMatrix).sort()).toEqual([
      "matrix",
      "overview",
      "pairDescriptions",
    ]);
    expect(typeof sampleMatrix.overview).toBe("string");
  });

  it("scores every ordered pair, symmetrically and in range", () => {
    const { matrix } = sampleMatrix;
    const ids = Object.keys(matrix);
    expect(ids.length).toBeGreaterThan(1);
    for (const a of ids) {
      expect(matrix[a][a]).toBe(1); // an element is maximally like itself
      for (const b of ids) {
        const score = matrix[a][b];
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
        expect(score).toBe(matrix[b][a]);
      }
    }
  });

  it("describes every unordered pair exactly once, using known ids", () => {
    const ids = Object.keys(sampleMatrix.matrix);
    const pairs = Object.keys(sampleMatrix.pairDescriptions);
    expect(pairs).toHaveLength((ids.length * (ids.length - 1)) / 2);
    for (const pair of pairs) {
      const [from, to] = pair.split("→");
      expect(ids).toContain(from);
      expect(ids).toContain(to);
    }
  });

  it("loads through the client in sample mode", async () => {
    const result = await fetchRelatednessMatrix(STATE, { useDummy: true });
    expect(result.matrix).toEqual(sampleMatrix.matrix);
    expect(result.overview).toBe(sampleMatrix.overview);
    expect(result._model).toBeTruthy();
  });
});
