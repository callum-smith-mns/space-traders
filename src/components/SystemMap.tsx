import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { Waypoint } from '../services/api';
import './SystemMap.css';

interface SystemMapProps {
  waypoints: Waypoint[];
  currentWaypoint?: string;
}

/* ── Visual config per waypoint type ── */
interface WpStyle {
  radius: number;
  color: string;
  glow: number;     // shadow blur
  glowColor: string;
  label: string;
}

const WP_STYLES: Record<string, WpStyle> = {
  PLANET:           { radius: 10, color: '#40b0ff', glow: 14, glowColor: 'rgba(64,176,255,0.55)', label: 'Planet' },
  GAS_GIANT:        { radius: 13, color: '#d68840', glow: 16, glowColor: 'rgba(214,136,64,0.50)', label: 'Gas Giant' },
  MOON:             { radius: 4,  color: '#b0b8c8', glow: 4,  glowColor: 'rgba(176,184,200,0.30)', label: 'Moon' },
  ORBITAL_STATION:  { radius: 5,  color: '#00e8d0', glow: 8,  glowColor: 'rgba(0,232,208,0.40)', label: 'Station' },
  JUMP_GATE:        { radius: 7,  color: '#c47aff', glow: 12, glowColor: 'rgba(196,122,255,0.45)', label: 'Jump Gate' },
  FUEL_STATION:     { radius: 5,  color: '#ffcc00', glow: 6,  glowColor: 'rgba(255,204,0,0.35)', label: 'Fuel' },
  ASTEROID:         { radius: 3,  color: '#7a7a7a', glow: 0,  glowColor: 'transparent', label: 'Asteroid' },
  ASTEROID_BASE:    { radius: 4,  color: '#9a8870', glow: 2,  glowColor: 'rgba(154,136,112,0.20)', label: 'Asteroid Base' },
  ENGINEERED_ASTEROID: { radius: 5, color: '#aaa070', glow: 4, glowColor: 'rgba(170,160,112,0.25)', label: 'Eng. Asteroid' },
  ASTEROID_FIELD:   { radius: 3,  color: '#6a6a6a', glow: 0,  glowColor: 'transparent', label: 'Asteroid Field' },
  NEBULA:           { radius: 12, color: '#a060d0', glow: 18, glowColor: 'rgba(160,96,208,0.40)', label: 'Nebula' },
  GRAVITY_WELL:     { radius: 8,  color: '#ff5060', glow: 10, glowColor: 'rgba(255,80,96,0.40)', label: 'Gravity Well' },
};

const DEFAULT_STYLE: WpStyle = { radius: 4, color: '#888', glow: 0, glowColor: 'transparent', label: '?' };

function getStyle(type: string): WpStyle {
  return WP_STYLES[type] ?? DEFAULT_STYLE;
}

/* ── Cluster waypoints by prefix letter ── */
interface Cluster {
  key: string;
  waypoints: Waypoint[];
  cx: number;
  cy: number;
}

function clusterWaypoints(waypoints: Waypoint[]): Cluster[] {
  const groups = new Map<string, Waypoint[]>();
  for (const wp of waypoints) {
    // Symbol format: SYSTEM-XX where XX starts with a letter or digit
    // Extract the suffix after the system prefix (everything after second hyphen)
    const parts = wp.symbol.split('-');
    const suffix = parts.length >= 3 ? parts[2] : wp.symbol;
    const key = suffix.charAt(0).toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(wp);
  }
  const clusters: Cluster[] = [];
  for (const [key, wps] of groups) {
    const cx = wps.reduce((s, w) => s + w.x, 0) / wps.length;
    const cy = wps.reduce((s, w) => s + w.y, 0) / wps.length;
    clusters.push({ key, waypoints: wps, cx, cy });
  }
  return clusters;
}

/* ── Build an orbital-parent lookup ── */
function buildOrbitalMap(waypoints: Waypoint[]): Map<string, string> {
  // Maps moon symbol → parent symbol
  const map = new Map<string, string>();
  for (const wp of waypoints) {
    for (const orb of wp.orbitals) {
      map.set(orb.symbol, wp.symbol);
    }
  }
  return map;
}

/* ── Component ── */
export default function SystemMap({ waypoints, currentWaypoint }: SystemMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Camera state
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, cx: 0, cy: 0 });

  // Tooltip
  const [tooltip, setTooltip] = useState<{ x: number; y: number; wp: Waypoint } | null>(null);

  const clusters = useMemo(() => clusterWaypoints(waypoints), [waypoints]);
  const orbitalMap = useMemo(() => buildOrbitalMap(waypoints), [waypoints]);
  const wpLookup = useMemo(() => {
    const m = new Map<string, Waypoint>();
    waypoints.forEach(w => m.set(w.symbol, w));
    return m;
  }, [waypoints]);

  const currentWp = currentWaypoint ? wpLookup.get(currentWaypoint) : undefined;

  // Auto-center on current waypoint or system center
  useEffect(() => {
    if (waypoints.length === 0) return;
    const target = currentWp ?? {
      x: waypoints.reduce((s, w) => s + w.x, 0) / waypoints.length,
      y: waypoints.reduce((s, w) => s + w.y, 0) / waypoints.length,
    };
    const canvas = canvasRef.current;
    if (!canvas) return;
    setCamera({ x: target.x, y: target.y, zoom: 1 });
  }, [waypoints, currentWp]);

  // Convert world coords → screen coords
  const worldToScreen = useCallback((wx: number, wy: number, cam: typeof camera, cw: number, ch: number) => {
    return {
      sx: (wx - cam.x) * cam.zoom + cw / 2,
      sy: (wy - cam.y) * cam.zoom + ch / 2,
    };
  }, []);

  const screenToWorld = useCallback((sx: number, sy: number, cam: typeof camera, cw: number, ch: number) => {
    return {
      wx: (sx - cw / 2) / cam.zoom + cam.x,
      wy: (sy - ch / 2) / cam.zoom + cam.y,
    };
  }, []);

  // ── Draw ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const cw = rect.width;
    const ch = rect.height;

    // Clear
    ctx.clearRect(0, 0, cw, ch);

    const cam = camera;
    const toScreen = (wx: number, wy: number) => worldToScreen(wx, wy, cam, cw, ch);

    // ── Draw cluster boundaries ──
    ctx.save();
    for (const cluster of clusters) {
      if (cluster.waypoints.length < 2) continue;
      // Find bounding box of cluster
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const wp of cluster.waypoints) {
        minX = Math.min(minX, wp.x);
        minY = Math.min(minY, wp.y);
        maxX = Math.max(maxX, wp.x);
        maxY = Math.max(maxY, wp.y);
      }
      const pad = 20;
      const topLeft = toScreen(minX - pad, minY - pad);
      const bottomRight = toScreen(maxX + pad, maxY + pad);
      const w = bottomRight.sx - topLeft.sx;
      const h = bottomRight.sy - topLeft.sy;

      ctx.strokeStyle = 'rgba(0, 232, 208, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.roundRect(topLeft.sx, topLeft.sy, w, h, 8 * cam.zoom);
      ctx.stroke();

      // Cluster label
      ctx.setLineDash([]);
      ctx.font = `${Math.max(9, 11 * cam.zoom)}px var(--font-display, monospace)`;
      ctx.fillStyle = 'rgba(0, 232, 208, 0.25)';
      ctx.textAlign = 'center';
      const labelPos = toScreen(cluster.cx, minY - pad - 8);
      ctx.fillText(`Cluster ${cluster.key}`, labelPos.sx, labelPos.sy);
    }
    ctx.restore();

    // ── Draw connection lines from current location to each cluster center ──
    if (currentWp) {
      const fromScreen = toScreen(currentWp.x, currentWp.y);
      ctx.save();
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 1;
      for (const cluster of clusters) {
        // Skip the cluster our ship is in
        const shipInCluster = cluster.waypoints.some(w => w.symbol === currentWaypoint);
        if (shipInCluster) continue;
        const to = toScreen(cluster.cx, cluster.cy);
        const grad = ctx.createLinearGradient(fromScreen.sx, fromScreen.sy, to.sx, to.sy);
        grad.addColorStop(0, 'rgba(0, 232, 208, 0.30)');
        grad.addColorStop(1, 'rgba(0, 232, 208, 0.05)');
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(fromScreen.sx, fromScreen.sy);
        ctx.lineTo(to.sx, to.sy);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ── Draw orbital links (moon → parent) ──
    ctx.save();
    ctx.strokeStyle = 'rgba(176, 184, 200, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    for (const [moonSym, parentSym] of orbitalMap) {
      const moonWp = wpLookup.get(moonSym);
      const parentWp = wpLookup.get(parentSym);
      if (!moonWp || !parentWp) continue;
      const m = toScreen(moonWp.x, moonWp.y);
      const p = toScreen(parentWp.x, parentWp.y);
      ctx.beginPath();
      ctx.moveTo(m.sx, m.sy);
      ctx.lineTo(p.sx, p.sy);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    // ── Draw each waypoint ──
    // Draw smaller/less important first, then planets on top
    const sorted = [...waypoints].sort((a, b) => {
      const sa = getStyle(a.type);
      const sb = getStyle(b.type);
      return sa.radius - sb.radius;
    });

    for (const wp of sorted) {
      const style = getStyle(wp.type);
      const { sx, sy } = toScreen(wp.x, wp.y);
      const r = style.radius * Math.max(0.6, Math.min(cam.zoom, 2));
      const isCurrent = wp.symbol === currentWaypoint;

      // Glow
      if (style.glow > 0) {
        ctx.save();
        ctx.shadowBlur = style.glow * Math.min(cam.zoom, 1.5);
        ctx.shadowColor = style.glowColor;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = style.color;
        ctx.fill();
        ctx.restore();
      }

      // Body
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = style.color;
      ctx.fill();

      // Highlight ring for current waypoint
      if (isCurrent) {
        ctx.save();
        ctx.strokeStyle = '#00e8d0';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(0, 232, 208, 0.6)';
        ctx.beginPath();
        ctx.arc(sx, sy, r + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Moon orbital ring around parent
      if (wp.type === 'MOON') {
        const parentSym = orbitalMap.get(wp.symbol);
        if (parentSym) {
          const parentWp = wpLookup.get(parentSym);
          if (parentWp) {
            const p = toScreen(parentWp.x, parentWp.y);
            const orbitR = Math.sqrt((sx - p.sx) ** 2 + (sy - p.sy) ** 2);
            ctx.save();
            ctx.strokeStyle = 'rgba(176, 184, 200, 0.10)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.arc(p.sx, p.sy, orbitR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Asteroid field scatter dots
      if (wp.type === 'ASTEROID_FIELD' || wp.type === 'ASTEROID') {
        ctx.save();
        ctx.fillStyle = 'rgba(120, 120, 120, 0.3)';
        // Seeded scatter based on position
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2 + wp.x * 0.1;
          const dist = r + 3 + (i % 3) * 2;
          ctx.beginPath();
          ctx.arc(sx + Math.cos(angle) * dist, sy + Math.sin(angle) * dist, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Label (only show when zoomed in enough)
      if (cam.zoom >= 0.6) {
        ctx.save();
        const fontSize = Math.max(7, 9 * cam.zoom);
        ctx.font = `${fontSize}px var(--font-mono, monospace)`;
        ctx.fillStyle = isCurrent ? '#00e8d0' : 'rgba(200, 210, 230, 0.55)';
        ctx.textAlign = 'center';
        const shortLabel = wp.symbol.split('-').pop() ?? wp.symbol;
        ctx.fillText(shortLabel, sx, sy + r + fontSize + 2);
        // Type label below
        if (cam.zoom >= 1.2) {
          const typeSize = Math.max(6, 7 * cam.zoom);
          ctx.font = `${typeSize}px var(--font-display, monospace)`;
          ctx.fillStyle = 'rgba(200, 210, 230, 0.25)';
          ctx.fillText(getStyle(wp.type).label, sx, sy + r + fontSize + typeSize + 4);
        }
        ctx.restore();
      }
    }

  }, [camera, waypoints, clusters, orbitalMap, wpLookup, currentWaypoint, currentWp, worldToScreen]);

  // ── Mouse interactions ──
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCamera(prev => {
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(0.15, Math.min(8, prev.zoom * factor));
      // Zoom toward mouse position
      const canvas = canvasRef.current;
      if (!canvas) return { ...prev, zoom: newZoom };
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cw = rect.width;
      const ch = rect.height;
      // World coords under cursor before zoom
      const wx = (mx - cw / 2) / prev.zoom + prev.x;
      const wy = (my - ch / 2) / prev.zoom + prev.y;
      // Adjust camera so same world point stays under cursor
      const newX = wx - (mx - cw / 2) / newZoom;
      const newY = wy - (my - ch / 2) / newZoom;
      return { x: newX, y: newY, zoom: newZoom };
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
  }, [camera]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setCamera(prev => ({
        ...prev,
        x: dragStart.current.cx - dx / prev.zoom,
        y: dragStart.current.cy - dy / prev.zoom,
      }));
      setTooltip(null);
      return;
    }

    // Hit test for tooltip
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cw = rect.width;
    const ch = rect.height;

    let hit: Waypoint | null = null;
    for (const wp of waypoints) {
      const sx = (wp.x - camera.x) * camera.zoom + cw / 2;
      const sy = (wp.y - camera.y) * camera.zoom + ch / 2;
      const r = getStyle(wp.type).radius * Math.max(0.6, Math.min(camera.zoom, 2));
      const hitR = Math.max(r + 4, 8);
      if (Math.abs(mx - sx) < hitR && Math.abs(my - sy) < hitR) {
        hit = wp;
        break;
      }
    }
    if (hit) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, wp: hit });
    } else {
      setTooltip(null);
    }
  }, [waypoints, camera]);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleMouseLeave = useCallback(() => {
    dragging.current = false;
    setTooltip(null);
  }, []);

  // Zoom controls
  const zoomIn = useCallback(() => {
    setCamera(prev => ({ ...prev, zoom: Math.min(8, prev.zoom * 1.4) }));
  }, []);
  const zoomOut = useCallback(() => {
    setCamera(prev => ({ ...prev, zoom: Math.max(0.15, prev.zoom / 1.4) }));
  }, []);
  const zoomReset = useCallback(() => {
    if (waypoints.length === 0) return;
    const target = currentWp ?? {
      x: waypoints.reduce((s, w) => s + w.x, 0) / waypoints.length,
      y: waypoints.reduce((s, w) => s + w.y, 0) / waypoints.length,
    };
    setCamera({ x: target.x, y: target.y, zoom: 1 });
  }, [waypoints, currentWp]);

  if (waypoints.length === 0) {
    return <div className="sysmap-empty">No waypoints loaded.</div>;
  }

  return (
    <div className="sysmap" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="sysmap-canvas"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      {/* Zoom controls */}
      <div className="sysmap-controls">
        <button className="sysmap-ctrl-btn" onClick={zoomIn} title="Zoom in">+</button>
        <button className="sysmap-ctrl-btn" onClick={zoomOut} title="Zoom out">−</button>
        <button className="sysmap-ctrl-btn sysmap-ctrl-btn--reset" onClick={zoomReset} title="Reset view">⊙</button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="sysmap-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
        >
          <div className="sysmap-tooltip-name">{tooltip.wp.symbol.split('-').pop()}</div>
          <div className="sysmap-tooltip-type">{getStyle(tooltip.wp.type).label}</div>
          <div className="sysmap-tooltip-coords">
            {tooltip.wp.x}, {tooltip.wp.y}
          </div>
          {tooltip.wp.traits.length > 0 && (
            <div className="sysmap-tooltip-traits">
              {tooltip.wp.traits.slice(0, 3).map(t => t.name).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="sysmap-legend">
        {['PLANET', 'GAS_GIANT', 'MOON', 'ORBITAL_STATION', 'JUMP_GATE', 'ASTEROID_FIELD'].map(type => {
          const s = getStyle(type);
          return (
            <div key={type} className="sysmap-legend-item">
              <span
                className="sysmap-legend-dot"
                style={{
                  background: s.color,
                  width: Math.max(6, s.radius),
                  height: Math.max(6, s.radius),
                  boxShadow: s.glow > 0 ? `0 0 ${s.glow / 2}px ${s.glowColor}` : 'none',
                }}
              />
              <span className="sysmap-legend-label">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
