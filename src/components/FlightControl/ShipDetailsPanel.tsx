import type { Ship } from '../../services/api';
import { CargoBar } from './shared';

export default function ShipDetailsPanel({ ship }: { ship: Ship }) {
  const condPct = (v: number) => `${Math.round(v * 100)}%`;
  const condClass = (v: number) =>
    v >= 0.7 ? 'fc-cond--good' : v >= 0.4 ? 'fc-cond--warn' : 'fc-cond--bad';

  return (
    <div className="fc-details">
      {/* Hull / Frame */}
      <div className="fc-section">
        <div className="fc-section-title">Frame — {ship.frame.name}</div>
        <div className="fc-stat-grid">
          <div className="fc-stat">
            <span className="fc-stat-label">Condition</span>
            <span className={`fc-stat-value ${condClass(ship.frame.condition)}`}>{condPct(ship.frame.condition)}</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-label">Integrity</span>
            <span className={`fc-stat-value ${condClass(ship.frame.integrity)}`}>{condPct(ship.frame.integrity)}</span>
          </div>
        </div>
      </div>

      {/* Reactor */}
      <div className="fc-section">
        <div className="fc-section-title">Reactor — {ship.reactor.name}</div>
        <div className="fc-stat-grid">
          <div className="fc-stat">
            <span className="fc-stat-label">Condition</span>
            <span className={`fc-stat-value ${condClass(ship.reactor.condition)}`}>{condPct(ship.reactor.condition)}</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-label">Integrity</span>
            <span className={`fc-stat-value ${condClass(ship.reactor.integrity)}`}>{condPct(ship.reactor.integrity)}</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-label">Power Output</span>
            <span className="fc-stat-value">{ship.reactor.powerOutput}</span>
          </div>
        </div>
      </div>

      {/* Engine */}
      <div className="fc-section">
        <div className="fc-section-title">Engine — {ship.engine.name}</div>
        <div className="fc-stat-grid">
          <div className="fc-stat">
            <span className="fc-stat-label">Condition</span>
            <span className={`fc-stat-value ${condClass(ship.engine.condition)}`}>{condPct(ship.engine.condition)}</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-label">Integrity</span>
            <span className={`fc-stat-value ${condClass(ship.engine.integrity)}`}>{condPct(ship.engine.integrity)}</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-label">Speed</span>
            <span className="fc-stat-value">{ship.engine.speed}</span>
          </div>
        </div>
      </div>

      {/* Crew */}
      <div className="fc-section">
        <div className="fc-section-title">Crew</div>
        <div className="fc-stat-grid">
          <div className="fc-stat">
            <span className="fc-stat-label">Staffing</span>
            <span className="fc-stat-value">{ship.crew.current} / {ship.crew.capacity}</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-label">Required</span>
            <span className="fc-stat-value">{ship.crew.required}</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-label">Morale</span>
            <span className={`fc-stat-value ${ship.crew.morale >= 75 ? 'fc-cond--good' : ship.crew.morale >= 40 ? 'fc-cond--warn' : 'fc-cond--bad'}`}>{ship.crew.morale}%</span>
          </div>
        </div>
      </div>

      {/* Cargo */}
      <div className="fc-section">
        <div className="fc-section-title">Cargo</div>
        <CargoBar cargo={ship.cargo} />
        {ship.cargo.inventory.length > 0 ? (
          <div className="fc-cargo-list">
            {ship.cargo.inventory.map((item) => (
              <div key={item.symbol} className="fc-cargo-item">
                <span>{item.name}</span>
                <span className="fc-cargo-units">×{item.units}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="fc-hint">Cargo hold is empty.</div>
        )}
      </div>

      {/* Modules */}
      {ship.modules.length > 0 && (
        <div className="fc-section">
          <div className="fc-section-title">Modules</div>
          <div className="fc-equip-list">
            {ship.modules.map((m, i) => (
              <div key={i} className="fc-equip-item">
                <span className="fc-equip-name">{m.name}</span>
                {m.capacity != null && <span className="fc-equip-stat">Cap {m.capacity}</span>}
                {m.range != null && <span className="fc-equip-stat">Range {m.range}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mounts */}
      {ship.mounts.length > 0 && (
        <div className="fc-section">
          <div className="fc-section-title">Mounts</div>
          <div className="fc-equip-list">
            {ship.mounts.map((m, i) => (
              <div key={i} className="fc-equip-item">
                <span className="fc-equip-name">{m.name}</span>
                {m.strength != null && <span className="fc-equip-stat">Str {m.strength}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registration */}
      <div className="fc-section">
        <div className="fc-section-title">Registration</div>
        <div className="fc-stat-grid">
          <div className="fc-stat">
            <span className="fc-stat-label">Faction</span>
            <span className="fc-stat-value">{ship.registration.factionSymbol}</span>
          </div>
          <div className="fc-stat">
            <span className="fc-stat-label">Role</span>
            <span className="fc-stat-value">{ship.registration.role}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
