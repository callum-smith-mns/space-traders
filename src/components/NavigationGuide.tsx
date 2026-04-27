import { useState, useMemo } from 'react';
import { type Waypoint, type ShipNav } from '../services/api';
import { useWaypoints } from '../hooks/useQueries';
import { formatEta } from '../utils/formatEta';
import SystemMap from './SystemMap';
import LoadingSpinner from './LoadingSpinner';
import './NavigationGuide.css';

interface NavigationGuideProps {
  systemSymbol?: string;
  /** Current ship location — auto-fills origin */
  shipNav?: ShipNav;
  /** Ship engine speed for time estimates */
  engineSpeed?: number;
  /** Ship fuel capacity + current for feasibility */
  fuel?: { current: number; capacity: number };
}

type FlightMode = ShipNav['flightMode'];

const SPEED_MULT: Record<FlightMode, number> = {
  CRUISE: 25,
  DRIFT: 250,
  BURN: 12.5,
  STEALTH: 25,
};

const FUEL_MULT: Record<FlightMode, number> = {
  CRUISE: 1,
  DRIFT: 0,
  BURN: 2,
  STEALTH: 1,
};

interface RouteStep {
  from: Waypoint;
  to: Waypoint;
  distance: number;
  fuel: number;
  time: number;
}

export default function NavigationGuide({
  systemSymbol,
  shipNav,
  engineSpeed = 30,
  fuel,
}: NavigationGuideProps) {
  const { data: waypoints = [], isLoading: loading } = useWaypoints(systemSymbol);
  const [origin, setOrigin] = useState(shipNav?.waypointSymbol ?? '');
  const [destination, setDestination] = useState('');
  const [flightMode, setFlightMode] = useState<FlightMode>('CRUISE');
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'guide' | 'planner'>('map');

  // Sync origin from active ship — adjust state during render (React recommended pattern)
  const [prevShipWaypoint, setPrevShipWaypoint] = useState(shipNav?.waypointSymbol);
  if (shipNav?.waypointSymbol !== prevShipWaypoint) {
    setPrevShipWaypoint(shipNav?.waypointSymbol);
    setOrigin(shipNav?.waypointSymbol ?? '');
  }

  const wpMap = useMemo(() => {
    const m = new Map<string, Waypoint>();
    waypoints.forEach((w) => m.set(w.symbol, w));
    return m;
  }, [waypoints]);

  const originWp = wpMap.get(origin);
  const destWp = wpMap.get(destination);

  // Calculate direct route
  const directRoute = useMemo((): RouteStep | null => {
    if (!originWp || !destWp || origin === destination) return null;
    const dist = Math.round(
      Math.sqrt((destWp.x - originWp.x) ** 2 + (destWp.y - originWp.y) ** 2)
    );
    const fuelCost =
      flightMode === 'DRIFT'
        ? 1
        : Math.max(1, Math.round(dist * FUEL_MULT[flightMode]));
    const time = Math.round(
      15 + (dist * SPEED_MULT[flightMode]) / Math.max(engineSpeed, 1)
    );
    return { from: originWp, to: destWp, distance: dist, fuel: fuelCost, time };
  }, [originWp, destWp, origin, destination, flightMode, engineSpeed]);

  // Multi-hop route via fuel-constrained waypoints (greedy nearest-to-destination that's reachable)
  const multiHopRoute = useMemo((): RouteStep[] | null => {
    if (!originWp || !destWp || origin === destination) return null;
    if (!fuel || !directRoute) return null;
    // Only show multi-hop if direct route exceeds fuel
    if (directRoute.fuel <= fuel.capacity) return null;

    const maxRange = fuel.capacity; // max fuel per hop
    const steps: RouteStep[] = [];
    let current = originWp;
    const visited = new Set<string>();
    visited.add(current.symbol);

    for (let i = 0; i < 20; i++) {
      // Check if we can reach destination directly
      const distToDest = Math.sqrt(
        (destWp.x - current.x) ** 2 + (destWp.y - current.y) ** 2
      );
      const fuelToDest =
        flightMode === 'DRIFT'
          ? 1
          : Math.max(1, Math.round(distToDest * FUEL_MULT[flightMode]));

      if (fuelToDest <= maxRange) {
        steps.push({
          from: current,
          to: destWp,
          distance: Math.round(distToDest),
          fuel: fuelToDest,
          time: Math.round(15 + (distToDest * SPEED_MULT[flightMode]) / Math.max(engineSpeed, 1)),
        });
        return steps;
      }

      // Find the reachable waypoint closest to destination
      let bestWp: Waypoint | null = null;
      let bestDistToDest = Infinity;

      for (const wp of waypoints) {
        if (visited.has(wp.symbol)) continue;
        const distToWp = Math.sqrt(
          (wp.x - current.x) ** 2 + (wp.y - current.y) ** 2
        );
        const fuelToWp =
          flightMode === 'DRIFT'
            ? 1
            : Math.max(1, Math.round(distToWp * FUEL_MULT[flightMode]));
        if (fuelToWp > maxRange) continue;

        const wpDistToDest = Math.sqrt(
          (destWp.x - wp.x) ** 2 + (destWp.y - wp.y) ** 2
        );
        if (wpDistToDest < bestDistToDest) {
          bestDistToDest = wpDistToDest;
          bestWp = wp;
        }
      }

      if (!bestWp) return null; // No route possible

      const distToNext = Math.sqrt(
        (bestWp.x - current.x) ** 2 + (bestWp.y - current.y) ** 2
      );
      const fuelToNext =
        flightMode === 'DRIFT'
          ? 1
          : Math.max(1, Math.round(distToNext * FUEL_MULT[flightMode]));

      steps.push({
        from: current,
        to: bestWp,
        distance: Math.round(distToNext),
        fuel: fuelToNext,
        time: Math.round(15 + (distToNext * SPEED_MULT[flightMode]) / Math.max(engineSpeed, 1)),
      });

      visited.add(bestWp.symbol);
      current = bestWp;
    }

    return null; // Too many hops
  }, [originWp, destWp, origin, destination, flightMode, engineSpeed, fuel, waypoints, directRoute]);

  const route = multiHopRoute ?? (directRoute ? [directRoute] : null);
  const totalFuel = route?.reduce((s, r) => s + r.fuel, 0) ?? 0;
  const totalTime = route?.reduce((s, r) => s + r.time, 0) ?? 0;
  const totalDist = route?.reduce((s, r) => s + r.distance, 0) ?? 0;

  return (
    <div className="navguide">
      {/* Toggle between map, guide and planner */}
      <div className="navguide-tabs">
        <button
          className={`navguide-tab ${activeTab === 'map' ? 'navguide-tab--active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          System Map
        </button>
        <button
          className={`navguide-tab ${activeTab === 'list' ? 'navguide-tab--active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          List
        </button>
        <button
          className={`navguide-tab ${activeTab === 'guide' ? 'navguide-tab--active' : ''}`}
          onClick={() => setActiveTab('guide')}
        >
          Guide
        </button>
        <button
          className={`navguide-tab ${activeTab === 'planner' ? 'navguide-tab--active' : ''}`}
          onClick={() => setActiveTab('planner')}
        >
          Route Planner
        </button>
      </div>

      {activeTab === 'map' ? (
        <div className="navguide-content navguide-content--map">
          {!systemSymbol ? (
            <div className="navguide-empty">Select a ship to view the system map.</div>
          ) : loading ? (
            <LoadingSpinner message="Loading waypoints…" />
          ) : (
            <SystemMap
              waypoints={waypoints}
              currentWaypoint={shipNav?.waypointSymbol}
            />
          )}
        </div>
      ) : activeTab === 'list' ? (
        <div className="navguide-content">
          {!systemSymbol ? (
            <div className="navguide-empty">Select a ship to view system objects.</div>
          ) : loading ? (
            <LoadingSpinner message="Loading waypoints…" />
          ) : (
            <WaypointList waypoints={waypoints} currentWaypoint={shipNav?.waypointSymbol} />
          )}
        </div>
      ) : activeTab === 'guide' ? (
        <div className="navguide-content">
          <div className="navguide-guide">
            <div className="navguide-section">
              <div className="navguide-section-title">Getting Started</div>
              <ol className="navguide-steps">
                <li>Select a ship from the <strong>Fleet</strong> window</li>
                <li>Use <strong>Flight Control → Navigation</strong> tab</li>
                <li>Choose <strong>Orbit</strong> before navigating (ships must be in orbit)</li>
                <li>Select a destination waypoint and click <strong>Go</strong></li>
              </ol>
            </div>

            <div className="navguide-section">
              <div className="navguide-section-title">Flight Modes</div>
              <div className="navguide-modes">
                <div className="navguide-mode">
                  <span className="navguide-mode-name">Cruise</span>
                  <span className="navguide-mode-desc">Normal speed, standard fuel</span>
                </div>
                <div className="navguide-mode">
                  <span className="navguide-mode-name">Burn</span>
                  <span className="navguide-mode-desc">Fastest, 2× fuel cost</span>
                </div>
                <div className="navguide-mode">
                  <span className="navguide-mode-name">Drift</span>
                  <span className="navguide-mode-desc">Very slow, uses only 1 fuel</span>
                </div>
                <div className="navguide-mode">
                  <span className="navguide-mode-name">Stealth</span>
                  <span className="navguide-mode-desc">Normal speed, avoids detection</span>
                </div>
              </div>
            </div>

            <div className="navguide-section">
              <div className="navguide-section-title">Key Actions</div>
              <div className="navguide-actions">
                <div className="navguide-action">
                  <span className="navguide-action-cmd">Orbit</span>
                  <span>Required before navigating or scanning</span>
                </div>
                <div className="navguide-action">
                  <span className="navguide-action-cmd">Dock</span>
                  <span>Required to refuel, sell cargo, or trade</span>
                </div>
                <div className="navguide-action">
                  <span className="navguide-action-cmd">Refuel</span>
                  <span>Must be docked at a waypoint with a marketplace</span>
                </div>
              </div>
            </div>

            <div className="navguide-section">
              <div className="navguide-section-title">Tips</div>
              <ul className="navguide-tips">
                <li>Use <strong>Drift</strong> mode when low on fuel — it uses only 1 fuel regardless of distance</li>
                <li>Check the fuel bar preview before navigating — the hatched area shows estimated fuel cost</li>
                <li>Use the <strong>Route Planner</strong> tab to plan multi-hop routes for long-distance travel</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="navguide-content">
          {!systemSymbol && (
            <div className="navguide-empty">Select a ship to plan routes in its system.</div>
          )}

          {systemSymbol && (
            <div className="navguide-planner">
              {/* Origin */}
              <div className="navguide-field">
                <label className="navguide-label">
                  Origin
                  {shipNav && <span className="navguide-auto">(from ship)</span>}
                </label>
                <select
                  className="navguide-select"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select waypoint…</option>
                  {waypoints.map((wp) => (
                    <option key={wp.symbol} value={wp.symbol}>
                      {wp.symbol} ({wp.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Destination */}
              <div className="navguide-field">
                <label className="navguide-label">Destination</label>
                <select
                  className="navguide-select"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Select waypoint…</option>
                  {waypoints.map((wp) => (
                    <option key={wp.symbol} value={wp.symbol}>
                      {wp.symbol} ({wp.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Flight mode */}
              <div className="navguide-field">
                <label className="navguide-label">Flight Mode</label>
                <div className="navguide-mode-btns">
                  {(['DRIFT', 'STEALTH', 'CRUISE', 'BURN'] as const).map((m) => (
                    <button
                      key={m}
                      className={`navguide-mode-btn ${flightMode === m ? 'navguide-mode-btn--active' : ''}`}
                      onClick={() => setFlightMode(m)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Route results */}
              {route && route.length > 0 && (
                <div className="navguide-result">
                  {/* Summary */}
                  <div className="navguide-summary">
                    <div className="navguide-summary-item">
                      <span className="navguide-summary-label">Distance</span>
                      <span className="navguide-summary-value">{totalDist} units</span>
                    </div>
                    <div className="navguide-summary-item">
                      <span className="navguide-summary-label">Est. Time</span>
                      <span className="navguide-summary-value">{formatEta(totalTime)}</span>
                    </div>
                    <div className="navguide-summary-item">
                      <span className="navguide-summary-label">Fuel Cost</span>
                      <span className={`navguide-summary-value ${fuel && totalFuel > fuel.current ? 'navguide-danger' : ''}`}>
                        {totalFuel}
                        {fuel && <span className="navguide-fuel-cap"> / {fuel.current}</span>}
                      </span>
                    </div>
                    {route.length > 1 && (
                      <div className="navguide-summary-item">
                        <span className="navguide-summary-label">Hops</span>
                        <span className="navguide-summary-value">{route.length}</span>
                      </div>
                    )}
                  </div>

                  {/* Multi-hop notice */}
                  {route.length > 1 && (
                    <div className="navguide-notice">
                      Route requires {route.length} hops — refuel at each stop.
                    </div>
                  )}

                  {/* Step-by-step */}
                  <div className="navguide-steps-list">
                    {route.map((step, i) => (
                      <div key={i} className="navguide-step">
                        <div className="navguide-step-num">{i + 1}</div>
                        <div className="navguide-step-detail">
                          <div className="navguide-step-route">
                            <span className="navguide-step-wp">{step.from.symbol}</span>
                            <span className="navguide-step-arrow">→</span>
                            <span className="navguide-step-wp">{step.to.symbol}</span>
                          </div>
                          <div className="navguide-step-meta">
                            {step.distance} dist · {step.fuel} fuel · {formatEta(step.time)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {origin && destination && origin === destination && (
                <div className="navguide-empty">Origin and destination are the same.</div>
              )}

              {origin && destination && origin !== destination && !route && !loading && (
                <div className="navguide-empty">No route found — waypoints may be unreachable with current fuel capacity.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Friendly type labels ── */
const TYPE_LABELS: Record<string, string> = {
  PLANET: 'Planet',
  GAS_GIANT: 'Gas Giant',
  MOON: 'Moon',
  ORBITAL_STATION: 'Orbital Station',
  JUMP_GATE: 'Jump Gate',
  FUEL_STATION: 'Fuel Station',
  ASTEROID: 'Asteroid',
  ASTEROID_BASE: 'Asteroid Base',
  ENGINEERED_ASTEROID: 'Engineered Asteroid',
  ASTEROID_FIELD: 'Asteroid Field',
  NEBULA: 'Nebula',
  GRAVITY_WELL: 'Gravity Well',
};

const ASTEROID_TYPES = new Set([
  'ASTEROID', 'ASTEROID_FIELD', 'ASTEROID_BASE', 'ENGINEERED_ASTEROID',
]);

interface WpGroup {
  key: string;
  label: string | null; // null = don't show group header
  waypoints: Waypoint[];
}

function groupWaypoints(waypoints: Waypoint[]): WpGroup[] {
  const groups = new Map<string, Waypoint[]>();
  for (const wp of waypoints) {
    const parts = wp.symbol.split('-');
    const suffix = parts.length >= 3 ? parts[2] : wp.symbol;
    const key = suffix.charAt(0).toUpperCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(wp);
  }

  const result: WpGroup[] = [];
  // Sort groups by key
  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [key, wps] of sorted) {
    const asteroidCount = wps.filter(w => ASTEROID_TYPES.has(w.type)).length;
    const isBelt = asteroidCount > 5;
    result.push({
      key,
      label: isBelt ? `Asteroid Belt ${key}` : wps.length > 1 ? `Group ${key}` : null,
      waypoints: wps,
    });
  }

  return result;
}

function WaypointList({ waypoints, currentWaypoint }: { waypoints: Waypoint[]; currentWaypoint?: string }) {
  const [selectedTraits, setSelectedTraits] = useState<Set<string>>(new Set());

  // Collect all unique traits across all waypoints
  const allTraits = useMemo(() => {
    const traitMap = new Map<string, string>(); // symbol -> name
    for (const wp of waypoints) {
      for (const t of wp.traits) {
        if (!traitMap.has(t.symbol)) traitMap.set(t.symbol, t.name);
      }
    }
    return [...traitMap.entries()]
      .sort(([, a], [, b]) => a.localeCompare(b));
  }, [waypoints]);

  // Filter waypoints by selected traits (AND logic — must have all selected traits)
  const filteredWaypoints = useMemo(() => {
    if (selectedTraits.size === 0) return waypoints;
    return waypoints.filter((wp) => {
      const wpTraitSymbols = new Set(wp.traits.map((t) => t.symbol));
      for (const trait of selectedTraits) {
        if (!wpTraitSymbols.has(trait)) return false;
      }
      return true;
    });
  }, [waypoints, selectedTraits]);

  const groups = useMemo(() => groupWaypoints(filteredWaypoints), [filteredWaypoints]);

  const toggleTrait = (symbol: string) => {
    setSelectedTraits((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  if (waypoints.length === 0) {
    return <div className="navguide-empty">No waypoints found in this system.</div>;
  }

  return (
    <div className="wplist">
      {/* Trait filter */}
      <div className="wplist-filters">
        <div className="wplist-filter-label">Filter by trait:</div>
        <div className="wplist-filter-tags">
          {allTraits.map(([symbol, name]) => (
            <button
              key={symbol}
              className={`wplist-filter-tag ${selectedTraits.has(symbol) ? 'wplist-filter-tag--active' : ''}`}
              onClick={() => toggleTrait(symbol)}
              title={symbol}
            >
              {name}
            </button>
          ))}
        </div>
        {selectedTraits.size > 0 && (
          <button
            className="wplist-filter-clear"
            onClick={() => setSelectedTraits(new Set())}
          >
            Clear filters ({filteredWaypoints.length}/{waypoints.length})
          </button>
        )}
      </div>

      {filteredWaypoints.length === 0 ? (
        <div className="navguide-empty">No waypoints match the selected traits.</div>
      ) : (
        groups.map((g) => (
        <div key={g.key} className="wplist-group">
          {g.label && <div className="wplist-group-header">{g.label}</div>}
          <div className="wplist-items">
            {g.waypoints.map((wp) => (
              <div
                key={wp.symbol}
                className={`wplist-item ${wp.symbol === currentWaypoint ? 'wplist-item--current' : ''}`}
              >
                <div className="wplist-item-header">
                  <span className="wplist-item-symbol">{wp.symbol}</span>
                  <span className="wplist-item-type">{TYPE_LABELS[wp.type] ?? wp.type}</span>
                  {wp.symbol === currentWaypoint && (
                    <span className="wplist-item-here">HERE</span>
                  )}
                </div>
                <div className="wplist-item-coords">
                  x: {wp.x}, y: {wp.y}
                  {wp.orbitals.length > 0 && (
                    <span className="wplist-item-orbitals">
                      {' '}· {wp.orbitals.length} orbital{wp.orbitals.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {wp.isUnderConstruction && (
                    <span className="wplist-item-construction"> · Under Construction</span>
                  )}
                </div>
                {wp.traits.length > 0 && (
                  <div className="wplist-item-traits">
                    {wp.traits.map((t) => (
                      <span key={t.symbol} className="wplist-trait" title={t.description}>
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))
      )}
    </div>
  );
}