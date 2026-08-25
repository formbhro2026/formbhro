import { useEffect, useState } from "react";

/**
 * Height of the visual viewport (shrinks when the on-screen keyboard opens)
 * and the keyboard inset in px. Returns null height before hydration.
 */
export function useVisualViewport() {
  const [height, setHeight] = useState<number | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setHeight(vv.height);
      setKeyboardInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return { height, keyboardInset, keyboardOpen: keyboardInset > 120 };
}
