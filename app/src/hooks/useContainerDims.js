import { useState, useEffect } from "react";

// Hook: tracks the pixel width and height of a DOM element, updating on resize.
export function useContainerDims(ref) {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const measure = () => {
      if (ref.current) {
        const { clientWidth, clientHeight } = ref.current;
        setDims({ w: clientWidth || 700, h: Math.max(400, clientHeight) });
      }
    };
    measure();
    const timer = setTimeout(measure, 50);
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => { clearTimeout(timer); ro.disconnect(); };
  }, [ref]);
  return dims;
}
