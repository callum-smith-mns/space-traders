import { useState } from 'react';
import { api, type Ship, type ShipCooldown, type Agent, type Contract } from '../../services/api';
import { useShips, useContracts, queryKeys } from '../../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import { CargoBar } from './shared';

const REFINE_MAP: Record<string, string> = {
  IRON_ORE: 'IRON',
  COPPER_ORE: 'COPPER',
  SILVER_ORE: 'SILVER',
  GOLD_ORE: 'GOLD',
  ALUMINUM_ORE: 'ALUMINUM',
  PLATINUM_ORE: 'PLATINUM',
  URANITE_ORE: 'URANITE',
  MERITIUM_ORE: 'MERITIUM',
  HYDROCARBON: 'FUEL',
};

const REFINER_MODULES = ['MODULE_ORE_REFINERY', 'MODULE_GAS_PROCESSOR', 'MODULE_MINERAL_PROCESSOR'];

export default function CargoPanel({
  ship,
  busy,
  setBusy,
  flash,
  onCargoUpdate,
  setAgent,
  onCooldown,
  setCooldown,
}: {
  ship: Ship;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (msg: string, type?: 'ok' | 'err') => void;
  onCargoUpdate: (cargo: Ship['cargo']) => void;
  setAgent: (agent: Agent) => void;
  onCooldown: boolean;
  setCooldown: (cd: ShipCooldown) => void;
}) {
  const qc = useQueryClient();
  const { data: ships = [] } = useShips();
  const { data: contracts = [] } = useContracts();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [transferTarget, setTransferTarget] = useState('');

  const hasRefiner = ship.modules.some((m) => REFINER_MODULES.includes(m.symbol));

  // Ships at the same waypoint (excluding self) for transfer
  const nearbyShips = ships.filter(
    (s) => s.symbol !== ship.symbol && s.nav.waypointSymbol === ship.nav.waypointSymbol
  );

  // Active contracts that need deliveries at this waypoint
  const deliverableContracts = contracts.filter(
    (c) => c.accepted && !c.fulfilled && c.terms.deliver?.some(
      (d) => d.destinationSymbol === ship.nav.waypointSymbol && d.unitsFulfilled < d.unitsRequired
    )
  );

  // Map of tradeSymbol → { contractId, remaining } for quick lookup
  const deliveryMap = new Map<string, { contractId: string; remaining: number; contract: Contract }>();
  for (const c of deliverableContracts) {
    for (const d of c.terms.deliver ?? []) {
      if (d.destinationSymbol === ship.nav.waypointSymbol && d.unitsFulfilled < d.unitsRequired) {
        deliveryMap.set(d.tradeSymbol, {
          contractId: c.id,
          remaining: d.unitsRequired - d.unitsFulfilled,
          contract: c,
        });
      }
    }
  }

  const getQty = (symbol: string, max: number) => Math.min(quantities[symbol] ?? max, max);
  const setQty = (symbol: string, val: number) =>
    setQuantities((prev) => ({ ...prev, [symbol]: Math.max(1, val) }));

  const handleSell = async (symbol: string, units: number) => {
    setBusy(true);
    try {
      const r = await api.sellCargo(ship.symbol, symbol, units);
      onCargoUpdate(r.cargo);
      setAgent(r.agent);
      flash(`Sold ${units} ${symbol} — ¢${r.transaction.totalPrice.toLocaleString()}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Sell failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleJettison = async (symbol: string, units: number) => {
    setBusy(true);
    try {
      const r = await api.jettisonCargo(ship.symbol, symbol, units);
      onCargoUpdate(r.cargo);
      flash(`Jettisoned ${units} ${symbol}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Jettison failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async (symbol: string, units: number) => {
    if (!transferTarget) { flash('Select a ship to transfer to', 'err'); return; }
    setBusy(true);
    try {
      const r = await api.transferCargo(ship.symbol, transferTarget, symbol, units);
      onCargoUpdate(r.cargo);
      qc.invalidateQueries({ queryKey: queryKeys.ships });
      flash(`Transferred ${units} ${symbol} → ${transferTarget}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Transfer failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleDeliver = async (symbol: string, units: number) => {
    const entry = deliveryMap.get(symbol);
    if (!entry) return;
    const deliverUnits = Math.min(units, entry.remaining);
    setBusy(true);
    try {
      const r = await api.deliverContractCargo(entry.contractId, ship.symbol, symbol, deliverUnits);
      onCargoUpdate(r.cargo);
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
      const d = r.contract.terms.deliver?.find((dd) => dd.tradeSymbol === symbol);
      const progress = d ? `${d.unitsFulfilled}/${d.unitsRequired}` : '';
      flash(`Delivered ${deliverUnits} ${symbol} ${progress}`);
      // Auto-fulfill if all deliveries complete
      if (r.contract.terms.deliver?.every((dd) => dd.unitsFulfilled >= dd.unitsRequired)) {
        try {
          const fr = await api.fulfillContract(entry.contractId);
          setAgent(fr.agent);
          qc.invalidateQueries({ queryKey: queryKeys.contracts });
          flash(`Contract fulfilled! +¢${r.contract.terms.payment.onFulfilled.toLocaleString()}`);
        } catch { /* fulfill may fail if already fulfilled */ }
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Delivery failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleRefine = async (cargoSymbol: string) => {
    const produce = REFINE_MAP[cargoSymbol];
    if (!produce) return;
    setBusy(true);
    try {
      const r = await api.refineShip(ship.symbol, produce);
      onCargoUpdate(r.cargo);
      setCooldown(r.cooldown);
      const produced = r.produced.map((p) => `+${p.units} ${p.tradeSymbol}`).join(', ');
      const consumed = r.consumed.map((c) => `-${c.units} ${c.tradeSymbol}`).join(', ');
      flash(`Refined: ${produced} (${consumed})`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Refine failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const isDocked = ship.nav.status === 'DOCKED';

  return (
    <div className="fc-cargo">
      <CargoBar cargo={ship.cargo} />

      {/* Transfer target selector */}
      {nearbyShips.length > 0 && (
        <div className="fc-cargo-transfer-selector">
          <span className="fc-cargo-transfer-label">Transfer to</span>
          <select
            className="fc-cargo-transfer-select"
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
          >
            <option value="">Select ship…</option>
            {nearbyShips.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} ({s.registration.role})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Contract delivery hint */}
      {deliverableContracts.length > 0 && (
        <div className="fc-cargo-deliver-hint">
          Contract deliveries available at this waypoint
        </div>
      )}

      {ship.cargo.inventory.length === 0 ? (
        <div className="fc-hint">Cargo hold is empty.</div>
      ) : (
        <div className="fc-cargo-table">
          {ship.cargo.inventory.map((item) => {
            const qty = getQty(item.symbol, item.units);
            const delivery = deliveryMap.get(item.symbol);
            return (
              <div key={item.symbol} className={`fc-cargo-row ${delivery ? 'fc-cargo-row--deliverable' : ''}`}>
                <div className="fc-cargo-info">
                  <span className="fc-cargo-name">{item.name}</span>
                  <span className="fc-cargo-units">×{item.units}</span>
                  {delivery && (
                    <span className="fc-cargo-delivery-badge" title={`Contract needs ${delivery.remaining} more`}>
                      {delivery.remaining} needed
                    </span>
                  )}
                </div>
                <div className="fc-cargo-qty">
                  <button
                    className="fc-qty-btn"
                    onClick={() => setQty(item.symbol, qty - 1)}
                    disabled={qty <= 1}
                  >−</button>
                  <input
                    className="fc-qty-input"
                    type="number"
                    min={1}
                    max={item.units}
                    value={qty}
                    onChange={(e) => setQty(item.symbol, parseInt(e.target.value) || 1)}
                  />
                  <button
                    className="fc-qty-btn"
                    onClick={() => setQty(item.symbol, qty + 1)}
                    disabled={qty >= item.units}
                  >+</button>
                  <button
                    className="fc-qty-btn fc-qty-btn--max"
                    onClick={() => setQty(item.symbol, item.units)}
                    disabled={qty >= item.units}
                    title="Max"
                  >All</button>
                </div>
                <div className="fc-cargo-actions">
                  {hasRefiner && REFINE_MAP[item.symbol] && (
                    <button
                      className="fc-btn-sm fc-btn--refine"
                      disabled={busy || onCooldown}
                      onClick={() => handleRefine(item.symbol)}
                      title={onCooldown ? 'On cooldown' : `Refine into ${REFINE_MAP[item.symbol]}`}
                    >
                      Refine
                    </button>
                  )}
                  {delivery && isDocked && (
                    <button
                      className="fc-btn-sm fc-btn--deliver"
                      disabled={busy}
                      onClick={() => handleDeliver(item.symbol, qty)}
                      title={`Deliver to contract (${delivery.remaining} needed)`}
                    >
                      Deliver {Math.min(qty, delivery.remaining)}
                    </button>
                  )}
                  {transferTarget && (
                    <button
                      className="fc-btn-sm fc-btn--transfer"
                      disabled={busy}
                      onClick={() => handleTransfer(item.symbol, qty)}
                      title={`Transfer ${qty} to ${transferTarget}`}
                    >
                      Transfer
                    </button>
                  )}
                  <button
                    className="fc-btn-sm fc-btn--accent"
                    disabled={busy || !isDocked}
                    onClick={() => handleSell(item.symbol, qty)}
                    title={isDocked ? `Sell ${qty}` : 'Must be docked to sell'}
                  >
                    Sell {qty < item.units ? qty : 'All'}
                  </button>
                  <button
                    className="fc-btn-sm fc-btn--danger"
                    disabled={busy}
                    onClick={() => handleJettison(item.symbol, qty)}
                    title={`Jettison ${qty}`}
                  >
                    Jettison
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
