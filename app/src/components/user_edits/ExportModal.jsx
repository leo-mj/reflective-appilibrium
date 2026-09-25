/**
 * @fileoverview The Export dialog: which sections go into the file.
 *
 * The choice is remembered in this browser (`utils/storedPref.js`), since a
 * reader who wants the Argdown map, or never wants the graph images, wants it
 * the next time too. It is kept per section rather than as a list, so a section
 * this process does not offer keeps whatever it was last set to.
 *
 * @module components/user_edits/ExportModal
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";
import { readPref, writePref } from "../../utils/storedPref.js";
import { ModalShell } from "./ModalShell.jsx";

const KEY = "exportSections";

/** The stored choices, or none if what is stored is not a plain object. */
function storedChoices() {
  const raw = readPref(KEY, {});
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}

/** One section: its name, and a line on what it holds. */
function SectionRow({ section, checked, onToggle }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "6px 4px",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 12,
        color: C.text,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ accentColor: C.supports, cursor: "pointer", marginTop: 2 }}
      />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontWeight: "bold" }}>{section.label}</span>
        <span style={{ color: C.dim }}> · {section.detail}</span>
      </span>
    </label>
  );
}

/**
 * @param {Object} props
 * @param {{ key: string, label: string, detail: string, on: boolean }[]} props.sections -
 *   The sections this process offers, from `exportSectionsFor`.
 * @param {function(Set<string>): void} props.onExport - Called with the chosen keys.
 * @param {function(): void} [props.onExportArgdown] - Writes the Argdown map alone
 *   as an `.argdown` file; the button is left out without it.
 * @param {function(): void} props.onCancel
 */
export function ExportModal({ sections, onExport, onExportArgdown, onCancel }) {
  const [chosen, setChosen] = useState(() => {
    const stored = storedChoices();
    return new Set(
      sections
        .filter((s) => (typeof stored[s.key] === "boolean" ? stored[s.key] : s.on))
        .map((s) => s.key),
    );
  });

  const toggle = (key) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const save = () => {
    writePref(KEY, {
      ...storedChoices(),
      ...Object.fromEntries(sections.map((s) => [s.key, chosen.has(s.key)])),
    });
    onExport(chosen);
  };

  const offersHistory = sections.some((s) => s.key === "history");

  return (
    <ModalShell
      title="Export"
      subtitle="Choose what goes into the Markdown file."
      onCancel={onCancel}
      onSave={save}
      saveLabel="Download"
      saveDisabled={chosen.size === 0}
    >
      <div
        role="group"
        aria-label="Sections to export"
        style={{
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: "0 6px",
          marginBottom: 12,
        }}
      >
        {sections.map((s) => (
          <SectionRow
            key={s.key}
            section={s}
            checked={chosen.has(s.key)}
            onToggle={() => toggle(s.key)}
          />
        ))}
      </div>

      {/* Nothing is stored anywhere else, so this file is the only way back in. */}
      {offersHistory && !chosen.has("history") && (
        <div
          role="note"
          style={{ fontSize: 11, color: C.theory.text, marginBottom: 8 }}
        >
          Without the full history, this file cannot be imported to continue the
          process.
        </div>
      )}

      {/* A file of its own rather than a section: Argdown's tools open an
          .argdown file and not a Markdown one, and Import reads it back as an
          argument map. The ticks above do not apply to it. */}
      {onExportArgdown && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 0",
            marginBottom: 8,
            borderTop: `1px solid ${C.border}`,
            fontSize: 11,
            color: C.dim,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>
            Or the Argdown map alone, as a file Argdown&apos;s tools open and
            Import reads back as an argument map.
          </span>
          <button
            onClick={onExportArgdown}
            style={{
              flexShrink: 0,
              padding: "7px 14px",
              borderRadius: 4,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.text,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Download .argdown
          </button>
        </div>
      )}
    </ModalShell>
  );
}
