import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type Market } from '../services/api';
import { useWaypoints } from '../hooks/useQueries';
import LoadingSpinner from './LoadingSpinner';
import './TradeRoutesWindow.css';

interface TradeRoutesWindowProps {
  systemSymbol?: string | null;
}

interface WaypointMarket {
  waypoint: string;
  type: string;
  market: Market;
}

interface TradeLink {
  good: string;
  from: string;
  to: string;
  buyPrice?: number;
  sellPrice?: number;
  profit?: number;
}

function buildTradeLinks(fetched: WaypointMarket[]): TradeLink[] {
  const tradeLinks: TradeLink[] = [];
  const seen = new Set<string>();
  for (const src of fetched) {
    for (const exp of src.market.exports) {
      for (const dst of fetched) {
        if (dst.waypoint === src.waypoint) continue;
        const isImport = dst.market.imports.some((i) => i.symbol === exp.symbol);
        const isExchange = dst.market.exchange.some((e) => e.symbol === exp.symbol);
        if (isImport || isExchange) {
          const key = `${exp.symbol}:${src.waypoint}:${dst.waypoint}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const srcGood = src.market.tradeGoods?.find((g) => g.symbol === exp.symbol);
          const dstGood = dst.market.tradeGoods?.find((g) => g.symbol === exp.symbol);
          tradeLinks.push({
            good: exp.symbol,
            from: src.waypoint,
            to: dst.waypoint,
            buyPrice: srcGood?.purchasePrice,
            sellPrice: dstGood?.sellPrice,
            profit:
              srcGood?.purchasePrice && dstGood?.sellPrice
                ? dstGood.sellPrice - srcGood.purchasePrice
                : undefined,
          });
        }
      }
    }
  }
  tradeLinks.sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity));
  return tradeLinks;
}

export default function TradeRoutesWindow({ systemSymbol }: TradeRoutesWindowProps) {
  const [view, setView] = useState<'routes' | 'markets'>('routes');
  const [resourceFilter, setResourceFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const { data: waypoints } = useWaypoints(systemSymbol);

  const marketWpSymbols = useMemo(() => {
    if (!waypoints) return [];
    return waypoints
      .filter((wp) => wp.traits.some((t) => t.symbol === 'MARKETPLACE'))
      .map((wp) => ({ symbol: wp.symbol, type: wp.type }));
  }, [waypoints]);

  const { data: tradeData, isLoading: loading, error } = useQuery({
    queryKey: ['tradeData', systemSymbol],
    queryFn: async () => {
      const fetched: WaypointMarket[] = [];
      for (const wp of marketWpSymbols) {
        try {
          const m = await api.getMarket(systemSymbol!, wp.symbol);
          fetched.push({ waypoint: wp.symbol, type: wp.type, market: m });
        } catch { /* skip inaccessible markets */ }
      }
      return { markets: fetched, links: buildTradeLinks(fetched) };
    },
    enabled: !!systemSymbol && marketWpSymbols.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 1000 * 60 * 60, // keep for 1 hour
  });

  const markets = tradeData?.markets ?? [];
  const links = tradeData?.links ?? [];

  // Collect unique resource symbols for filter dropdown
  const allResources = useMemo(() => {
    const set = new Set<string>();
    for (const link of links) set.add(link.good);
    for (const m of markets) {
      for (const e of m.market.exports) set.add(e.symbol);
      for (const i of m.market.imports) set.add(i.symbol);
      for (const x of m.market.exchange) set.add(x.symbol);
      for (const g of m.market.tradeGoods ?? []) set.add(g.symbol);
    }
    return Array.from(set).sort();
  }, [links, markets]);

  const allLocations = useMemo(() => {
    const set = new Set<string>();
    for (const link of links) { set.add(link.from); set.add(link.to); }
    for (const m of markets) set.add(m.waypoint);
    return Array.from(set).sort();
  }, [links, markets]);

  // Filtered trade routes
  const filteredLinks = useMemo(() => {
    let result = links;
    if (resourceFilter) {
      result = result.filter((l) => l.good === resourceFilter);
    }
    if (locationFilter) {
      result = result.filter((l) => l.from === locationFilter || l.to === locationFilter);
    }
    return result;
  }, [links, resourceFilter, locationFilter]);

  // Markets: check if a market matches the filters, sort matches to top
  const sortedMarkets = useMemo(() => {
    if (!resourceFilter && !locationFilter) return markets;
    const scored = markets.map((m) => {
      let match = false;
      if (locationFilter && m.waypoint === locationFilter) match = true;
      if (resourceFilter) {
        const hasResource =
          m.market.exports.some((e) => e.symbol === resourceFilter) ||
          m.market.imports.some((i) => i.symbol === resourceFilter) ||
          m.market.exchange.some((x) => x.symbol === resourceFilter);
        if (hasResource) match = true;
        else if (!locationFilter) match = false;
      }
      return { m, match };
    });
    scored.sort((a, b) => (a.match === b.match ? 0 : a.match ? -1 : 1));
    return scored.map((s) => ({ ...s.m, _match: s.match }));
  }, [markets, resourceFilter, locationFilter]);

  /** Check if a trade-good symbol matches the resource filter */
  const isResourceMatch = (symbol: string) =>
    resourceFilter ? symbol === resourceFilter : false;

  if (!systemSymbol) {
    return <div className="tr-hint">Select a ship to view system trade routes.</div>;
  }

  if (loading) {
    return <LoadingSpinner message="Scanning markets…" />;
  }

  if (error) {
    return <div className="tr-error">{error instanceof Error ? error.message : 'Failed to load trade data'}</div>;
  }

  return (
    <div className="tr">
      <div className="tr-system">System: {systemSymbol}</div>

      {/* View toggle */}
      <div className="tr-toggle">
        <button
          className={`tr-toggle-btn ${view === 'routes' ? 'tr-toggle-btn--active' : ''}`}
          onClick={() => setView('routes')}
        >
          Trade Routes
        </button>
        <button
          className={`tr-toggle-btn ${view === 'markets' ? 'tr-toggle-btn--active' : ''}`}
          onClick={() => setView('markets')}
        >
          Markets ({markets.length})
        </button>
      </div>

      {/* Filters */}
      <div className="tr-filters">
        <div className="tr-filter">
          <label className="tr-filter-label">Resource</label>
          <select
            className="tr-filter-select"
            value={resourceFilter}
            onChange={(e) => setResourceFilter(e.target.value)}
          >
            <option value="">All</option>
            {allResources.map((r) => (
              <option key={r} value={r}>{formatResource(r)}</option>
            ))}
          </select>
        </div>
        <div className="tr-filter">
          <label className="tr-filter-label">Location</label>
          <select
            className="tr-filter-select"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          >
            <option value="">All</option>
            {allLocations.map((l) => (
              <option key={l} value={l}>{shortWp(l)}</option>
            ))}
          </select>
        </div>
        {(resourceFilter || locationFilter) && (
          <button
            className="tr-filter-clear"
            onClick={() => { setResourceFilter(''); setLocationFilter(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {view === 'routes' && (
        <div className="tr-routes">
          {filteredLinks.length === 0 ? (
            <div className="tr-hint">No trade routes found{resourceFilter || locationFilter ? ' matching filters' : ' in this system'}.</div>
          ) : (
            filteredLinks.map((link, i) => (
              <div key={i} className={`tr-route ${link.profit !== undefined && link.profit > 0 ? 'tr-route--profitable' : ''}`}>
                <div className="tr-route-good">{formatResource(link.good)}</div>
                <div className="tr-route-path">
                  <span className="tr-route-wp">{shortWp(link.from)}</span>
                  <span className="tr-route-arrow">→</span>
                  <span className="tr-route-wp">{shortWp(link.to)}</span>
                </div>
                <div className="tr-route-prices">
                  {link.buyPrice !== undefined && (
                    <span className="tr-route-buy">Buy ¢{link.buyPrice.toLocaleString()}</span>
                  )}
                  {link.sellPrice !== undefined && (
                    <span className="tr-route-sell">Sell ¢{link.sellPrice.toLocaleString()}</span>
                  )}
                  {link.profit !== undefined && (
                    <span className={`tr-route-profit ${link.profit > 0 ? 'tr-route-profit--pos' : 'tr-route-profit--neg'}`}>
                      {link.profit > 0 ? '+' : ''}¢{link.profit.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {view === 'markets' && (
        <div className="tr-markets">
          {sortedMarkets.length === 0 ? (
            <div className="tr-hint">No markets found in this system.</div>
          ) : (
            sortedMarkets.map((m) => {
              const highlighted = '_match' in m && m._match;
              return (
              <div key={m.waypoint} className={`tr-market ${highlighted ? 'tr-market--highlight' : ''} ${(resourceFilter || locationFilter) && !highlighted ? 'tr-market--dim' : ''}`}>
                <div className="tr-market-header">
                  <span className={`tr-market-wp ${locationFilter && m.waypoint === locationFilter ? 'tr-market-wp--match' : ''}`}>{m.waypoint}</span>
                  <span className="tr-market-type">{m.type}</span>
                </div>
                {m.market.exports.length > 0 && (
                  <div className="tr-market-row">
                    <span className="tr-market-label tr-label--export">EXP</span>
                    <div className="tr-market-tags">
                      {m.market.exports.map((e) => (
                        <span key={e.symbol} className={`tr-tag tr-tag--export ${isResourceMatch(e.symbol) ? 'tr-tag--match' : ''}`}>{formatResource(e.symbol)}</span>
                      ))}
                    </div>
                  </div>
                )}
                {m.market.imports.length > 0 && (
                  <div className="tr-market-row">
                    <span className="tr-market-label tr-label--import">IMP</span>
                    <div className="tr-market-tags">
                      {m.market.imports.map((e) => (
                        <span key={e.symbol} className={`tr-tag tr-tag--import ${isResourceMatch(e.symbol) ? 'tr-tag--match' : ''}`}>{formatResource(e.symbol)}</span>
                      ))}
                    </div>
                  </div>
                )}
                {m.market.exchange.length > 0 && (
                  <div className="tr-market-row">
                    <span className="tr-market-label tr-label--exchange">XCH</span>
                    <div className="tr-market-tags">
                      {m.market.exchange.map((e) => (
                        <span key={e.symbol} className={`tr-tag tr-tag--exchange ${isResourceMatch(e.symbol) ? 'tr-tag--match' : ''}`}>{formatResource(e.symbol)}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/** Shorten waypoint symbol to last segment for display */
function shortWp(wp: string): string {
  const parts = wp.split('-');
  return parts.length > 2 ? parts.slice(-1)[0] : wp;
}

/** Format a SCREAMING_SNAKE symbol into Title Case for display */
function formatResource(symbol: string): string {
  return symbol
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}
