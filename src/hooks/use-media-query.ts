import { useEffect, useState } from "react";

/** Whether a CSS media query matches now and as the window changes (rotation, resize). Correct from the first render. */
export function useMediaQuery(query: string): boolean {
  const read = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(read);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Width from which the portal shows the side menu; below it the menu is a drawer opened from the top bar. */
export const DESKTOP_QUERY = "(min-width: 1024px)";

/** Width from which the long lists (practices, clients, users) are tables; below it every row is a card. A table needs about 960px of content next to the side menu. */
export const TABLE_QUERY = "(min-width: 1280px)";
