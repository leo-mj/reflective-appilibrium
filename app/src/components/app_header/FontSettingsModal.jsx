import { useState } from "react";
import { C } from "../../constants/colors.js";
import { btn } from "./appHeaderStyles.js";

const FONTS = [
  {
    id: "system",
    label: "System",
    value: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  { id: "serif", label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  {
    id: "mono",
    label: "Mono",
    value: "ui-monospace, Menlo, Consolas, monospace",
  },
];

export function applyFont(fontId) {
  const font = FONTS.find((f) => f.id === fontId) ?? FONTS[0];
  document.documentElement.style.setProperty("--font-family", font.value);
}

/** @param {{ open: boolean, onClose: () => void }} props */
export function FontSettingsModal({ open, onClose }) {
  const [fontId, setFontId] = useState(
    () => localStorage.getItem("fontId") ?? "system"
  );

  const handleSelect = (id) => {
    setFontId(id);
    localStorage.setItem("fontId", id);
    applyFont(id);
  };

  if (!open) return null;

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 199 }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 200,
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 20,
          width: 260,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            fontWeight: "bold",
            marginBottom: 12,
            color: C.text,
            fontSize: 13,
          }}
        >
          Font
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {FONTS.map((f) => (
            <button
              key={f.id}
              onClick={() => handleSelect(f.id)}
              style={{
                ...btn(fontId === f.id),
                justifyContent: "space-between",
                fontFamily: f.value,
                fontSize: 13,
                height: 40,
                padding: "0 12px",
              }}
            >
              <span>{f.label}</span>
              <span style={{ opacity: 0.55, fontSize: 12 }}>
                The quick brown fox
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button onClick={onClose} style={{ ...btn(false), color: C.dim }}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}
