import { useState, useEffect, useRef } from 'react';
import { api, type Ship, type ShipNav, type Agent } from '../../services/api';
import { useWaypoints, queryKeys } from '../../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { formatEta } from '../../utils/formatEta';
import { TransitProgressBar } from './shared';

export default function NavPanel({
  ship,
  busy,
  setBusy,
  flash,
  onNavUpdate,
  onFuelUpdate,
  onShipUpdate,
  setAgent,
  onEstimatedFuelCost,
}: {
  ship: Ship;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (msg: string, type?: 'ok' | 'err') => void;
  onNavUpdate: (nav: ShipNav) => void;
  onFuelUpdate: (fuel: Ship['fuel']) => void;
  onShipUpdate: (ship: Ship) => void;
  setAgent: (agent: Agent) => void;
  onEstimatedFuelCost: (cost: number) => void;
}) {
  const qcMain = useQueryClient();
  const [destination, setDestination] = useState('');
  const { data: waypoints = [], isLoading: waypointsLoading } = useWaypoints(ship.nav.systemSymbol);
  const [flightMode, setFlightMode] = useState<ShipNav['flightMode']>(ship.nav.flightMode);
  const [arrivalCountdown, setArrivalCountdown] = useState<number | null>(null);
  const arrivalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  // Set after clicking Go while waiting for the API — locks the UI immediately
  const [navigating, setNavigating] = useState(false);

  // Compute travel estimates when destination changes
  const currentWp = waypoints.find((w) => w.symbol === ship.nav.waypointSymbol);
  const destWp = waypoints.find((w) => w.symbol === destination);

  const distance = currentWp && destWp
    ? Math.round(Math.sqrt((destWp.x - currentWp.x) ** 2 + (destWp.y - currentWp.y) ** 2))
    : null;

  // SpaceTraders fuel/time estimate formulas
  const SPEED_MULT: Record<ShipNav['flightMode'], number> = {
    CRUISE: 25,
    DRIFT: 250,
    BURN: 12.5,
    STEALTH: 25,
  };
  const FUEL_MULT: Record<ShipNav['flightMode'], number> = {
    CRUISE: 1,
    DRIFT: 0,
    BURN: 2,
    STEALTH: 1,
  };

  const estimatedTime = distance !== null
    ? Math.round(15 + (distance * SPEED_MULT[flightMode]) / Math.max(ship.engine.speed, 1))
    : null;

  const estimatedFuel = distance !== null
    ? flightMode === 'DRIFT'
      ? 1
      : Math.max(1, Math.round(distance * FUEL_MULT[flightMode]))
    : null;

  // Push estimate up to parent for fuel bar preview
  useEffect(() => {
    onEstimatedFuelCost(destination && estimatedFuel !== null ? estimatedFuel : 0);
  }, [destination, estimatedFuel, onEstimatedFuelCost]);

  // In-transit countdown (display only — arrival watcher handles the refresh)
  const inTransitForEffect = ship.nav.status === 'IN_TRANSIT';
  useEffect(() => {
    if (!inTransitForEffect) return;
    const arrival = new Date(ship.nav.route.arrival).getTime();
    const tick = () => {
      const rem = Math.max(0, Math.ceil((arrival - Date.now()) / 1000));
      setArrivalCountdown(rem);
      if (rem <= 0) {
        clearInterval(arrivalRef.current);
      }
    };
    tick();
    arrivalRef.current = setInterval(tick, 1000);
    return () => {
      clearInterval(arrivalRef.current);
      setArrivalCountdown(null);
    };
  }, [inTransitForEffect, ship.nav.route.arrival]);

  const handleOrbit = async () => {
    setBusy(true);
    try {
      const { nav } = await api.orbitShip(ship.symbol);
      onNavUpdate(nav);
      flash('Entered orbit');
      qcMain.invalidateQueries({ queryKey: queryKeys.contracts });
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleDock = async () => {
    setBusy(true);
    try {
      const { nav } = await api.dockShip(ship.symbol);
      onNavUpdate(nav);
      flash('Docked');
      qcMain.invalidateQueries({ queryKey: queryKeys.contracts });
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleNavigate = async () => {
    if (!destination) return;
    setNavigating(true);
    setBusy(true);
    try {
      const result = await api.navigateShip(ship.symbol, destination);
      onShipUpdate({ ...ship, nav: result.nav, fuel: result.fuel });
      setNavigating(false);
      flash(`En route to ${destination}`);
      setDestination('');
      qcMain.invalidateQueries({ queryKey: queryKeys.contracts });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      // Parse "in-transit" error: extract destination and arrival seconds
      const transitMatch = msg.match(
        /in-transit from (\S+) to (\S+) and arrives in (\d+) seconds/i
      );
      if (transitMatch) {
        const [, origin, dest, secs] = transitMatch;
        const seconds = parseInt(secs, 10);
        const now = new Date();
        const arrival = new Date(now.getTime() + seconds * 1000);
        // Reconstruct nav as IN_TRANSIT so the UI switches immediately
        const syntheticNav: ShipNav = {
          ...ship.nav,
          status: 'IN_TRANSIT',
          waypointSymbol: origin,
          route: {
            origin: { symbol: origin, type: '' },
            destination: { symbol: dest, type: '' },
            departureTime: now.toISOString(),
            arrival: arrival.toISOString(),
          },
        };
        onNavUpdate(syntheticNav);
        flash(`Ship already en route to ${dest} — ETA ${seconds}s`);
      } else {
        setNavigating(false);
        flash(msg, 'err');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFlightMode = async (mode: ShipNav['flightMode']) => {
    setBusy(true);
    try {
      const { nav } = await api.setFlightMode(ship.symbol, mode);
      onNavUpdate(nav);
      setFlightMode(mode);
      flash(`Flight mode: ${mode}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleRefuel = async () => {
    setBusy(true);
    try {
      const result = await api.refuelShip(ship.symbol);
      onFuelUpdate(result.fuel);
      setAgent(result.agent);
      flash(`Refuelled — ¢${result.transaction.totalPrice}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const inTransit = ship.nav.status === 'IN_TRANSIT';
  const transitDestination = ship.nav.status === 'IN_TRANSIT'
    ? ship.nav.route.destination.symbol
    : destination || '';

  return (
    <div className="fc-nav">
      {/* In-transit banner + progress */}
      {inTransit && (
        <div className="fc-transit-block">
          <div className="fc-transit-banner">
            <span>En route to <strong>{transitDestination}</strong></span>
            {arrivalCountdown !== null && (
              <span className="fc-transit-eta">ETA {formatEta(arrivalCountdown)}</span>
            )}
          </div>
          <TransitProgressBar
            departureTime={ship.nav.route.departureTime}
            arrivalTime={ship.nav.route.arrival}
          />
        </div>
      )}

      {/* Navigating spinner — shown briefly while API is in-flight */}
      {navigating && !inTransit && (
        <div className="fc-transit-banner">
          <span>Initiating navigation to <strong>{destination}</strong>…</span>
        </div>
      )}

      {/* Orbit / Dock / Refuel */}
      <div className="fc-action-row">
        <button
          className="fc-btn"
          disabled={busy || inTransit || ship.nav.status === 'IN_ORBIT'}
          onClick={handleOrbit}
        >
          Orbit
        </button>
        <button
          className="fc-btn"
          disabled={busy || inTransit || ship.nav.status === 'DOCKED'}
          onClick={handleDock}
        >
          Dock
        </button>
        <button
          className="fc-btn fc-btn--accent"
          disabled={busy || inTransit || ship.nav.status !== 'DOCKED'}
          onClick={handleRefuel}
        >
          Refuel
        </button>
      </div>

      {/* Flight mode */}
      <div className="fc-section">
        <div className="fc-section-title">Flight Mode</div>
        <div className="fc-flight-modes">
          {(['DRIFT', 'STEALTH', 'CRUISE', 'BURN'] as const).map((mode) => (
            <button
              key={mode}
              className={`fc-mode-btn ${flightMode === mode ? 'fc-mode-btn--active' : ''}`}
              disabled={busy || inTransit}
              onClick={() => handleFlightMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Navigate */}
      <div className="fc-section">
        <div className="fc-section-title">Navigate</div>
        <div className="fc-navigate-row">
          <select
            className="fc-select"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            disabled={busy || inTransit || waypointsLoading}
          >
            <option value="">{waypointsLoading ? 'Loading waypoints…' : 'Select waypoint…'}</option>
            {waypoints.map((wp) => (
              <option key={wp.symbol} value={wp.symbol}>
                {wp.symbol} ({wp.type})
              </option>
            ))}
          </select>
          <button
            className="fc-btn fc-btn--primary"
            disabled={busy || inTransit || !destination}
            onClick={handleNavigate}
          >
            Go
          </button>
        </div>

        {/* Travel estimate */}
        {destination && distance !== null && (
          <div className="fc-estimate">
            <div className="fc-estimate-item">
              <span className="fc-estimate-label">Distance</span>
              <span className="fc-estimate-value">{distance} units</span>
            </div>
            <div className="fc-estimate-item">
              <span className="fc-estimate-label">Est. Time</span>
              <span className="fc-estimate-value">{formatEta(estimatedTime ?? 0)}</span>
            </div>
            <div className="fc-estimate-item">
              <span className="fc-estimate-label">Est. Fuel</span>
              <span className={`fc-estimate-value ${(estimatedFuel ?? 0) > ship.fuel.current ? 'fc-estimate-value--danger' : ''}`}>
                {estimatedFuel ?? '?'} / {ship.fuel.current}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
