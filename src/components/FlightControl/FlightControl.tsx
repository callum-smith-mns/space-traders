import { useState, useEffect, useRef, useCallback } from 'react';
import { type Ship, type Survey } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useWaypoints, useShipCooldown } from '../../hooks/useQueries';
import { formatEta } from '../../utils/formatEta';
import * as surveyCache from '../../utils/surveyCache';
import shipIcon from '../../assets/ships/generic.png';
import './FlightControl.css';

import { TransitProgressBar, TabBtn, FuelBar } from './shared';
import ShipDetailsPanel from './ShipDetailsPanel';
import NavPanel from './NavPanel';
import ScanPanel from './ScanPanel';
import ExtractPanel from './ExtractPanel';
import CargoPanel from './CargoPanel';
import MarketPanel from './MarketPanel';
import ShipyardPanel from './ShipyardPanel';

interface FlightControlProps {
  ship: Ship;
  onShipUpdate: (ship: Ship) => void;
}

type Tab = 'details' | 'nav' | 'scan' | 'extract' | 'cargo' | 'market' | 'shipyard';

export default function FlightControl({ ship, onShipUpdate }: FlightControlProps) {
  const { setAgent } = useAuth();
  const [tab, setTab] = useState<Tab>('details');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [estimatedFuelCost, setEstimatedFuelCost] = useState(0);

  // Centralized cooldown from query cache — survives tab switches, syncs to fleet list
  const { cooldown, setCooldown, isOnCooldown } = useShipCooldown(ship.symbol);

  // Surveys state — backed by a module-level cache keyed by waypoint
  const waypoint = ship.nav.waypointSymbol;
  const [surveys, setSurveysLocal] = useState<Survey[]>(() => surveyCache.getSurveys(waypoint));
  const prevWaypointRef = useRef(waypoint);

  // When ship changes waypoint (or we switch ships), load cached surveys for that waypoint
  useEffect(() => {
    if (waypoint !== prevWaypointRef.current) {
      setSurveysLocal(surveyCache.getSurveys(waypoint));
      prevWaypointRef.current = waypoint;
    }
  }, [waypoint]);

  // Wrapper that writes through to the cache
  const setSurveys: React.Dispatch<React.SetStateAction<Survey[]>> = (action) => {
    setSurveysLocal((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      surveyCache.setSurveys(waypoint, next);
      return next;
    });
  };

  const flash = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 4000);
  }, []);

  const onCooldown = isOnCooldown;

  const hasMiningMount = ship.mounts.some((m) =>
    m.symbol.includes('MINING') || m.symbol.includes('SURVEYOR')
  );
  const hasSiphonMount = ship.mounts.some((m) => m.symbol.includes('SIPHON'));
  const canExtract = hasMiningMount || hasSiphonMount;

  // Check if current waypoint has a shipyard
  const { data: systemWaypoints } = useWaypoints(ship.nav.systemSymbol);
  const currentWaypoint = systemWaypoints?.find((wp) => wp.symbol === ship.nav.waypointSymbol);
  const hasShipyard = currentWaypoint?.traits.some((t) => t.symbol === 'SHIPYARD') ?? false;

  return (
    <div className="fc">
      {/* Ship header */}
      <div className="fc-header">
        <div className="fc-header-top">
          <img src={shipIcon} alt="" className="fc-ship-icon" />
          <div className="fc-header-info">
            <div className="fc-ship-name">{ship.symbol}</div>
            <div className="fc-ship-role">{ship.registration.role} · {ship.frame.name}</div>
          </div>
        </div>
        <div className="fc-ship-status">
          <span className={`fc-nav-badge fc-nav-badge--${ship.nav.status.toLowerCase().replace('_', '-')}`}>
            {ship.nav.status === 'IN_TRANSIT' ? 'EN ROUTE' : ship.nav.status.replace('_', ' ')}
          </span>
          <span className="fc-location">
            {ship.nav.status === 'IN_TRANSIT'
              ? `→ ${ship.nav.route.destination.symbol}`
              : ship.nav.waypointSymbol}
          </span>
        </div>
        {/* Transit progress bar */}
        {ship.nav.status === 'IN_TRANSIT' && (
          <TransitProgressBar
            departureTime={ship.nav.route.departureTime}
            arrivalTime={ship.nav.route.arrival}
          />
        )}
        {/* Fuel bar with estimated deduction */}
        <FuelBar fuel={ship.fuel} estimatedCost={estimatedFuelCost} />
      </div>

      {/* Cooldown bar */}
      {onCooldown && cooldown && (
        <div className="fc-cooldown">
          <div className="fc-cooldown-label">COOLDOWN {formatEta(cooldown.remainingSeconds)}</div>
          <div className="fc-cooldown-track">
            <div
              className="fc-cooldown-fill"
              style={{
                width: `${((cooldown.totalSeconds - cooldown.remainingSeconds) / cooldown.totalSeconds) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Feedback toast */}
      {feedback && (
        <div className={`fc-feedback fc-feedback--${feedback.type}`}>
          {feedback.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="fc-tabs">
        <TabBtn active={tab === 'details'} onClick={() => setTab('details')}>Details</TabBtn>
        <TabBtn active={tab === 'nav'} onClick={() => setTab('nav')}>Navigation</TabBtn>
        <TabBtn active={tab === 'scan'} onClick={() => setTab('scan')}>Scan</TabBtn>
        {canExtract && (
          <TabBtn active={tab === 'extract'} onClick={() => setTab('extract')}>Extract</TabBtn>
        )}
        <TabBtn active={tab === 'cargo'} onClick={() => setTab('cargo')}>Cargo</TabBtn>
        <TabBtn active={tab === 'market'} onClick={() => setTab('market')}>Market</TabBtn>
        {hasShipyard && (
          <TabBtn active={tab === 'shipyard'} onClick={() => setTab('shipyard')}>Shipyard</TabBtn>
        )}
      </div>

      {/* Tab content */}
      <div className="fc-panel">
        {tab === 'details' && <ShipDetailsPanel ship={ship} />}
        {tab === 'nav' && (
          <NavPanel
            ship={ship}
            busy={busy}
            setBusy={setBusy}
            flash={flash}
            onNavUpdate={(nav) => onShipUpdate({ ...ship, nav })}
            onFuelUpdate={(fuel) => onShipUpdate({ ...ship, fuel })}
            onShipUpdate={onShipUpdate}
            setAgent={setAgent}
            onEstimatedFuelCost={setEstimatedFuelCost}
          />
        )}
        {tab === 'scan' && (
          <ScanPanel
            ship={ship}
            busy={busy}
            onCooldown={!!onCooldown}
            setBusy={setBusy}
            setCooldown={setCooldown}
            flash={flash}
          />
        )}
        {tab === 'extract' && (
          <ExtractPanel
            ship={ship}
            busy={busy}
            onCooldown={!!onCooldown}
            setBusy={setBusy}
            setCooldown={setCooldown}
            flash={flash}
            onCargoUpdate={(cargo) => onShipUpdate({ ...ship, cargo })}
            hasMining={hasMiningMount}
            hasSiphon={hasSiphonMount}
            surveys={surveys}
            setSurveys={setSurveys}
          />
        )}
        {tab === 'cargo' && (
          <CargoPanel
            ship={ship}
            busy={busy}
            setBusy={setBusy}
            flash={flash}
            onCargoUpdate={(cargo) => onShipUpdate({ ...ship, cargo })}
            setAgent={setAgent}
            onCooldown={!!onCooldown}
            setCooldown={setCooldown}
          />
        )}
        {tab === 'market' && (
          <MarketPanel
            ship={ship}
            busy={busy}
            setBusy={setBusy}
            flash={flash}
            onShipUpdate={onShipUpdate}
            setAgent={setAgent}
          />
        )}
        {tab === 'shipyard' && (
          <ShipyardPanel
            ship={ship}
            busy={busy}
            setBusy={setBusy}
            flash={flash}
            setAgent={setAgent}
          />
        )}
      </div>
    </div>
  );
}
