import { useState, useEffect, useRef } from 'react';
import { type Ship } from '../services/api';
import { useShips } from '../hooks/useQueries';
import { formatEta } from '../utils/formatEta';
import LoadingSpinner from './LoadingSpinner';
import shipIcon from '../assets/ships/generic.png';
import './ShipsWindow.css';

interface ShipsWindowProps {
  selectedShip?: string | null;
  onSelectShip?: (ship: Ship) => void;
}

export default function ShipsWindow({ selectedShip, onSelectShip }: ShipsWindowProps) {
  const { data: ships, isLoading, error } = useShips();

  if (isLoading) {
    return <LoadingSpinner message="Scanning fleet…" />;
  }

  if (error) {
    return <div className="ships-error">{error instanceof Error ? error.message : 'Failed to load ships'}</div>;
  }

  if (!ships || ships.length === 0) {
    return <div className="ships-empty">No ships in fleet.</div>;
  }

  return (
    <div className="ships-list">
      {ships.map((ship) => {
        const fuelPct = ship.fuel.capacity > 0
          ? (ship.fuel.current / ship.fuel.capacity) * 100
          : 0;
        const inTransit = ship.nav.status === 'IN_TRANSIT';
        const statusLabel = inTransit ? 'EN ROUTE' : ship.nav.status.replace('_', ' ');

        return (
          <div
            key={ship.symbol}
            className={`ship-row ${selectedShip === ship.symbol ? 'ship-row--selected' : ''}`}
            onClick={() => onSelectShip?.(ship)}
          >
            <div className="ship-summary">
              <img src={shipIcon} alt="" className="ship-icon" />

              <div className="ship-id">
                <span className="ship-name">{ship.symbol}</span>
                <span className="ship-role">{ship.registration.role}</span>
              </div>

              <span className={`ship-nav-status ship-nav-status--${ship.nav.status.toLowerCase().replace('_', '-')}`}>
                {statusLabel}
              </span>

              <span className="ship-location">
                {inTransit
                  ? `→ ${ship.nav.route.destination.symbol}`
                  : ship.nav.waypointSymbol}
              </span>

              <div className="ship-fuel-mini">
                <div className="ship-fuel-mini-track">
                  <div
                    className="ship-fuel-mini-fill"
                    style={{ width: `${fuelPct}%` }}
                  />
                </div>
                <span className="ship-fuel-mini-label">
                  {ship.fuel.current}/{ship.fuel.capacity}
                </span>
              </div>
            </div>

            {inTransit && (
              <ShipTransitBar
                departureTime={ship.nav.route.departureTime}
                arrivalTime={ship.nav.route.arrival}
                destination={ship.nav.route.destination.symbol}
              />
            )}

            {!inTransit && ship.cooldown?.expiration && (
              <ShipCooldownBar cooldown={ship.cooldown} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Transit progress bar for ships list ── */
function ShipTransitBar({
  departureTime,
  arrivalTime,
  destination,
}: {
  departureTime: string;
  arrivalTime: string;
  destination: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const departure = new Date(departureTime).getTime();
  const arrival = new Date(arrivalTime).getTime();
  const total = arrival - departure;
  const elapsed = now - departure;
  const remaining = Math.max(0, Math.ceil((arrival - now) / 1000));
  const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 100;

  return (
    <div className="ship-transit">
      <div className="ship-transit-info">
        <span className="ship-transit-dest">→ {destination}</span>
        <span className="ship-transit-eta">
          {remaining > 0 ? formatEta(remaining) : 'Arriving…'}
        </span>
      </div>
      <div className="ship-transit-track">
        <div className="ship-transit-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ── Cooldown bar for ships list ── */
function ShipCooldownBar({ cooldown }: { cooldown: import('../services/api').ShipCooldown }) {
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const expiration = cooldown.expiration ? new Date(cooldown.expiration).getTime() : 0;
  const remaining = Math.max(0, Math.ceil((expiration - now) / 1000));
  const total = cooldown.totalSeconds || 1;
  const elapsed = total - remaining;
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const isActive = remaining > 0;

  useEffect(() => {
    if (!isActive) return;
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerRef.current);
  }, [isActive]);

  if (remaining <= 0) return null;

  return (
    <div className="ship-cooldown">
      <div className="ship-cooldown-info">
        <span className="ship-cooldown-label">COOLDOWN</span>
        <span className="ship-cooldown-eta">{formatEta(remaining)}</span>
      </div>
      <div className="ship-cooldown-track">
        <div className="ship-cooldown-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}


