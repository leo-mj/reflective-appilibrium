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

export function HistoryIcon({ size = "2em" }) {
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

      {/* <rect x="16" y="16" width="480" height="480" rx="96" fill="url(#bgGradient)" /> */}

      <g
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M180 220a100 100 0 1 1 -10 90" />
        <polyline points="170,190 180,220 210,210" />
      </g>

      <g stroke="currentColor" strokeWidth="8" strokeLinecap="round">
        <line x1="256" y1="256" x2="256" y2="220" />
        <line x1="256" y1="256" x2="292" y2="256" />
      </g>
    </svg>
  );
}

export function ClusterIcon({ size = "2em" }) {
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
      <g stroke="currentColor" strokeWidth="26" strokeLinecap="round" fill="none">
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      strokeLinejoin="round" style={{ display: "block" }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function XIcon({ size = "1em" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ display: "block" }}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function EditIcon({ size = "1em" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" style={{ display: "block" }}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function SimulateIcon({ size = "2em" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: "block" }}>
      <g stroke="currentColor" strokeWidth="28" strokeLinecap="round" strokeLinejoin="round" fill="none">
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" style={{ display: "block" }}>
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" style={{ display: "block" }}>
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

/** The same arrows pulled back in: leave the expanded view. */
export function CollapseIcon({ size = "1em" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" style={{ display: "block" }}>
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
