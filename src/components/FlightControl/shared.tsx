import { useState, useEffect, useRef } from 'react';
import type { Ship } from '../../services/api';

export function TransitProgressBar({
  departureTime,
  arrivalTime,
}: {
  departureTime: string;
  arrivalTime: string;
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
  const pct = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 100;

  return (
    <div className="fc-transit-progress">
      <div className="fc-transit-track">
        <div className="fc-transit-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`fc-tab ${active ? 'fc-tab--active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

export function FuelBar({ fuel, estimatedCost = 0 }: { fuel: Ship['fuel']; estimatedCost?: number }) {
  const pct = fuel.capacity > 0 ? (fuel.current / fuel.capacity) * 100 : 0;
  const costPct = fuel.capacity > 0 ? (estimatedCost / fuel.capacity) * 100 : 0;
  const afterPct = Math.max(0, pct - costPct);
  const exceedsFuel = estimatedCost > fuel.current;
  return (
    <div className="fc-fuel">
      <div className="fc-fuel-track">
        {/* Remaining fuel after deduction */}
        <div className="fc-fuel-fill" style={{ width: `${afterPct}%` }} />
        {/* Estimated deduction (hatched glow) */}
        {estimatedCost > 0 && (
          <div
            className={`fc-fuel-deduction ${exceedsFuel ? 'fc-fuel-deduction--danger' : ''}`}
            style={{ left: `${afterPct}%`, width: `${Math.min(costPct, pct)}%` }}
          />
        )}
      </div>
      <span className="fc-fuel-label">
        FUEL {fuel.current}/{fuel.capacity}
        {estimatedCost > 0 && (
          <span className={exceedsFuel ? 'fc-fuel-est--danger' : 'fc-fuel-est'}>
            {' '}(-{estimatedCost})
          </span>
        )}
      </span>
    </div>
  );
}

export function CargoBar({ cargo }: { cargo: Ship['cargo'] }) {
  const pct = cargo.capacity > 0 ? (cargo.units / cargo.capacity) * 100 : 0;
  return (
    <div className="fc-cargo-bar">
      <div className="fc-cargo-bar-track">
        <div
          className="fc-cargo-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="fc-cargo-bar-label">CARGO {cargo.units}/{cargo.capacity}</span>
    </div>
  );
}
