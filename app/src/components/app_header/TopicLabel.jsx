/**
 * @fileoverview Topic text with hover/tap tooltip.
 * @module components/app_header/TopicLabel
 */

import { useState } from "react";
import { C } from "../../constants/colors.js";

/**
 * Topic text with hover tooltip (desktop) and tap tooltip (mobile).
 *
 * @param {Object} props
 * @param {string} props.topic
 * @param {import('react').CSSProperties} [props.style]
 */
export function TopicLabel({ topic, style }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{ position: "relative", minWidth: 0, ...style }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onPointerUp={(e) => {
        if (e.pointerType === "touch") setOpen((s) => !s);
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {topic}
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 4,
            zIndex: 200,
            background: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: "8px 12px",
            fontSize: 12,
            color: C.text,
            whiteSpace: "normal",
            maxWidth: 320,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          {topic}
        </div>
      )}
    </div>
  );
}
