import { useState } from 'react';
import {
  api,
  type Ship,
  type ShipCooldown,
  type ScannedWaypoint,
  type ScannedShip,
  type ScannedSystem,
} from '../../services/api';

export default function ScanPanel({
  ship,
  busy,
  onCooldown,
  setBusy,
  setCooldown,
  flash,
}: {
  ship: Ship;
  busy: boolean;
  onCooldown: boolean;
  setBusy: (b: boolean) => void;
  setCooldown: (cd: ShipCooldown | null) => void;
  flash: (msg: string, type?: 'ok' | 'err') => void;
}) {
  const [scanResults, setScanResults] = useState<
    | { type: 'waypoints'; data: ScannedWaypoint[] }
    | { type: 'ships'; data: ScannedShip[] }
    | { type: 'systems'; data: ScannedSystem[] }
    | null
  >(null);

  const disabled = busy || onCooldown || ship.nav.status !== 'IN_ORBIT';

  const handleScan = async (kind: 'systems' | 'waypoints' | 'ships') => {
    setBusy(true);
    try {
      if (kind === 'systems') {
        const r = await api.scanSystems(ship.symbol);
        setCooldown(r.cooldown);
        setScanResults({ type: 'systems', data: r.systems });
        flash(`Found ${r.systems.length} systems`);
      } else if (kind === 'waypoints') {
        const r = await api.scanWaypoints(ship.symbol);
        setCooldown(r.cooldown);
        setScanResults({ type: 'waypoints', data: r.waypoints });
        flash(`Found ${r.waypoints.length} waypoints`);
      } else {
        const r = await api.scanShips(ship.symbol);
        setCooldown(r.cooldown);
        setScanResults({ type: 'ships', data: r.ships });
        flash(`Found ${r.ships.length} ships`);
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Scan failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fc-scan">
      {ship.nav.status !== 'IN_ORBIT' && (
        <div className="fc-hint">Ship must be in orbit to scan.</div>
      )}
      <div className="fc-action-row">
        <button className="fc-btn" disabled={disabled} onClick={() => handleScan('waypoints')}>
          Scan Waypoints
        </button>
        <button className="fc-btn" disabled={disabled} onClick={() => handleScan('ships')}>
          Scan Ships
        </button>
        <button className="fc-btn" disabled={disabled} onClick={() => handleScan('systems')}>
          Scan Systems
        </button>
      </div>

      {/* Results */}
      {scanResults && (
        <div className="fc-scan-results">
          <div className="fc-section-title">
            {scanResults.type === 'waypoints' && 'Waypoints'}
            {scanResults.type === 'ships' && 'Ships'}
            {scanResults.type === 'systems' && 'Systems'}
          </div>
          <div className="fc-scan-list">
            {scanResults.type === 'waypoints' &&
              scanResults.data.map((wp) => (
                <div key={wp.symbol} className="fc-scan-item">
                  <span className="fc-scan-primary">{wp.symbol}</span>
                  <span className="fc-scan-secondary">{wp.type}</span>
                  {wp.traits.length > 0 && (
                    <div className="fc-scan-traits">
                      {wp.traits.map((t) => (
                        <span key={t.symbol} className="fc-scan-tag">{t.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            {scanResults.type === 'ships' &&
              scanResults.data.map((s) => (
                <div key={s.symbol} className="fc-scan-item">
                  <span className="fc-scan-primary">{s.symbol}</span>
                  <span className="fc-scan-secondary">
                    {s.registration.role} · {s.nav.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            {scanResults.type === 'systems' &&
              scanResults.data.map((sys) => (
                <div key={sys.symbol} className="fc-scan-item">
                  <span className="fc-scan-primary">{sys.symbol}</span>
                  <span className="fc-scan-secondary">{sys.type} · {sys.distance} dist</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
