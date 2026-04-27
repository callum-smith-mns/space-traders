import { useState, useEffect, useRef, useCallback } from 'react';
import { api, type Ship, type ShipCooldown, type Survey } from '../../services/api';
import { formatEta } from '../../utils/formatEta';
import { CargoBar } from './shared';

export default function ExtractPanel({
  ship,
  busy,
  onCooldown,
  setBusy,
  setCooldown,
  flash,
  onCargoUpdate,
  hasMining,
  hasSiphon,
  surveys,
  setSurveys,
}: {
  ship: Ship;
  busy: boolean;
  onCooldown: boolean;
  setBusy: (b: boolean) => void;
  setCooldown: (cd: ShipCooldown | null) => void;
  flash: (msg: string, type?: 'ok' | 'err') => void;
  onCargoUpdate: (cargo: Ship['cargo']) => void;
  hasMining: boolean;
  hasSiphon: boolean;
  surveys: Survey[];
  setSurveys: React.Dispatch<React.SetStateAction<Survey[]>>;
}) {
  const disabled = busy || onCooldown || ship.nav.status !== 'IN_ORBIT';
  const [autoMode, setAutoMode] = useState<'mine' | 'siphon' | null>(null);
  const [autoSurvey, setAutoSurvey] = useState<Survey | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const autoRef = useRef<{ mode: 'mine' | 'siphon' | null; survey: Survey | null }>({ mode: null, survey: null });

  // Sync autoRef via effect — cannot write refs during render
  useEffect(() => {
    autoRef.current = { mode: autoMode, survey: autoSurvey };
  }, [autoMode, autoSurvey]);

  // Tick timer for survey expiration display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const hasSurveyMount = ship.mounts.some((m) =>
    m.symbol.includes('SURVEYOR') || m.symbol.includes('SENSOR')
  );

  const cargoFull = ship.cargo.units >= ship.cargo.capacity;

  // Prune expired surveys
  useEffect(() => {
    const currentTs = Date.now();
    setSurveys((prev) => {
      const filtered = prev.filter((s) => new Date(s.expiration).getTime() > currentTs);
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [onCooldown, setSurveys]);

  const removeSurvey = useCallback((signature: string) => {
    setSurveys((prev) => prev.filter((s) => s.signature !== signature));
    if (autoRef.current.survey?.signature === signature) {
      setAutoSurvey(null);
    }
  }, [setSurveys]);

  const doExtract = useCallback(async (survey?: Survey | null): Promise<boolean> => {
    setBusy(true);
    try {
      // If the survey is expired, drop it and stop (don't fall through to plain extraction)
      if (survey && new Date(survey.expiration).getTime() <= Date.now()) {
        removeSurvey(survey.signature);
        flash('Survey expired', 'err');
        return false;
      }
      const r = survey
        ? await api.extractWithSurvey(ship.symbol, survey)
        : await api.extractResources(ship.symbol);
      setCooldown(r.cooldown);
      onCargoUpdate(r.cargo);
      flash(`Extracted ${r.extraction.yield.units} ${r.extraction.yield.symbol}`);
      return r.cargo.units < r.cargo.capacity;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Extraction failed';
      // If survey is exhausted/expired, remove it
      if (survey && (msg.includes('exhausted') || msg.includes('expired') || msg.includes('survey'))) {
        removeSurvey(survey.signature);
      }
      flash(msg, 'err');
      return false;
    } finally {
      setBusy(false);
    }
  }, [ship.symbol, setBusy, setCooldown, onCargoUpdate, flash, removeSurvey]);

  const doSiphon = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const r = await api.siphonResources(ship.symbol);
      setCooldown(r.cooldown);
      onCargoUpdate(r.cargo);
      flash(`Siphoned ${r.siphon.yield.units} ${r.siphon.yield.symbol}`);
      return r.cargo.units < r.cargo.capacity;
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Siphon failed', 'err');
      return false;
    } finally {
      setBusy(false);
    }
  }, [ship.symbol, setBusy, setCooldown, onCargoUpdate, flash]);

  const handleSurvey = async () => {
    setBusy(true);
    try {
      const r = await api.surveyWaypoint(ship.symbol);
      setCooldown(r.cooldown);
      setSurveys((prev) => [...prev, ...r.surveys]);
      flash(`Survey found ${r.surveys.length} result${r.surveys.length !== 1 ? 's' : ''}`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Survey failed', 'err');
    } finally {
      setBusy(false);
    }
  };

  // Stable function refs for the auto-repeat effect
  const doExtractRef = useRef(doExtract);
  const doSiphonRef = useRef(doSiphon);
  useEffect(() => { doExtractRef.current = doExtract; }, [doExtract]);
  useEffect(() => { doSiphonRef.current = doSiphon; }, [doSiphon]);

  // Auto-repeat: trigger next action when cooldown expires
  const prevOnCooldown = useRef(onCooldown);
  useEffect(() => {
    const wasCooling = prevOnCooldown.current;
    prevOnCooldown.current = onCooldown;

    if (wasCooling && !onCooldown && autoRef.current.mode && !busy) {
      const { mode, survey } = autoRef.current;
      const timer = setTimeout(async () => {
        if (!autoRef.current.mode) return;
        const canContinue = mode === 'mine'
          ? await doExtractRef.current(survey)
          : await doSiphonRef.current();
        if (!canContinue) { setAutoMode(null); setAutoSurvey(null); }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [onCooldown, busy]);

  const handleExtract = async (survey?: Survey | null) => {
    const canContinue = await doExtract(survey);
    if (autoMode === 'mine' && !canContinue) { setAutoMode(null); setAutoSurvey(null); }
  };

  const handleSiphon = async () => {
    const canContinue = await doSiphon();
    if (autoMode === 'siphon' && !canContinue) setAutoMode(null);
  };

  const toggleAuto = (mode: 'mine' | 'siphon', survey?: Survey | null) => {
    if (autoMode === mode && (!survey || autoSurvey?.signature === survey?.signature)) {
      setAutoMode(null);
      setAutoSurvey(null);
      flash('Auto-extract off');
    } else {
      setAutoMode(mode);
      setAutoSurvey(survey ?? null);
      const label = survey
        ? `Auto-mine (survey)`
        : `Auto-${mode}`;
      flash(`${label} on`);
      if (!busy && !onCooldown && ship.nav.status === 'IN_ORBIT') {
        if (mode === 'mine') doExtract(survey);
        else doSiphon();
      }
    }
  };

  const activeSurveys = surveys.filter((s) => new Date(s.expiration).getTime() > now);

  return (
    <div className="fc-extract">
      {ship.nav.status !== 'IN_ORBIT' && (
        <div className="fc-hint">Ship must be in orbit to extract.</div>
      )}

      <CargoBar cargo={ship.cargo} />

      {/* Main action buttons */}
      <div className="fc-extract-actions">
        {hasMining && (
          <div className="fc-extract-group">
            <button
              className={`fc-extract-btn fc-extract-btn--auto ${autoMode === 'mine' && !autoSurvey ? 'fc-extract-btn--active' : ''}`}
              onClick={() => toggleAuto('mine')}
              title={autoMode === 'mine' && !autoSurvey ? 'Stop auto-mining' : 'Start auto-mining'}
              disabled={ship.nav.status !== 'IN_ORBIT' || cargoFull}
            >
              <span className={`fc-auto-light ${autoMode === 'mine' && !autoSurvey ? 'fc-auto-light--on' : ''}`} />
              Auto
            </button>
            <button
              className="fc-extract-btn fc-extract-btn--action"
              disabled={disabled}
              onClick={() => handleExtract()}
            >
              Mine / Extract
            </button>
          </div>
        )}
        {hasSiphon && (
          <div className="fc-extract-group">
            <button
              className={`fc-extract-btn fc-extract-btn--auto ${autoMode === 'siphon' ? 'fc-extract-btn--active' : ''}`}
              onClick={() => toggleAuto('siphon')}
              title={autoMode === 'siphon' ? 'Stop auto-siphon' : 'Start auto-siphon'}
              disabled={ship.nav.status !== 'IN_ORBIT' || cargoFull}
            >
              <span className={`fc-auto-light ${autoMode === 'siphon' ? 'fc-auto-light--on' : ''}`} />
              Auto
            </button>
            <button
              className="fc-extract-btn fc-extract-btn--action"
              disabled={disabled}
              onClick={handleSiphon}
            >
              Siphon
            </button>
          </div>
        )}
        {hasSurveyMount && hasMining && (
          <button
            className="fc-extract-btn fc-extract-btn--survey"
            disabled={disabled}
            onClick={handleSurvey}
          >
            Survey
          </button>
        )}
      </div>

      {autoMode && (
        <div className="fc-auto-status">
          Auto-{autoMode}{autoSurvey ? ' (survey)' : ''} active — {onCooldown ? 'waiting for cooldown…' : cargoFull ? 'cargo full' : 'ready'}
        </div>
      )}

      {/* Survey results */}
      {activeSurveys.length > 0 && (
        <div className="fc-surveys">
          <div className="fc-section-title">Survey Results</div>
          {activeSurveys.map((survey) => {
            const expiresIn = Math.max(0, Math.ceil((new Date(survey.expiration).getTime() - now) / 1000));
            const isAutoTarget = autoSurvey?.signature === survey.signature;
            // Count deposit occurrences for display
            const depositCounts = new Map<string, number>();
            survey.deposits.forEach((d) => depositCounts.set(d.symbol, (depositCounts.get(d.symbol) ?? 0) + 1));
            return (
              <div key={survey.signature} className={`fc-survey ${isAutoTarget ? 'fc-survey--active' : ''}`}>
                <div className="fc-survey-header">
                  <span className={`fc-survey-size fc-survey-size--${survey.size.toLowerCase()}`}>
                    {survey.size}
                  </span>
                  <span className="fc-survey-expires">
                    {formatEta(expiresIn)}
                  </span>
                  <div className="fc-survey-actions">
                    <button
                      className={`fc-extract-btn fc-extract-btn--auto fc-extract-btn--sm ${isAutoTarget ? 'fc-extract-btn--active' : ''}`}
                      onClick={() => toggleAuto('mine', survey)}
                      title={isAutoTarget ? 'Stop auto-mining this survey' : 'Auto-mine using this survey'}
                      disabled={ship.nav.status !== 'IN_ORBIT' || cargoFull}
                    >
                      <span className={`fc-auto-light ${isAutoTarget ? 'fc-auto-light--on' : ''}`} />
                      Auto
                    </button>
                    <button
                      className="fc-extract-btn fc-extract-btn--action fc-extract-btn--sm"
                      disabled={disabled}
                      onClick={() => handleExtract(survey)}
                    >
                      Mine
                    </button>
                  </div>
                </div>
                <div className="fc-survey-deposits">
                  {[...depositCounts.entries()].map(([symbol, count]) => (
                    <div key={symbol} className="fc-survey-deposit">
                      <span className="fc-survey-deposit-name">{symbol}</span>
                      {count > 1 && <span className="fc-survey-deposit-count">×{count}</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Current cargo */}
      {ship.cargo.inventory.length > 0 && (
        <div className="fc-cargo-list">
          {ship.cargo.inventory.map((item) => (
            <div key={item.symbol} className="fc-cargo-item">
              <span>{item.name}</span>
              <span className="fc-cargo-units">×{item.units}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
