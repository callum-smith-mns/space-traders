import { useState, useEffect } from 'react';
import { api, type Ship, type Agent } from '../../services/api';
import { useShipyard, queryKeys } from '../../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../LoadingSpinner';

const SUPPLY_COLORS: Record<string, string> = {
  ABUNDANT: 'var(--color-success)',
  HIGH: '#88cc88',
  MODERATE: 'var(--color-warning)',
  LIMITED: '#cc8844',
  SCARCE: 'var(--color-error)',
};

export default function ShipyardPanel({
  ship,
  busy,
  setBusy,
  flash,
  setAgent,
}: {
  ship: Ship;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (msg: string, type?: 'ok' | 'err') => void;
  setAgent: (agent: Agent) => void;
}) {
  const { data: shipyard, isLoading: loading, error } = useShipyard(
    ship.nav.systemSymbol,
    ship.nav.waypointSymbol,
  );
  const qc = useQueryClient();
  const [expandedShip, setExpandedShip] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    if (error) flash(error instanceof Error ? error.message : 'No shipyard here', 'err');
  }, [error, flash]);

  const isDocked = ship.nav.status === 'DOCKED';

  const handlePurchase = async (shipType: string) => {
    if (!isDocked) {
      flash('Must be docked to purchase ships', 'err');
      return;
    }
    setPurchasing(shipType);
    setBusy(true);
    try {
      const result = await api.purchaseShip(shipType, ship.nav.waypointSymbol);
      setAgent(result.agent);
      // Add the new ship to the ships cache
      qc.setQueryData<Ship[]>(queryKeys.ships, (old) =>
        old ? [...old, result.ship] : [result.ship]
      );
      flash(`Purchased ${result.ship.symbol} for ¢${result.transaction.price.toLocaleString()}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Purchase failed', 'err');
    } finally {
      setPurchasing(null);
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading shipyard…" />;

  if (error || !shipyard) {
    return <div className="fc-shipyard-empty">No shipyard at this waypoint.</div>;
  }

  if (!shipyard.ships || shipyard.ships.length === 0) {
    return (
      <div className="fc-shipyard">
        <div className="fc-shipyard-empty">
          {isDocked
            ? 'No ships currently available for purchase.'
            : 'Dock at this waypoint to browse ships.'}
        </div>
        {shipyard.shipTypes.length > 0 && (
          <div className="fc-shipyard-types">
            <div className="fc-section-title">Ship Types Available</div>
            <div className="fc-shipyard-type-tags">
              {shipyard.shipTypes.map((t) => (
                <span key={t.type} className="fc-shipyard-type-tag">{t.type.replace('SHIP_', '')}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fc-shipyard">
      {!isDocked && (
        <div className="fc-market-notice">Dock to purchase ships.</div>
      )}

      <div className="fc-shipyard-ships">
        {shipyard.ships.map((s) => {
          const isExpanded = expandedShip === s.type;
          const isPurchasing = purchasing === s.type;
          return (
            <div
              key={s.type}
              className={`fc-shipyard-card ${isExpanded ? 'fc-shipyard-card--expanded' : ''}`}
              onClick={() => setExpandedShip(isExpanded ? null : s.type)}
            >
              <div className="fc-shipyard-card-header">
                <div className="fc-shipyard-card-name">{s.name}</div>
                <div className="fc-shipyard-card-meta">
                  <span
                    className="fc-shipyard-supply"
                    style={{ color: SUPPLY_COLORS[s.supply] ?? 'var(--color-text-dim)' }}
                  >
                    {s.supply}
                  </span>
                  <span className="fc-shipyard-price">¢{s.purchasePrice.toLocaleString()}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="fc-shipyard-card-detail" onClick={(e) => e.stopPropagation()}>
                  <div className="fc-shipyard-desc">{s.description}</div>

                  <div className="fc-shipyard-specs">
                    <div className="fc-section-title">Specifications</div>
                    <div className="fc-shipyard-spec-grid">
                      <div className="fc-shipyard-spec">
                        <span className="fc-shipyard-spec-label">Frame</span>
                        <span className="fc-shipyard-spec-value">{s.frame.name}</span>
                      </div>
                      <div className="fc-shipyard-spec">
                        <span className="fc-shipyard-spec-label">Reactor</span>
                        <span className="fc-shipyard-spec-value">{s.reactor.name}</span>
                      </div>
                      <div className="fc-shipyard-spec">
                        <span className="fc-shipyard-spec-label">Engine</span>
                        <span className="fc-shipyard-spec-value">{s.engine.name}</span>
                      </div>
                      <div className="fc-shipyard-spec">
                        <span className="fc-shipyard-spec-label">Speed</span>
                        <span className="fc-shipyard-spec-value">{s.engine.speed}</span>
                      </div>
                      <div className="fc-shipyard-spec">
                        <span className="fc-shipyard-spec-label">Fuel</span>
                        <span className="fc-shipyard-spec-value">{s.frame.fuelCapacity}</span>
                      </div>
                      <div className="fc-shipyard-spec">
                        <span className="fc-shipyard-spec-label">Crew</span>
                        <span className="fc-shipyard-spec-value">{s.crew.required} / {s.crew.capacity}</span>
                      </div>
                      <div className="fc-shipyard-spec">
                        <span className="fc-shipyard-spec-label">Modules</span>
                        <span className="fc-shipyard-spec-value">{s.modules.length} ({s.frame.moduleSlots} slots)</span>
                      </div>
                      <div className="fc-shipyard-spec">
                        <span className="fc-shipyard-spec-label">Mounts</span>
                        <span className="fc-shipyard-spec-value">{s.mounts.length} ({s.frame.mountingPoints} pts)</span>
                      </div>
                    </div>
                  </div>

                  {s.modules.length > 0 && (
                    <div className="fc-shipyard-loadout">
                      <div className="fc-section-title">Modules</div>
                      <div className="fc-shipyard-items">
                        {s.modules.map((m, i) => (
                          <span key={i} className="fc-shipyard-item">{m.name}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {s.mounts.length > 0 && (
                    <div className="fc-shipyard-loadout">
                      <div className="fc-section-title">Mounts</div>
                      <div className="fc-shipyard-items">
                        {s.mounts.map((m, i) => (
                          <span key={i} className="fc-shipyard-item">{m.name ?? m.symbol}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    className="fc-shipyard-buy-btn"
                    disabled={!isDocked || busy || isPurchasing}
                    onClick={() => handlePurchase(s.type)}
                  >
                    {isPurchasing ? 'Purchasing…' : `Buy for ¢${s.purchasePrice.toLocaleString()}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
