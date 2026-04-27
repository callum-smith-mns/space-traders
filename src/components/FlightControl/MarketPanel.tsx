import { useState, useEffect } from 'react';
import { api, type Ship, type Agent } from '../../services/api';
import { useMarket, queryKeys } from '../../hooks/useQueries';
import { useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../LoadingSpinner';

export default function MarketPanel({
  ship,
  busy,
  setBusy,
  flash,
  onShipUpdate,
  setAgent,
}: {
  ship: Ship;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (msg: string, type?: 'ok' | 'err') => void;
  onShipUpdate: (ship: Ship) => void;
  setAgent: (agent: Agent) => void;
}) {
  const { data: market, isLoading: loading, error, refetch: refetchMarket } = useMarket(
    ship.nav.systemSymbol,
    ship.nav.waypointSymbol,
  );
  const qc = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (error) flash(error instanceof Error ? error.message : 'No market here', 'err');
  }, [error, flash]);

  const isDocked = ship.nav.status === 'DOCKED';

  // Refetch market when docking — API only returns tradeGoods/prices when a ship is docked
  useEffect(() => {
    if (isDocked) refetchMarket();
  }, [isDocked, refetchMarket]);

  const cargoSpace = ship.cargo.capacity - ship.cargo.units;

  const getQty = (symbol: string) => quantities[symbol] ?? 1;
  const setQty = (symbol: string, val: number) =>
    setQuantities((prev) => ({ ...prev, [symbol]: Math.max(1, val) }));

  const handleBuy = async (tradeSymbol: string, units: number) => {
    setBusy(true);
    try {
      const r = await api.purchaseCargo(ship.symbol, tradeSymbol, units);
      onShipUpdate({ ...ship, cargo: r.cargo });
      setAgent(r.agent);
      flash(`Bought ${units} ${tradeSymbol} — ¢${r.transaction.totalPrice.toLocaleString()}`);
      refetchMarket();
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Purchase failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  const handleSell = async (tradeSymbol: string, units: number) => {
    setBusy(true);
    try {
      const r = await api.sellCargo(ship.symbol, tradeSymbol, units);
      onShipUpdate({ ...ship, cargo: r.cargo });
      setAgent(r.agent);
      flash(`Sold ${units} ${tradeSymbol} — ¢${r.transaction.totalPrice.toLocaleString()}`);
      refetchMarket();
      qc.invalidateQueries({ queryKey: queryKeys.contracts });
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Sell failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading market…" />;
  if (!market) return <div className="fc-hint">No market at this waypoint.</div>;

  const hasTradeGoods = market.tradeGoods && market.tradeGoods.length > 0;

  // Build a set of goods the ship currently has in cargo for quick lookup
  const cargoMap = new Map(ship.cargo.inventory.map((i) => [i.symbol, i.units]));

  return (
    <div className="fc-market">
      {!isDocked && (
        <div className="fc-market-notice">
          Dock at this waypoint to buy and sell goods.
        </div>
      )}

      {hasTradeGoods ? (
        <>
          <div className="fc-section-title">
            Trade Goods
            <span className="fc-market-cargo-hint">
              Cargo: {ship.cargo.units}/{ship.cargo.capacity}
            </span>
          </div>
          <div className="fc-market-table">
            <div className="fc-market-header fc-market-header--trade">
              <span>Good</span>
              <span>Supply</span>
              <span>Buy</span>
              <span>Sell</span>
              <span>Qty</span>
              <span>Actions</span>
            </div>
            {market.tradeGoods!.map((g) => {
              const qty = getQty(g.symbol);
              const inCargo = cargoMap.get(g.symbol) ?? 0;
              const maxBuy = Math.min(g.tradeVolume, cargoSpace);

              return (
                <div key={g.symbol} className="fc-market-row fc-market-row--trade">
                  <span className="fc-market-good">{g.symbol}</span>
                  <span className={`fc-market-supply fc-market-supply--${g.supply.toLowerCase()}`}>
                    {g.supply}
                  </span>
                  <span className="fc-market-price fc-market-price--buy">
                    ¢{g.purchasePrice.toLocaleString()}
                  </span>
                  <span className="fc-market-price fc-market-price--sell">
                    ¢{g.sellPrice.toLocaleString()}
                  </span>
                  <div className="fc-market-qty">
                    <button
                      className="fc-qty-btn"
                      onClick={() => setQty(g.symbol, qty - 1)}
                      disabled={qty <= 1}
                    >−</button>
                    <input
                      className="fc-qty-input"
                      type="number"
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(g.symbol, parseInt(e.target.value) || 1)}
                    />
                    <button
                      className="fc-qty-btn"
                      onClick={() => setQty(g.symbol, qty + 1)}
                    >+</button>
                  </div>
                  <div className="fc-market-actions">
                    <button
                      className="fc-btn-sm fc-btn--primary"
                      disabled={busy || !isDocked || cargoSpace <= 0 || qty > maxBuy}
                      onClick={() => handleBuy(g.symbol, qty)}
                      title={!isDocked ? 'Must be docked' : cargoSpace <= 0 ? 'Cargo full' : `Buy ${qty} for ¢${(g.purchasePrice * qty).toLocaleString()}`}
                    >
                      Buy
                    </button>
                    <button
                      className="fc-btn-sm fc-btn--accent"
                      disabled={busy || !isDocked || inCargo <= 0}
                      onClick={() => handleSell(g.symbol, Math.min(qty, inCargo))}
                      title={!isDocked ? 'Must be docked' : inCargo <= 0 ? 'Not in cargo' : `Sell ${Math.min(qty, inCargo)} for ¢${(g.sellPrice * Math.min(qty, inCargo)).toLocaleString()}`}
                    >
                      Sell{inCargo > 0 ? ` (${inCargo})` : ''}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div className="fc-section-title">Market Overview</div>
          <div className="fc-market-notice">
            Dock a ship here to see detailed prices and trade.
          </div>
          {market.exports.length > 0 && (
            <div className="fc-market-section">
              <div className="fc-market-sub">Exports</div>
              <div className="fc-market-tags">
                {market.exports.map((e) => (
                  <span key={e.symbol} className="fc-scan-tag">{e.name}</span>
                ))}
              </div>
            </div>
          )}
          {market.imports.length > 0 && (
            <div className="fc-market-section">
              <div className="fc-market-sub">Imports</div>
              <div className="fc-market-tags">
                {market.imports.map((e) => (
                  <span key={e.symbol} className="fc-scan-tag">{e.name}</span>
                ))}
              </div>
            </div>
          )}
          {market.exchange.length > 0 && (
            <div className="fc-market-section">
              <div className="fc-market-sub">Exchange</div>
              <div className="fc-market-tags">
                {market.exchange.map((e) => (
                  <span key={e.symbol} className="fc-scan-tag">{e.name}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
