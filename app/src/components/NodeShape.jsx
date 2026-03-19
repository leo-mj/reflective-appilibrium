// Renders the correct SVG shape for an element's type:
//   judgment  → circle, principle → rounded rect, theory → diamond.
export function NodeShape({ e, r, fill, stroke, op }) {
  if (e.type === "principle") {
    const rw = r * 2.2, rh = r * 1.5;
    return <rect width={rw} height={rh} x={-rw / 2} y={-rh / 2} rx={8} fill={fill} stroke={stroke} strokeWidth={2} opacity={op} />;
  }
  if (e.type === "theory") {
    return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill={fill} stroke={stroke} strokeWidth={2} opacity={op} />;
  }
  return <circle r={r} fill={fill} stroke={stroke} strokeWidth={2} opacity={op} />;
}
