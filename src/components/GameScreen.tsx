import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { type Ship } from '../services/api';
import { usePrefetchShipData, useShipArrivalWatcher, useShipFromCache, useUpdateShipCache } from '../hooks/useQueries';
import DraggableWindow, { type WindowLayout } from './DraggableWindow';
import ShipsWindow from './ShipsWindow';
import shipIcon from '../assets/ships/generic.png';
import ContractsWindow from './ContractsWindow';
import FlightControl from './FlightControl';
import TradeRoutesWindow from './TradeRoutesWindow';
import NavigationGuide from './NavigationGuide';
import './GameScreen.css';

const STORAGE_KEY = 'st-window-layouts';

/** Column width ratio — left : center : right (e.g. 1:2:1) */
const COL_RATIO = [1.3, 2, 1.3] as const;

type WindowKey = 'ships' | 'trade' | 'flight' | 'contracts' | 'navguide';
type AllLayouts = Record<WindowKey, WindowLayout>;

function computeDefaultLayouts(): AllLayouts {
  const sw = window.innerWidth;
  const sh = window.innerHeight;
  const topBarH = 56;
  const gap = 20;
  const usableW = sw - gap * 4; // left-edge, left-center, center-right, right-edge
  const usableH = sh - topBarH - gap;

  const totalParts = COL_RATIO[0] + COL_RATIO[1] + COL_RATIO[2];
  const leftColW = Math.round(usableW * (COL_RATIO[0] / totalParts));
  const centerColW = Math.round(usableW * (COL_RATIO[1] / totalParts));
  const rightColW = sw - leftColW - centerColW - gap * 4;

  const leftX = gap;
  const centerX = leftX + leftColW + gap;
  const rightX = centerX + centerColW + gap;

  const leftTopH = Math.round((usableH - gap) * 0.42);
  const leftBottomH = usableH - leftTopH - gap;

  const rightTopH = Math.round((usableH - gap) * 0.55);
  const rightBottomH = usableH - rightTopH - gap;

  return {
    ships:     { x: leftX, y: topBarH, w: leftColW, h: leftTopH },
    trade:     { x: leftX, y: topBarH + leftTopH + gap, w: leftColW, h: leftBottomH },
    flight:    { x: centerX, y: topBarH, w: centerColW, h: usableH },
    contracts: { x: rightX, y: topBarH, w: rightColW, h: rightTopH },
    navguide:  { x: rightX, y: topBarH + rightTopH + gap, w: rightColW, h: rightBottomH },
  };
}

function isValidLayout(v: unknown): v is WindowLayout {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as WindowLayout).x === 'number' &&
    typeof (v as WindowLayout).y === 'number' &&
    typeof (v as WindowLayout).w === 'number' &&
    typeof (v as WindowLayout).h === 'number'
  );
}

const WINDOW_KEYS: WindowKey[] = ['ships', 'trade', 'flight', 'contracts', 'navguide'];

function loadLayouts(): AllLayouts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        WINDOW_KEYS.every((k) => isValidLayout((parsed as AllLayouts)[k]))
      ) {
        return parsed as AllLayouts;
      }
    }
  } catch { /* ignore corrupt data */ }
  return computeDefaultLayouts();
}

function saveLayouts(layouts: AllLayouts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
}

export default function GameScreen({ onBack }: { onBack: () => void }) {
  const { agent, disconnectAgent } = useAuth();
  const [topZ, setTopZ] = useState(11);
  const [windowZ, setWindowZ] = useState({ ships: 10, contracts: 10, flight: 10, trade: 10, navguide: 10 });
  const [selectedShipSymbol, setSelectedShipSymbol] = useState<string | null>(null);
  const [layouts, setLayouts] = useState<AllLayouts>(loadLayouts);
  const [layoutKey, setLayoutKey] = useState(0);
  const prefetchShipData = usePrefetchShipData();
  const updateShipCache = useUpdateShipCache();

  // Watch all in-transit ships and auto-refresh on arrival
  useShipArrivalWatcher();

  // Derive selectedShip from the query cache so it stays in sync
  const selectedShip = useShipFromCache(selectedShipSymbol);

  const bringToFront = useCallback((key: string) => {
    setTopZ((z) => z + 1);
    setWindowZ((prev) => ({ ...prev, [key]: topZ + 1 }));
  }, [topZ]);

  const handleSelectShip = useCallback((ship: Ship) => {
    setSelectedShipSymbol(ship.symbol);
    prefetchShipData(ship);
    bringToFront('flight');
  }, [bringToFront, prefetchShipData]);

  const handleShipUpdate = useCallback((updated: Ship) => {
    // Write updates to the shared query cache — all components re-render
    updateShipCache(updated);
  }, [updateShipCache]);

  const handleLayoutChange = useCallback((key: WindowKey) => (layout: WindowLayout) => {
    setLayouts((prev) => {
      const next = { ...prev, [key]: layout };
      saveLayouts(next);
      return next;
    });
  }, []);

  const handleResetWindows = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    const defaults = computeDefaultLayouts();
    setLayouts(defaults);
    setLayoutKey((k) => k + 1);
  }, []);

  return (
    <div className="game-screen">
      {/* Top bar */}
      <div className="game-topbar">
        <div className="game-topbar-left">
          <span className="game-topbar-callsign">{agent?.symbol}</span>
          <span className="game-topbar-sep">|</span>
          <span className="game-topbar-faction">{agent?.startingFaction}</span>
          <span className="game-topbar-sep">|</span>
          <span className="game-topbar-credits">
            ¢ {agent?.credits.toLocaleString()}
          </span>
        </div>
        <div className="game-topbar-right">
          <button className="game-topbar-btn" onClick={handleResetWindows}>
            Reset Windows
          </button>
          <button className="game-topbar-btn" onClick={onBack}>
            Mission Control
          </button>
          <button className="game-topbar-btn game-topbar-btn--danger" onClick={disconnectAgent}>
            Switch Agent
          </button>
        </div>
      </div>

      {/* Fleet — left side */}
      <DraggableWindow
        key={`ships-${layoutKey}`}
        title="Fleet"
        icon={shipIcon}
        defaultX={layouts.ships.x}
        defaultY={layouts.ships.y}
        defaultWidth={layouts.ships.w}
        defaultHeight={layouts.ships.h}
        minWidth={300}
        zIndex={windowZ.ships}
        onFocus={() => bringToFront('ships')}
        onLayoutChange={handleLayoutChange('ships')}
      >
        <ShipsWindow
          selectedShip={selectedShip?.symbol}
          onSelectShip={handleSelectShip}
        />
      </DraggableWindow>

      {/* Trade Routes — left, below fleet */}
      <DraggableWindow
        key={`trade-${layoutKey}`}
        title="Trade Routes"
        defaultX={layouts.trade.x}
        defaultY={layouts.trade.y}
        defaultWidth={layouts.trade.w}
        defaultHeight={layouts.trade.h}
        minWidth={300}
        minHeight={200}
        zIndex={windowZ.trade}
        onFocus={() => bringToFront('trade')}
        onLayoutChange={handleLayoutChange('trade')}
      >
        <TradeRoutesWindow systemSymbol={selectedShip?.nav.systemSymbol} />
      </DraggableWindow>

      {/* Flight Control — centre */}
      <DraggableWindow
        key={`flight-${layoutKey}`}
        title={selectedShip ? `Flight Control — ${selectedShip.symbol}` : 'Flight Control'}
        defaultX={layouts.flight.x}
        defaultY={layouts.flight.y}
        defaultWidth={layouts.flight.w}
        defaultHeight={layouts.flight.h}
        minWidth={400}
        minHeight={300}
        zIndex={windowZ.flight}
        onFocus={() => bringToFront('flight')}
        onLayoutChange={handleLayoutChange('flight')}
      >
        {selectedShip ? (
          <FlightControl ship={selectedShip} onShipUpdate={handleShipUpdate} />
        ) : (
          <div className="fc-empty">Select a ship from the fleet to begin.</div>
        )}
      </DraggableWindow>

      {/* Contracts — right side */}
      <DraggableWindow
        key={`contracts-${layoutKey}`}
        title="Contracts"
        defaultX={layouts.contracts.x}
        defaultY={layouts.contracts.y}
        defaultWidth={layouts.contracts.w}
        defaultHeight={layouts.contracts.h}
        minWidth={320}
        zIndex={windowZ.contracts}
        onFocus={() => bringToFront('contracts')}
        onLayoutChange={handleLayoutChange('contracts')}
      >
        <ContractsWindow selectedShipSymbol={selectedShip?.symbol} />
      </DraggableWindow>

      {/* Navigation Guide — right, below contracts */}
      <DraggableWindow
        key={`navguide-${layoutKey}`}
        title="Navigation Guide"
        defaultX={layouts.navguide.x}
        defaultY={layouts.navguide.y}
        defaultWidth={layouts.navguide.w}
        defaultHeight={layouts.navguide.h}
        minWidth={320}
        minHeight={200}
        zIndex={windowZ.navguide}
        onFocus={() => bringToFront('navguide')}
        onLayoutChange={handleLayoutChange('navguide')}
      >
        <NavigationGuide
          systemSymbol={selectedShip?.nav.systemSymbol}
          shipNav={selectedShip?.nav}
          engineSpeed={selectedShip?.engine.speed}
          fuel={selectedShip ? { current: selectedShip.fuel.current, capacity: selectedShip.fuel.capacity } : undefined}
        />
      </DraggableWindow>
    </div>
  );
}
