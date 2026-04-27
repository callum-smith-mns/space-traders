import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginScreen.css';

type View = 'main' | 'agent-token';

export default function LoginScreen() {
  const { loginWithAccountToken, loginWithAgentToken, loginSavedAgent, savedAgents, deleteSavedAgent, loading, error: authError } = useAuth();
  const [view, setView] = useState<View>('main');
  const [accountToken, setAccountToken] = useState('');
  const [agentToken, setAgentToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const displayError = error || authError;

  async function handleAccountSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = accountToken.trim();
    if (!trimmed) {
      setError('Please enter your account token.');
      return;
    }
    if (trimmed.length > 2048) {
      setError('Token is too long. Please check you are pasting the correct value.');
      return;
    }
    try {
      await loginWithAccountToken(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    }
  }

  async function handleAgentSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = agentToken.trim();
    if (!trimmed) {
      setError('Please enter your agent token.');
      return;
    }
    if (trimmed.length > 2048) {
      setError('Token is too long. Please check you are pasting the correct value.');
      return;
    }
    try {
      await loginWithAgentToken(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    }
  }

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
    <div className="login-screen">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">SpaceTraders</h1>
          <p className="login-subtitle">Command Interface v2.0</p>
        </div>

        {displayError && <div className="login-error">{displayError}</div>}

        {/* ── Saved Agents (always visible if any exist) ── */}
        {savedAgents.length > 0 && (
          <div className="login-saved">
            <div className="login-saved-title">Saved Agents</div>
            <div className="login-saved-list">
              {savedAgents.map((agent) => (
                <div key={agent.symbol} className="login-saved-agent">
                  <button
                    type="button"
                    className="login-saved-btn"
                    disabled={loading}
                    onClick={() => handleSelectAgent(agent.symbol)}
                  >
                    <span className="login-saved-symbol">{agent.symbol}</span>
                    <span className="login-saved-meta">
                      {agent.faction} · {agent.headquarters}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="login-delete-btn"
                    title="Remove agent"
                    onClick={() => setConfirmDelete(agent.symbol)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <div className="login-divider">or connect with a token</div>
          </div>
        )}

        {/* ── Main view: Account Token + Existing Agent button ── */}
        {view === 'main' && (
          <>
            <form className="login-section" onSubmit={handleAccountSubmit}>
              <div className="login-section-header">
                <div className="login-section-badge login-section-badge--account">Account Token</div>
                <span className="login-section-desc">For registering new agents</span>
              </div>

              <div className="login-field">
                <input
                  className="login-input"
                  type="password"
                  value={accountToken}
                  onChange={(e) => setAccountToken(e.target.value)}
                  placeholder="Paste your account token..."
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
                <p className="login-hint">
                  Generate an <strong>account token</strong> at{' '}
                  <a
                    href="https://my.spacetraders.io"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    my.spacetraders.io
                  </a>
                  . This is used to create and manage agents on your account.
                </p>
              </div>

              <button className="login-button" type="submit" disabled={loading}>
                {loading ? 'Authenticating...' : 'Connect Account'}
              </button>
            </form>

            <div className="login-divider">already have an agent?</div>

            <button
              type="button"
              className="login-button login-button--secondary"
              onClick={() => { setError(null); setView('agent-token'); }}
            >
              Existing Agent Token
            </button>
            <p className="login-hint login-hint--center">
              Use this if you have an <strong>agent bearer token</strong> from the SpaceTraders account page.
            </p>
          </>
        )}

        {/* ── Agent token view ── */}
        {view === 'agent-token' && (
          <>
            <form className="login-section" onSubmit={handleAgentSubmit}>
              <div className="login-section-header">
                <div className="login-section-badge login-section-badge--agent">Agent Token</div>
                <span className="login-section-desc">For an existing agent</span>
              </div>

              <div className="login-field">
                <input
                  className="login-input"
                  type="password"
                  value={agentToken}
                  onChange={(e) => setAgentToken(e.target.value)}
                  placeholder="Paste your agent bearer token..."
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
                <p className="login-hint">
                  You can generate a new <strong>agent token</strong> for existing agents from{' '}
                  <a
                    href="https://my.spacetraders.io"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    my.spacetraders.io
                  </a>
                  . This logs you in directly as that agent.
                </p>
              </div>

              <button className="login-button" type="submit" disabled={loading}>
                {loading ? 'Authenticating...' : 'Connect Agent'}
              </button>
            </form>

            <button
              type="button"
              className="login-back-btn"
              onClick={() => { setError(null); setView('main'); }}
            >
              ← Back
            </button>
          </>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmDelete && (
        <div className="login-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="login-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="login-dialog-title">Confirm Deletion</div>
            <p className="login-dialog-text">
              Remove saved agent <strong>{confirmDelete}</strong>? This will delete
              the stored token. You'll need to re-enter it to connect again.
            </p>
            <div className="login-dialog-actions">
              <button
                className="login-dialog-btn login-dialog-btn--cancel"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="login-dialog-btn login-dialog-btn--delete"
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
