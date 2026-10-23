/** Star-burst clip-path with `points` spikes, for sound-effect bursts and finisher tags. */
export const starburst = (points = 14, inner = 36, outer = 50): string => {
  const verts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    verts.push(`${(50 + r * Math.cos(a)).toFixed(1)}% ${(50 + r * Math.sin(a)).toFixed(1)}%`);
  }
  return `polygon(${verts.join(', ')})`;
};

export const STAR_CLIP = starburst();
