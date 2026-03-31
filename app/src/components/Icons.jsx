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

export function MatrixIcon({ size = "2em" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
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
        fill="none"
      >
        <path d="M180 160 L150 160 L150 352 L180 352" />
        <path d="M332 160 L362 160 L362 352 L332 352" />
      </g>

      <g fill="currentColor">
        <circle cx="210" cy="200" r="14" />
        <circle cx="256" cy="200" r="14" />
        <circle cx="302" cy="200" r="14" />

        <circle cx="210" cy="256" r="14" />
        <circle cx="256" cy="256" r="14" />
        <circle cx="302" cy="256" r="14" />

        <circle cx="210" cy="312" r="14" />
        <circle cx="256" cy="312" r="14" />
        <circle cx="302" cy="312" r="14" />
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
