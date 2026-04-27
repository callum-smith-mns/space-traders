import { useEffect, useRef, useMemo, useCallback } from 'react';

// --- Types ---
interface Star {
  x: number;
  y: number;
  r: number;
  opacity: number;
  layer: number; // 0 = far, 1 = mid, 2 = near
  twinkleSpeed: number;
  twinkleOffset: number;
}

interface Constellation {
  stars: number[]; // indices into the star array
  layer: number;
}

interface Nebula {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  color: string;
  opacity: number;
}

// --- Nebula palette: subtle cool hues centered on cyan ---
const NEBULA_COLORS = [
  '#006858', // muted cyan
  '#005068', // deep blue-cyan
  '#304878', // dusky blue
  '#004848', // dark teal
  '#283060', // muted indigo
  '#006050', // sea teal
  '#402858', // faint violet
  '#005870', // ocean blue
];

// --- Seeded random for deterministic star placement ---
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Generate stars ---
function generateStars(
  width: number,
  height: number,
  count: number,
  rng: () => number
): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const layer = rng() < 0.55 ? 0 : rng() < 0.7 ? 1 : 2;
    const baseR = layer === 0 ? 0.4 : layer === 1 ? 0.7 : 1.1;
    stars.push({
      x: rng() * width,
      y: rng() * height,
      r: baseR + rng() * (layer === 2 ? 0.8 : 0.4),
      opacity: 0.3 + rng() * 0.7,
      layer,
      twinkleSpeed: 2 + rng() * 5,
      twinkleOffset: rng() * Math.PI * 2,
    });
  }
  return stars;
}

// --- Generate constellations by connecting nearby stars ---
function generateConstellations(
  stars: Star[],
  rng: () => number
): Constellation[] {
  const constellations: Constellation[] = [];
  const used = new Set<number>();

  // Only use layer 1 & 2 stars for constellations (brighter ones)
  const candidates = stars
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.layer >= 1);

  for (const { s: seed, i: seedIdx } of candidates) {
    if (used.has(seedIdx) || rng() > 0.15) continue;

    const group: number[] = [seedIdx];
    used.add(seedIdx);

    // Find nearby stars to connect
    const nearby = candidates
      .filter(({ i }) => !used.has(i))
      .map(({ s: other, i }) => ({
        i,
        dist: Math.hypot(other.x - seed.x, other.y - seed.y),
      }))
      .filter(({ dist }) => dist < 180 && dist > 30)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 2 + Math.floor(rng() * 3));

    for (const { i } of nearby) {
      group.push(i);
      used.add(i);
    }

    if (group.length >= 2) {
      constellations.push({ stars: group, layer: seed.layer });
    }
  }

  return constellations;
}

// --- Generate nebulae: layered clouds for galaxy depth ---
function generateNebulae(
  width: number,
  height: number,
  rng: () => number
): Nebula[] {
  const nebulae: Nebula[] = [];

  // Large diffuse background washes (2-3)
  const bgCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < bgCount; i++) {
    const size = 400 + rng() * 500;
    nebulae.push({
      x: rng() * width,
      y: rng() * height,
      rx: size + rng() * 200,
      ry: size * (0.4 + rng() * 0.5),
      rotation: rng() * 360,
      color: NEBULA_COLORS[Math.floor(rng() * NEBULA_COLORS.length)],
      opacity: 0.09 + rng() * 0.08,
    });
  }

  // Medium nebula clusters (3-5)
  const midCount = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < midCount; i++) {
    const size = 180 + rng() * 320;
    nebulae.push({
      x: rng() * width,
      y: rng() * height,
      rx: size + rng() * 120,
      ry: size * (0.5 + rng() * 0.6),
      rotation: rng() * 360,
      color: NEBULA_COLORS[Math.floor(rng() * NEBULA_COLORS.length)],
      opacity: 0.12 + rng() * 0.08,
    });
  }

  // Small subtle blooms (3-4)
  const bloomCount = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < bloomCount; i++) {
    const size = 60 + rng() * 140;
    nebulae.push({
      x: rng() * width,
      y: rng() * height,
      rx: size,
      ry: size * (0.6 + rng() * 0.4),
      rotation: rng() * 360,
      color: NEBULA_COLORS[Math.floor(rng() * NEBULA_COLORS.length)],
      opacity: 0.15 + rng() * 0.1,
    });
  }

  return nebulae;
}

// --- Parallax multipliers per layer ---
const PARALLAX = [0.002, 0.006, 0.012]; // far → near

export default function StarField() {
  const svgRef = useRef<SVGSVGElement>(null);
  const layerRefs = useRef<(SVGGElement | null)[]>([null, null, null]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const sizeRef = useRef({ w: window.innerWidth, h: window.innerHeight });

  // Generate star data (memoised, only depends on viewport size bucket)
  const { stars, constellations, nebulae } = useMemo(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const area = w * h;
    const count = Math.min(600, Math.max(200, Math.floor(area / 3500)));
    const rng = mulberry32(42);
    const stars = generateStars(w, h, count, rng);
    const constellations = generateConstellations(stars, rng);
    const nebulae = generateNebulae(w, h, rng);
    return { stars, constellations, nebulae };
  }, []);

  // Mouse tracking
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const cx = sizeRef.current.w / 2;
    const cy = sizeRef.current.h / 2;
    mouseRef.current = {
      x: (e.clientX - cx) / cx, // -1 to 1
      y: (e.clientY - cy) / cy,
    };
  }, []);

  // Animation loop — direct tracking, no lerp
  useEffect(() => {
    const animate = () => {
      const { x, y } = mouseRef.current;
      for (let layer = 0; layer < 3; layer++) {
        const g = layerRefs.current[layer];
        if (!g) continue;
        const px = x * PARALLAX[layer] * sizeRef.current.w;
        const py = y * PARALLAX[layer] * sizeRef.current.h;
        g.style.transform = `translate(${px}px, ${py}px)`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleMouseMove]);

  // Handle resize
  useEffect(() => {
    const onResize = () => {
      sizeRef.current = { w: window.innerWidth, h: window.innerHeight };
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Group stars by layer
  const layers = useMemo(() => {
    const l: Star[][] = [[], [], []];
    stars.forEach((s) => l[s.layer].push(s));
    return l;
  }, [stars]);

  // Group constellation lines by layer
  const constellationsByLayer = useMemo(() => {
    const cl: Constellation[][] = [[], [], []];
    constellations.forEach((c) => cl[c.layer].push(c));
    return cl;
  }, [constellations]);

  return (
    <>
      {/* Nebulae — static div layer, no SVG filters, zero per-frame cost */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        {nebulae.map((n, i) => (
          <div
            key={`neb-${i}`}
            style={{
              position: 'absolute',
              left: n.x - n.rx,
              top: n.y - n.ry,
              width: n.rx * 2,
              height: n.ry * 2,
              borderRadius: '50%',
              background: `radial-gradient(ellipse at center, ${n.color} 0%, transparent 70%)`,
              opacity: n.opacity,
              transform: `rotate(${n.rotation}deg)`,
              filter: 'blur(40px)',
              mixBlendMode: 'screen',
            }}
          />
        ))}
      </div>

      <svg
      ref={svgRef}
      className="starfield"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        background: 'transparent',
      }}
    >
      <defs>
        {/* Radial glow for brighter stars */}
        <radialGradient id="star-glow-0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#c8e8ff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#c8e8ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="star-glow-1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="40%" stopColor="#d0f0ea" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#d0f0ea" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="star-glow-2">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="30%" stopColor="#00e8d0" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#00e8d0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {[0, 1, 2].map((layer) => (
        <g
          key={layer}
          ref={(el) => { layerRefs.current[layer] = el; }}
          style={{ willChange: 'transform' }}
        >
          {/* Constellation lines */}
          {constellationsByLayer[layer].map((c, ci) => {
            const pathParts: string[] = [];
            for (let i = 0; i < c.stars.length - 1; i++) {
              const a = stars[c.stars[i]];
              const b = stars[c.stars[i + 1]];
              pathParts.push(`M${a.x},${a.y}L${b.x},${b.y}`);
            }
            return (
              <path
                key={`c-${layer}-${ci}`}
                d={pathParts.join('')}
                stroke="rgba(100, 180, 200, 0.08)"
                strokeWidth={layer === 2 ? 1 : 0.5}
                fill="none"
              />
            );
          })}

          {/* Stars */}
          {layers[layer].map((star, i) => (
            <g key={`s-${layer}-${i}`}>
              {/* Glow halo for mid/near stars */}
              {layer >= 1 && (
                <circle
                  cx={star.x}
                  cy={star.y}
                  r={star.r * (layer === 2 ? 5 : 3)}
                  fill={`url(#star-glow-${layer})`}
                  opacity={star.opacity * 0.5}
                >
                  <animate
                    attributeName="opacity"
                    values={`${star.opacity * 0.3};${star.opacity * 0.6};${star.opacity * 0.3}`}
                    dur={`${star.twinkleSpeed}s`}
                    begin={`${star.twinkleOffset}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Star core */}
              <circle
                cx={star.x}
                cy={star.y}
                r={star.r}
                fill={layer === 2 ? '#e0f8f4' : layer === 1 ? '#d8e8f0' : '#a0b0c0'}
              >
                <animate
                  attributeName="opacity"
                  values={`${star.opacity};${star.opacity * 0.4};${star.opacity}`}
                  dur={`${star.twinkleSpeed}s`}
                  begin={`${star.twinkleOffset}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </g>
      ))}
    </svg>
    </>
  );
}
