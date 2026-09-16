/**
 * Premium SVG avatar generator — deterministic, no external API required.
 *
 * Each user gets a unique gradient + geometric accent that is consistent
 * across sessions. Designed to look like a high-end fintech product.
 */

function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Rich dark-base palettes: [bgFrom, bgTo, accent, textColor]
const PALETTES = [
  ['#1a1040', '#2d1b69', '#8B5CF6', '#EDE9FE'],  // violet
  ['#0d1f3c', '#1a3a6b', '#3B82F6', '#DBEAFE'],  // royal blue
  ['#0a2520', '#0f3b30', '#10B981', '#D1FAE5'],  // emerald
  ['#1f0d20', '#3b1040', '#EC4899', '#FCE7F3'],  // rose
  ['#1a0f00', '#3d2200', '#F59E0B', '#FEF3C7'],  // amber
  ['#0a1a20', '#0f3040', '#06B6D4', '#CFFAFE'],  // cyan
  ['#1a0808', '#3d1515', '#EF4444', '#FEE2E2'],  // red
  ['#0a0f20', '#0f1e3d', '#6366F1', '#E0E7FF'],  // indigo
  ['#0f1a10', '#1f3a22', '#22C55E', '#DCFCE7'],  // green
  ['#1f1010', '#3d1f10', '#F97316', '#FFEDD5'],  // orange
];

export function generateAvatarSvg(uid = '', name = '', size = 64) {
  const seed  = hash32((uid || '') + (name || ''));
  const pal   = PALETTES[seed % PALETTES.length];
  const [bgFrom, bgTo, accent, textColor] = pal;

  const letter = initials(name);
  const r      = size / 2;
  const fs     = size * 0.38;
  const gid    = `g${(seed >>> 0).toString(16)}`;

  // Subtle geometric corner accent (quarter-circle arc)
  const arcR   = r * 1.15;
  const arcX   = r + arcR * Math.cos((seed * 47 % 360) * Math.PI / 180);
  const arcY   = r + arcR * Math.sin((seed * 47 % 360) * Math.PI / 180);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgFrom}"/>
      <stop offset="100%" stop-color="${bgTo}"/>
    </linearGradient>
    <clipPath id="clip${gid}">
      <circle cx="${r}" cy="${r}" r="${r}"/>
    </clipPath>
  </defs>
  <circle cx="${r}" cy="${r}" r="${r}" fill="url(#${gid})"/>
  <g clip-path="url(#clip${gid})">
    <circle cx="${r * 0.15}" cy="${r * 0.15}" r="${r * 0.9}" fill="${accent}" fill-opacity="0.07"/>
    <circle cx="${r * 1.85}" cy="${r * 1.85}" r="${r * 0.75}" fill="${accent}" fill-opacity="0.08"/>
    <circle cx="${r}" cy="${r}" r="${r * 0.92}" fill="none" stroke="${accent}" stroke-width="${size * 0.018}" stroke-opacity="0.25"/>
    <circle cx="${r}" cy="${r}" r="${r * 0.72}" fill="none" stroke="${accent}" stroke-width="${size * 0.010}" stroke-opacity="0.15" stroke-dasharray="${size * 0.05} ${size * 0.04}"/>
  </g>
  <text x="${r}" y="${r}" dy="0.36em"
    text-anchor="middle"
    font-family="-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Helvetica,sans-serif"
    font-size="${fs}"
    font-weight="700"
    fill="${textColor}"
    letter-spacing="-0.02em">${letter}</text>
</svg>`;

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

export function getAvatarUrl(user) {
  if (user?.photoURL) return user.photoURL;
  return generateAvatarSvg(user?.id || user?.uid || '', user?.name || user?.displayName || '');
}
