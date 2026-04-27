import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useFactions } from '../hooks/useQueries';
import factionLogos from '../utils/factionLogos';
import './AgentScreen.css';

export default function AgentScreen({ onLaunch }: { onLaunch: () => void }) {
  const { agent, logout, disconnectAgent, setAgentToken, isAccountToken, savedAgents, loginSavedAgent, deleteSavedAgent, loading: authLoading } = useAuth();
  const { data: factions = [], isLoading: factionsLoading } = useFactions();
  const [callsign, setCallsign] = useState('');
  const [selectedFaction, setSelectedFaction] = useState('COSMIC');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const symbol = callsign.trim().toUpperCase();
    if (symbol.length < 3 || symbol.length > 14) {
      setError('Callsign must be 3-14 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(symbol)) {
      setError('Callsign can only contain letters, numbers, hyphens and underscores.');
      return;
    }
    if (!selectedFaction) {
      setError('Select a starting faction.');
      return;
    }
    setRegistering(true);
    try {
      const result = await api.registerAgent(symbol, selectedFaction);
      await setAgentToken(result.token, result.agent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setRegistering(false);
    }
  }

  const selectedFactionData = factions.find((f) => f.symbol === selectedFaction);

  // Other saved agents (excluding the currently active one)
  const otherAgents = savedAgents.filter((a) => a.symbol !== agent?.symbol);

  async function handleSelectAgent(symbol: string) {
    setError(null);
    try {
      await loginSavedAgent(symbol);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    }
  }

  function handleConfirmDelete() {
    if (confirmDelete) {
      deleteSavedAgent(confirmDelete);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="agent-screen">
      <div className="agent-card">
        <div className="agent-header">
          <h2 className="agent-title">Mission Control</h2>
          <div className="agent-header-actions">
            {agent && (
              <button className="agent-logout" onClick={disconnectAgent}>
                Switch Agent
              </button>
            )}
            <button className="agent-logout" onClick={logout}>
              {isAccountToken && !agent ? 'Change Account' : 'Logout'}
            </button>
          </div>
        </div>

        {isAccountToken && !agent && (
          <div className="agent-account-notice">
            <span className="agent-account-badge">Account Token</span>
            <span>Connected with your account token. Register a new agent below, or disconnect and use an agent token instead.</span>
          </div>
        )}

        {error && <div className="agent-error">{error}</div>}

        {/* Existing Agent */}
        {agent && (
          <>
            <div className="agent-info">
              <div className="agent-info-row">
                <span className="agent-info-label">Callsign</span>
                <span className="agent-info-value">{agent.symbol}</span>
              </div>
              <div className="agent-info-row">
                <span className="agent-info-label">Faction</span>
                <span className="agent-info-value">
                  {agent.startingFaction}
                </span>
              </div>
              <div className="agent-info-row">
                <span className="agent-info-label">HQ</span>
                <span className="agent-info-value">{agent.headquarters}</span>
              </div>
              <div className="agent-info-row">
                <span className="agent-info-label">Credits</span>
                <span className="agent-info-value credits">
                  {agent.credits.toLocaleString()}
                </span>
              </div>
              <div className="agent-info-row">
                <span className="agent-info-label">Ships</span>
                <span className="agent-info-value">{agent.shipCount}</span>
              </div>
            </div>

            <button className="agent-continue-btn" onClick={onLaunch}>
              Continue Mission ▸
            </button>
          </>
        )}

        {/* Saved agents — always shown if there are other agents to switch to */}
        {otherAgents.length > 0 && (
          <>
            <div className="agent-divider">Switch agent</div>
            <div className="agent-saved-list">
              {otherAgents.map((sa) => (
                <div key={sa.symbol} className="agent-saved-row">
                  <button
                    type="button"
                    className="agent-saved-btn"
                    disabled={authLoading}
                    onClick={() => handleSelectAgent(sa.symbol)}
                  >
                    <span className="agent-saved-symbol">{sa.symbol}</span>
                    <span className="agent-saved-meta">{sa.faction} · {sa.headquarters}</span>
                  </button>
                  {confirmDelete === sa.symbol ? (
                    <div className="agent-saved-confirm">
                      <button className="agent-saved-confirm-yes" onClick={handleConfirmDelete}>Remove</button>
                      <button className="agent-saved-confirm-no" onClick={() => setConfirmDelete(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="agent-saved-delete"
                      title="Remove agent"
                      onClick={() => setConfirmDelete(sa.symbol)}
                    >×</button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Divider */}
        <div className="agent-divider">
          {agent ? 'Or register new agent' : 'Register new agent'}
        </div>

        {/* Register new agent */}
        <form className="register-section" onSubmit={handleRegister}>
          <div className="register-field">
            <label className="register-label" htmlFor="callsign-input">
              Agent Callsign
            </label>
            <input
              id="callsign-input"
              className="register-input"
              type="text"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="3-14 characters (A-Z, 0-9, - _)"
              maxLength={14}
              minLength={3}
              pattern="[a-zA-Z0-9_-]+"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="register-field">
            <label className="register-label">Starting Faction</label>

            {factionsLoading ? (
              <div className="loading-text">Loading factions...</div>
            ) : (
              <>
                {/* Faction list */}
                <div className="faction-list">
                  {factions.map((f) => (
                    <button
                      key={f.symbol}
                      type="button"
                      className={`faction-card ${selectedFaction === f.symbol ? 'selected' : ''}`}
                      onClick={() => setSelectedFaction(f.symbol)}
                    >
                      <div className="faction-card-logo">
                        {factionLogos[f.symbol] ? (
                          <img
                            src={factionLogos[f.symbol]}
                            alt={f.name}
                            className="faction-logo-img"
                          />
                        ) : (
                          <div className="faction-logo-placeholder">
                            {f.symbol.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="faction-card-body">
                        <div className="faction-card-top">
                          <span className="faction-card-name">{f.name}</span>
                          <span
                            className={`faction-card-status ${f.isRecruiting ? 'open' : 'closed'}`}
                          >
                            {f.isRecruiting ? 'RECRUITING' : 'CLOSED'}
                          </span>
                        </div>
                        <div className="faction-card-traits">
                          {f.traits.slice(0, 4).map((t) => (
                            <span key={t.symbol} className="faction-trait-tag">
                              {t.name}
                            </span>
                          ))}
                          {f.traits.length > 4 && (
                            <span className="faction-trait-tag more">
                              +{f.traits.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Selected faction detail */}
                {selectedFactionData && (
                  <div className="faction-detail">
                    <div className="faction-detail-header">
                      {factionLogos[selectedFactionData.symbol] && (
                        <img
                          src={factionLogos[selectedFactionData.symbol]}
                          alt={selectedFactionData.name}
                          className="faction-detail-logo"
                        />
                      )}
                      <div>
                        <div className="faction-detail-name">
                          {selectedFactionData.name}
                        </div>
                        <div className="faction-detail-hq">
                          HQ: {selectedFactionData.headquarters}
                        </div>
                      </div>
                    </div>
                    <p className="faction-detail-desc">
                      {selectedFactionData.description}
                    </p>
                    <div className="faction-detail-traits">
                      {selectedFactionData.traits.map((t) => (
                        <span
                          key={t.symbol}
                          className="faction-trait-tag"
                          title={t.description}
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            className="register-button"
            type="submit"
            disabled={registering}
          >
            {registering ? 'Registering...' : 'Register Agent'}
          </button>
        </form>
      </div>
    </div>
  );
}
