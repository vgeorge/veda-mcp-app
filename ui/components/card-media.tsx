// Card thumbnail with a designed fallback. Catalog thumbnails are sparse
// (most collections have none) and item previews are unreliable, so a tinted
// "globe" tile replaces the broken-image / flat-gray state.
import type { SyntheticEvent } from "react";

// Deterministic hue per id so every card has a stable, distinct accent.
function hueFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

function placeholderDataUri(hue: number): string {
  const bg = `hsl(${hue}, 50%, 90%)`;
  const fg = `hsl(${hue}, 40%, 50%)`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 18" preserveAspectRatio="xMidYMid slice">` +
    `<rect width="32" height="18" fill="${bg}"/>` +
    `<g fill="none" stroke="${fg}" stroke-width="0.6">` +
    `<circle cx="16" cy="9" r="4.5"/>` +
    `<ellipse cx="16" cy="9" rx="4.5" ry="2"/>` +
    `<ellipse cx="16" cy="9" rx="2" ry="4.5"/>` +
    `<line x1="11.5" y1="9" x2="20.5" y2="9"/>` +
    `</g></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

// Always an <img>: a real thumbnail when we have one, else the tinted globe.
// onError swaps a 404ing thumbnail for the same globe so cards never show a
// broken-image icon.
export function CardMedia({ id, href }: { id: string; href: string | null | undefined }) {
  const fallback = placeholderDataUri(hueFromId(id));
  const onError = (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.src !== fallback) e.currentTarget.src = fallback;
  };
  return <img src={href ?? fallback} alt="" loading="lazy" onError={onError} />;
}
