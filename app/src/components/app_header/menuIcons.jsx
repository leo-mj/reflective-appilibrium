/**
 * @fileoverview The two drawn glyphs the ☰ menu uses, shared by both layouts.
 *
 * Fixed, like the labels beside them: the theme row used to swap a moon for a
 * sun to announce what clicking would do, which is the job its switch now does.
 *
 * @module components/app_header/menuIcons
 */

/** @param {{children: React.ReactNode}} props */
function Glyph({ children }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      {children}
    </svg>
  );
}

/** Stands for the theme row. */
export const MoonIcon = () => (
  <Glyph>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Glyph>
);

/** Stands for the text panel's nav bar, which carries its search box. */
export const SearchIcon = () => (
  <Glyph>
    <circle cx="11" cy="11" r="7" />
    <line x1="16.5" y1="16.5" x2="22" y2="22" />
  </Glyph>
);
