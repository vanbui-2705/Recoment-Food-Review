import { useEffect, useState } from "react";

/**
 * Custom hook to detect whether the current client is on a mobile device or viewport.
 * Considers viewport width (< 768px) and user-agent / touch support.
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    const widthCheck = window.innerWidth < breakpoint;
    const uaCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );
    return widthCheck || uaCheck;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = (e) => {
      const isNarrow = e.matches;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      );
      setIsMobile(isNarrow || isMobileUA);
    };

    // Initial check
    update(mediaQuery);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    } else {
      mediaQuery.addListener(update);
      return () => mediaQuery.removeListener(update);
    }
  }, [breakpoint]);

  return isMobile;
}
