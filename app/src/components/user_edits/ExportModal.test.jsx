// @vitest-environment jsdom
//
// The Export dialog decides what goes into the file, and remembers it: the
// second export should not need the same boxes ticked again.
import { vi, describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup, screen } from "@testing-library/react";

import { ExportModal } from "./ExportModal.jsx";
import { EXPORT_SECTIONS, exportSectionsFor } from "../../utils/exportMarkdown.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const STATE = {
  topic: "t",
  round: 1,
  elements: [],
  relations: [],
  coherence: { tensions: [], orphans: [], clusters: [] },
  log: [],
};

function setup({ sections = exportSectionsFor(STATE), onExport = vi.fn() } = {}) {
  render(
    <ExportModal sections={sections} onExport={onExport} onCancel={() => {}} />,
  );
  return onExport;
}

const box = (label) => screen.getByRole("checkbox", { name: new RegExp(`^${label}`) });
const download = () => fireEvent.click(screen.getByRole("button", { name: "Download" }));

describe("ExportModal", () => {
  it("ticks today's export by default, and leaves Argdown off", () => {
    setup();
    expect(box("Elements").checked).toBe(true);
    expect(box("Full history").checked).toBe(true);
    expect(box("Argdown").checked).toBe(false);
  });

  it("offers only the sections it is given", () => {
    setup();
    expect(screen.queryByRole("checkbox", { name: /^Groups/ })).toBeNull();
  });

  it("hands over exactly what is ticked", () => {
    const onExport = setup();
    fireEvent.click(box("Argdown"));
    fireEvent.click(box("Graph"));
    download();
    const chosen = onExport.mock.calls[0][0];
    expect(chosen.has("argdown")).toBe(true);
    expect(chosen.has("graph")).toBe(false);
    expect(chosen.has("history")).toBe(true);
  });

  it("warns that a file without the full history cannot be reopened", () => {
    setup();
    expect(screen.queryByRole("note")).toBeNull();
    fireEvent.click(box("Full history"));
    expect(screen.getByRole("note").textContent).toMatch(
      /cannot be imported to continue the process/,
    );
  });

  it("will not download an empty file", () => {
    const onExport = setup({ sections: EXPORT_SECTIONS.filter((s) => s.key === "log") });
    fireEvent.click(box("Log"));
    expect(screen.getByRole("button", { name: "Download" }).disabled).toBe(true);
    download();
    expect(onExport).not.toHaveBeenCalled();
  });

  it("remembers the choice for next time", () => {
    setup();
    fireEvent.click(box("Argdown"));
    fireEvent.click(box("Clusters"));
    download();
    cleanup();

    setup();
    expect(box("Argdown").checked).toBe(true);
    expect(box("Clusters").checked).toBe(false);
  });

  it("downloads the Argdown map on its own button, whatever is ticked", () => {
    const onExport = vi.fn();
    const onExportArgdown = vi.fn();
    render(
      <ExportModal
        sections={exportSectionsFor(STATE)}
        onExport={onExport}
        onExportArgdown={onExportArgdown}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Download .argdown" }));
    expect(onExportArgdown).toHaveBeenCalledTimes(1);
    expect(onExport).not.toHaveBeenCalled();
  });

  it("leaves the Argdown button out when there is nothing to call", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Download .argdown" })).toBeNull();
  });

  it("keeps the choice for a section this process did not offer", () => {
    localStorage.setItem("exportSections", JSON.stringify({ groups: false }));
    setup();
    download();
    expect(JSON.parse(localStorage.getItem("exportSections")).groups).toBe(false);
  });
});
