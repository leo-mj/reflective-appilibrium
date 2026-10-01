export function SpinnerIcon({ size = 13 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid rgba(255,255,255,0.2)",
        borderTopColor: "currentColor",
        animation: "spin 0.8s linear infinite",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}

export function NetworkIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -40 512 512"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2ec4b6" />
          <stop offset="100%" stopColor="#7b2cbf" />
        </linearGradient>
      </defs>

      {/* <rect x="16" y="16" width="480" height="480" rx="96" fill="url(#bgGradient)" /> */}

      <g stroke="currentColor" strokeWidth="8" strokeLinecap="round">
        <line x1="256" y1="256" x2="140" y2="180" />
        <line x1="256" y1="256" x2="372" y2="160" />
        <line x1="256" y1="256" x2="380" y2="340" />
        <line x1="256" y1="256" x2="160" y2="360" />
        <line x1="256" y1="256" x2="260" y2="110" />

        <line x1="140" y1="180" x2="372" y2="160" />
        <line x1="372" y1="160" x2="380" y2="340" />
        <line x1="380" y1="340" x2="160" y2="360" />
        <line x1="160" y1="360" x2="140" y2="180" />
        <line x1="260" y1="110" x2="140" y2="180" />
        <line x1="260" y1="110" x2="372" y2="160" />
      </g>

      <g fill="currentColor">
        <circle cx="256" cy="256" r="40" />
        <circle cx="140" cy="180" r="28" />
        <circle cx="372" cy="160" r="28" />
        <circle cx="380" cy="340" r="28" />
        <circle cx="160" cy="360" r="28" />
        <circle cx="260" cy="110" r="28" />
      </g>
    </svg>
  );
}

/**
 * A clock face with an arrow turning it back: the process, replayed.
 *
 * Drawn at the weight and size of its neighbours. It had a face half their
 * size in lines a third as thick, and beside them on the phone's tiles read as
 * a disabled one.
 */
export function HistoryIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <g
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* Round from left of top, clockwise, to left of bottom; the gap
            between the two ends is where the arrow turns it back. */}
        <path d="M91 196 A176 176 0 1 1 91 316" />
        <polyline points="71,136 91,196 151,176" />
        <line x1="256" y1="256" x2="256" y2="160" />
        <line x1="256" y1="256" x2="326" y2="256" />
      </g>
    </svg>
  );
}

/**
 * Two circles run together, with the dots of both inside: two processes made
 * one. It was the Clusters icon, and reads better as a merge than as a set
 * that holds no conflict.
 */
export function MergeIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <g stroke="currentColor" strokeWidth="22" fill="none">
        <circle cx="190" cy="256" r="148" />
        <circle cx="322" cy="256" r="148" />
      </g>
      <g fill="currentColor">
        <circle cx="130" cy="210" r="26" />
        <circle cx="130" cy="302" r="26" />
        <circle cx="382" cy="210" r="26" />
        <circle cx="382" cy="302" r="26" />
        <circle cx="256" cy="256" r="26" />
      </g>
    </svg>
  );
}

/**
 * Two groups of connected nodes, apart from each other: a position falling
 * into coherent clusters, which is what the tab finds. No rings round them —
 * two rings side by side read as the Merge icon's two circles.
 */
export function ClusterIcon({ size = "2em" }) {
  // Offset vertically and a clear gap apart, so they read as two groups and
  // not as one chain.
  const left = [
    [108, 146],
    [40, 274],
    [176, 274],
  ];
  const right = [
    [336, 238],
    [472, 238],
    [404, 366],
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <g
        stroke="currentColor"
        strokeWidth="24"
        strokeLinejoin="round"
        fill="none"
      >
        <polygon points={left.map((p) => p.join(",")).join(" ")} />
        <polygon points={right.map((p) => p.join(",")).join(" ")} />
      </g>
      <g fill="currentColor">
        {[...left, ...right].map(([cx, cy]) => (
          <circle key={`${cx},${cy}`} cx={cx} cy={cy} r="38" />
        ))}
      </g>
    </svg>
  );
}

/**
 * Two cards, one laid over the other, the front one carrying "=": two elements
 * making the same claim in different words, which is what the Merge Elements
 * tab pairs up. Only the back card's uncovered edges are drawn, so the icon
 * needs no fill of its own and sits on any background.
 */
export function DuplicatesIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <g
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M160 352 H112 a40 40 0 0 1 -40 -40 V112 a40 40 0 0 1 40 -40 H312 a40 40 0 0 1 40 40 V160" />
        <rect x="160" y="160" width="280" height="280" rx="40" />
        <line x1="236" y1="272" x2="364" y2="272" />
        <line x1="236" y1="328" x2="364" y2="328" />
      </g>
    </svg>
  );
}

/**
 * A magnifier over a written page: the process, read back.
 *
 * Deliberately not another node-and-edge glyph — the Review tab is the one place
 * in the Assist group whose output is prose about the graph rather than a change
 * to it, and the icon is the only thing saying so before the panel opens.
 */
export function ReviewIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <g
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M112 64h198l90 90v200a30 30 0 0 1-30 30H112a30 30 0 0 1-30-30V94a30 30 0 0 1 30-30z" />
        <polyline points="306,64 306,158 400,158" />
        <line x1="140" y1="196" x2="240" y2="196" />
        <line x1="140" y1="254" x2="210" y2="254" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="26"
        strokeLinecap="round"
        fill="none"
      >
        <circle cx="286" cy="316" r="72" />
        <line x1="338" y1="368" x2="418" y2="448" />
      </g>
    </svg>
  );
}

export function SuggestIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <g fill="currentColor">
        <circle cx="100" cy="256" r="52" />
        <circle cx="412" cy="256" r="52" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="24"
        strokeLinecap="round"
        fill="none"
      >
        <line x1="160" y1="256" x2="320" y2="256" />
        <polyline points="300,220 340,256 300,292" />
      </g>
      <g stroke="currentColor" strokeWidth="16" strokeLinecap="round">
        <line x1="256" y1="80" x2="256" y2="110" />
        <line x1="256" y1="402" x2="256" y2="432" />
        <line x1="196" y1="100" x2="211" y2="127" />
        <line x1="316" y1="385" x2="301" y2="412" />
      </g>
    </svg>
  );
}

/**
 * A statement card: a box, the node as a dot at its left, lines of wording
 * beside it — what the graph's statement view draws each element as. A picture
 * of the thing rather than a letter, "Aa" being the font setting's.
 */
export function StatementCardIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <rect
        x="40"
        y="116"
        width="432"
        height="280"
        rx="48"
        stroke="currentColor"
        strokeWidth="32"
        fill="none"
      />
      <circle cx="140" cy="256" r="48" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="32" strokeLinecap="round">
        <line x1="232" y1="196" x2="410" y2="196" />
        <line x1="232" y1="256" x2="410" y2="256" />
        <line x1="232" y1="316" x2="340" y2="316" />
      </g>
    </svg>
  );
}

export function JudgmentIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <circle
        cx="256"
        cy="220"
        r="130"
        stroke="currentColor"
        strokeWidth="24"
        fill="none"
      />
      <g stroke="currentColor" strokeWidth="20" strokeLinecap="round">
        <line x1="256" y1="380" x2="256" y2="420" />
        <line x1="210" y1="430" x2="302" y2="430" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M220 200 Q256 160 292 200 Q310 220 256 250 Q256 270 256 285" />
      </g>
      <circle cx="256" cy="310" r="12" fill="currentColor" />
    </svg>
  );
}

export function PrincipleIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <rect
        x="60"
        y="160"
        width="392"
        height="192"
        rx="48"
        stroke="currentColor"
        strokeWidth="24"
        fill="none"
      />
      <g stroke="currentColor" strokeWidth="20" strokeLinecap="round">
        <line x1="140" y1="220" x2="372" y2="220" />
        <line x1="140" y1="256" x2="320" y2="256" />
        <line x1="140" y1="292" x2="256" y2="292" />
      </g>
    </svg>
  );
}

/**
 * Background theories. A diamond, because that is the shape a `T` node is drawn
 * as on the canvas — the icon and the graph should agree about what a theory
 * looks like. The lines inside echo PrincipleIcon's, so the two read as siblings.
 */
export function TheoryIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <path
        d="M256 48 L464 256 L256 464 L48 256 Z"
        stroke="currentColor"
        strokeWidth="24"
        strokeLinejoin="round"
        fill="none"
      />
      <g stroke="currentColor" strokeWidth="20" strokeLinecap="round">
        <line x1="176" y1="224" x2="336" y2="224" />
        <line x1="200" y1="288" x2="312" y2="288" />
      </g>
    </svg>
  );
}

export function AddIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2ec4b6" />
          <stop offset="100%" stopColor="#7b2cbf" />
        </linearGradient>
      </defs>

      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="96"
        fill="url(#bgGradient)"
      />
      <g stroke="currentColor" strokeWidth="60" strokeLinecap="round">
        <line x1="256" y1="100" x2="256" y2="412" />
        <line x1="100" y1="256" x2="412" y2="256" />
      </g>
    </svg>
  );
}

export function CheckIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function XIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ display: "block" }}
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * A counter-clockwise arrow, for leaving an edit as it was.
 *
 * Deliberately not the ✕ that {@link XIcon} gives Reject: the two sit side by
 * side on every suggestion card while one is being edited, where an ✕ on both
 * says "discard this suggestion" twice and means it once.
 */
export function RevertIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <path d="M3.5 12a8.5 8.5 0 1 0 2.9-6.4" />
      <polyline points="3 3 3 6.5 6.5 6.5" />
    </svg>
  );
}

export function EditIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function SimulateIcon({ size = "2em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      style={{ display: "block" }}
    >
      <g
        stroke="currentColor"
        strokeWidth="28"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M360 150 A140 140 0 1 0 390 320" />
        <polyline points="365,288 390,320 358,338" />
      </g>
      <circle cx="256" cy="256" r="36" fill="currentColor" />
    </svg>
  );
}

export function ChatIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

/** A lid, a bin and two strokes: throw this away. */
export function TrashIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/** Arrows pushing out to opposite corners: expand to fill. */
export function ExpandIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

/**
 * Viewfinder corners around three nodes: frame the whole graph. Corners
 * rather than arrows, so it does not read as the full-screen button's
 * {@link ExpandIcon}, which sits on the same canvas.
 */
export function FitIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <polyline points="3 8 3 3 8 3" />
      <polyline points="16 3 21 3 21 8" />
      <polyline points="21 16 21 21 16 21" />
      <polyline points="8 21 3 21 3 16" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <circle cx="15.5" cy="9" r="1.6" fill="currentColor" />
      <circle cx="12" cy="15.5" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** The same arrows pulled back in: leave the expanded view. */
export function CollapseIcon({ size = "1em" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
