/**
 * @fileoverview Horizontal navigation bar with section jump buttons and a search input.
 * Purely presentational — no context dependency.
 * @module components/TextTabNavBar
 */

import { C } from "../../constants/colors.js";

/**
 * @param {Object}   props
 * @param {Array}    props.navItems      - [{ key, label, count }] filtered to visible sections.
 * @param {string}   props.activeSection - Key of the currently scrolled-to section.
 * @param {function} props.isCollapsed   - (key) => boolean
 * @param {string}   props.search        - Current search query.
 * @param {function} props.onSearch      - Called with the new query string.
 * @param {function} props.onNavigate    - Called with the section key when a pill is clicked.
 */
export function NavBar({
  navItems,
  activeSection,
  isCollapsed,
  search,
  onSearch,
  onNavigate,
}) {
  if (!navItems.length) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        minHeight: "2em",
        padding: "4px",
        borderBottom: `1px solid ${C.border}`,
        background: C.bg,
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
      {navItems.map((item) => {
        const isActive = activeSection === item.key && !isCollapsed(item.key);
        return (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            style={{
              height: "2em",
              boxSizing: "border-box",
              padding: "0 8px",
              lineHeight: "2em",
              borderRadius: 10,
              fontSize: 11,
              cursor: "pointer",
              border: `1px solid ${isActive ? C.text : C.border}`,
              background: isActive ? C.border : "transparent",
              color: isActive ? C.text : C.dim,
              fontWeight: isActive ? "bold" : "normal",
              transition: "all 0.15s",
            }}
          >
            {item.label}
            {item.count != null ? ` ${item.count}` : ""}
          </button>
        );
      })}
      <input
        type="search"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search…"
        style={{
          marginLeft: "auto",
          height: "2em",
          boxSizing: "border-box",
          padding: "0 7px",
          lineHeight: "2em",
          borderRadius: 10,
          fontSize: 16,
          border: `1px solid ${search ? C.text : C.border}`,
          background: "transparent",
          color: C.text,
          outline: "none",
          width: "30%",
        }}
      />
    </div>
  );
}
