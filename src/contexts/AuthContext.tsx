import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  storeToken,
  retrieveToken,
  clearToken,
  saveAgent,
  getSavedAgents,
  retrieveSavedAgentToken,
  removeSavedAgent,
  storeAccountToken,
  retrieveAccountToken,
  clearAccountToken,
  type SavedAgent,
} from '../services/tokenStorage';
import { api, type Agent } from '../services/api';

interface AuthState {
  token: string | null;
  agent: Agent | null;
  loading: boolean;
  error: string | null;
  /** True when the user authenticated with an account token (no agent yet) */
  isAccountToken: boolean;
}

interface AuthContextValue extends AuthState {
  /** Log in with an account token — shows the agent registration/selection screen */
  loginWithAccountToken: (token: string) => Promise<void>;
  /** Log in directly with an agent bearer token */
  loginWithAgentToken: (token: string) => Promise<void>;
  /** Quick-login a previously saved agent */
  loginSavedAgent: (symbol: string) => Promise<void>;
  /** Disconnect current agent but keep account token and saved agents */
  disconnectAgent: () => void;
  /** Full logout — clears everything */
  logout: () => void;
  setAgent: (agent: Agent) => void;
  setAgentToken: (token: string, agent: Agent) => Promise<void>;
  savedAgents: SavedAgent[];
  deleteSavedAgent: (symbol: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null,
    agent: null,
    loading: true,
    error: null,
    isAccountToken: false,
  });
  const [savedAgents, setSavedAgents] = useState<SavedAgent[]>(getSavedAgents());

  // Attempt to restore a previous session on mount
  useEffect(() => {
    (async () => {
      // Try restoring an active agent token first
      const saved = await retrieveToken();
      if (saved) {
        api.setToken(saved);
        try {
          const agent = await api.getMyAgent();
          setState({ token: saved, agent, loading: false, error: null, isAccountToken: false });
          return;
        } catch {
          // Not a valid agent token — fall through
        }
      }
      // Try restoring an account token
      const acct = await retrieveAccountToken();
      if (acct) {
        api.setToken(acct);
        setState({ token: acct, agent: null, loading: false, error: null, isAccountToken: true });
        return;
      }
      setState((s) => ({ ...s, loading: false }));
    })();
  }, []);

  const loginWithAccountToken = useCallback(async (token: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    api.setToken(token);
    // Verify it's a valid account token by trying /my/agent (should fail for account tokens)
    try {
      const agent = await api.getMyAgent();
      // It's actually an agent token — save & log in directly
      await storeToken(token);
      await saveAgent(agent.symbol, agent.startingFaction, agent.headquarters, token);
      setSavedAgents(getSavedAgents());
      setState({ token, agent, loading: false, error: null, isAccountToken: false });
    } catch {
      // Good — it's an account token
      await storeAccountToken(token);
      clearToken(); // Clear any stale agent token
      setState({ token, agent: null, loading: false, error: null, isAccountToken: true });
    }
  }, []);

  const loginWithAgentToken = useCallback(async (token: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    api.setToken(token);
    try {
      const agent = await api.getMyAgent();
      await storeToken(token);
      await saveAgent(agent.symbol, agent.startingFaction, agent.headquarters, token);
      setSavedAgents(getSavedAgents());
      setState({ token, agent, loading: false, error: null, isAccountToken: false });
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: 'Invalid agent token. Make sure you\'re using an agent bearer token, not an account token.',
      }));
    }
  }, []);

  const loginSavedAgent = useCallback(async (symbol: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const token = await retrieveSavedAgentToken(symbol);
    if (!token) {
      setState((s) => ({ ...s, loading: false, error: 'Could not retrieve token.' }));
      return;
    }
    api.setToken(token);
    try {
      const agent = await api.getMyAgent();
      await storeToken(token);
      setState({ token, agent, loading: false, error: null, isAccountToken: false });
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Token expired or invalid.' }));
    }
  }, []);

  const setAgentToken = useCallback(async (token: string, agent: Agent) => {
    api.setToken(token);
    await storeToken(token);
    await saveAgent(agent.symbol, agent.startingFaction, agent.headquarters, token);
    setSavedAgents(getSavedAgents());
    setState({ token, agent, loading: false, error: null, isAccountToken: false });
  }, []);

  const setAgent = useCallback((agent: Agent) => {
    setState((s) => ({ ...s, agent }));
  }, []);

  /** Disconnect from the current agent but preserve account token and saved agents */
  const disconnectAgent = useCallback(async () => {
    clearToken(); // Clear the active agent token
    // Check if there's an account token to fall back to
    const acct = await retrieveAccountToken();
    if (acct) {
      api.setToken(acct);
      setState({ token: acct, agent: null, loading: false, error: null, isAccountToken: true });
    } else {
      api.clearToken();
      setState({ token: null, agent: null, loading: false, error: null, isAccountToken: false });
    }
  }, []);

  /** Full logout — clears everything including account token */
  const logout = useCallback(() => {
    api.clearToken();
    clearToken();
    clearAccountToken();
    setState({ token: null, agent: null, loading: false, error: null, isAccountToken: false });
  }, []);

  const deleteSavedAgent = useCallback((symbol: string) => {
    removeSavedAgent(symbol);
    setSavedAgents(getSavedAgents());
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, loginWithAccountToken, loginWithAgentToken, loginSavedAgent, disconnectAgent, logout, setAgent, setAgentToken, savedAgents, deleteSavedAgent }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
