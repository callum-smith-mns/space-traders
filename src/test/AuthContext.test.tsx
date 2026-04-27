import { renderHook, act, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import * as tokenStorage from '../services/tokenStorage';

// Mock token storage
vi.mock('../services/tokenStorage', () => ({
  storeToken: vi.fn().mockResolvedValue(undefined),
  retrieveToken: vi.fn().mockResolvedValue(null),
  clearToken: vi.fn(),
  storeAccountToken: vi.fn().mockResolvedValue(undefined),
  retrieveAccountToken: vi.fn().mockResolvedValue(null),
  clearAccountToken: vi.fn(),
  getSavedAgents: vi.fn().mockReturnValue([]),
  saveAgent: vi.fn().mockResolvedValue(undefined),
  retrieveSavedAgentToken: vi.fn().mockResolvedValue(null),
  removeSavedAgent: vi.fn(),
}));

const mockAgent = {
  symbol: 'AGENT-1',
  headquarters: 'X1-HQ',
  credits: 100000,
  startingFaction: 'COSMIC',
  shipCount: 2,
};

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'setToken');
    vi.spyOn(api, 'clearToken');
    vi.spyOn(api, 'getMyAgent');
  });

  describe('useAuth outside provider', () => {
    it('throws when used outside AuthProvider', () => {
      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within AuthProvider');
      spy.mockRestore();
    });
  });

  describe('initialization', () => {
    it('starts in loading state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.loading).toBe(true);
    });

    it('restores agent token on mount', async () => {
      vi.mocked(tokenStorage.retrieveToken).mockResolvedValue('saved-tok');
      vi.spyOn(api, 'getMyAgent').mockResolvedValue(mockAgent);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.token).toBe('saved-tok');
      expect(result.current.agent).toEqual(mockAgent);
      expect(result.current.isAccountToken).toBe(false);
    });

    it('falls back to account token when agent token fails', async () => {
      vi.mocked(tokenStorage.retrieveToken).mockResolvedValue('bad-agent-tok');
      vi.spyOn(api, 'getMyAgent').mockRejectedValue(new Error('Invalid'));
      vi.mocked(tokenStorage.retrieveAccountToken).mockResolvedValue('acct-tok');

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.token).toBe('acct-tok');
      expect(result.current.agent).toBeNull();
      expect(result.current.isAccountToken).toBe(true);
    });

    it('finishes loading with no token when nothing stored', async () => {
      vi.mocked(tokenStorage.retrieveToken).mockResolvedValue(null);
      vi.mocked(tokenStorage.retrieveAccountToken).mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.token).toBeNull();
      expect(result.current.agent).toBeNull();
    });
  });

  describe('loginWithAccountToken', () => {
    it('detects agent token and logs in directly', async () => {
      vi.spyOn(api, 'getMyAgent').mockResolvedValue(mockAgent);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.loginWithAccountToken('agent-tok');
      });

      expect(result.current.agent).toEqual(mockAgent);
      expect(result.current.isAccountToken).toBe(false);
      expect(tokenStorage.storeToken).toHaveBeenCalledWith('agent-tok');
      expect(tokenStorage.saveAgent).toHaveBeenCalled();
    });

    it('stores as account token when getMyAgent fails', async () => {
      vi.spyOn(api, 'getMyAgent').mockRejectedValue(new Error('Not an agent'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.loginWithAccountToken('acct-tok');
      });

      expect(result.current.token).toBe('acct-tok');
      expect(result.current.isAccountToken).toBe(true);
      expect(result.current.agent).toBeNull();
      expect(tokenStorage.storeAccountToken).toHaveBeenCalledWith('acct-tok');
      expect(tokenStorage.clearToken).toHaveBeenCalled();
    });
  });

  describe('loginWithAgentToken', () => {
    it('logs in with valid agent token', async () => {
      vi.spyOn(api, 'getMyAgent').mockResolvedValue(mockAgent);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.loginWithAgentToken('valid-tok');
      });

      expect(result.current.agent).toEqual(mockAgent);
      expect(result.current.error).toBeNull();
    });

    it('sets error on invalid token', async () => {
      vi.spyOn(api, 'getMyAgent').mockRejectedValue(new Error('Invalid'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.loginWithAgentToken('bad-tok');
      });

      expect(result.current.agent).toBeNull();
      expect(result.current.error).toContain('Invalid agent token');
    });
  });

  describe('loginSavedAgent', () => {
    it('logs in with a saved agent', async () => {
      vi.mocked(tokenStorage.retrieveSavedAgentToken).mockResolvedValue('saved-tok');
      vi.spyOn(api, 'getMyAgent').mockResolvedValue(mockAgent);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.loginSavedAgent('AGENT-1');
      });

      expect(result.current.agent).toEqual(mockAgent);
      expect(api.setToken).toHaveBeenCalledWith('saved-tok');
    });

    it('sets error when saved token not found', async () => {
      vi.mocked(tokenStorage.retrieveSavedAgentToken).mockResolvedValue(null);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.loginSavedAgent('NONEXISTENT');
      });

      expect(result.current.error).toBe('Could not retrieve token.');
    });

    it('sets error when saved token is expired', async () => {
      vi.mocked(tokenStorage.retrieveSavedAgentToken).mockResolvedValue('expired-tok');
      vi.spyOn(api, 'getMyAgent').mockRejectedValue(new Error('Expired'));

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.loginSavedAgent('AGENT-1');
      });

      expect(result.current.error).toBe('Token expired or invalid.');
    });
  });

  describe('setAgent', () => {
    it('updates agent in state', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.setAgent(mockAgent);
      });

      expect(result.current.agent).toEqual(mockAgent);
    });
  });

  describe('setAgentToken', () => {
    it('stores token and sets agent', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.setAgentToken('new-tok', mockAgent);
      });

      expect(api.setToken).toHaveBeenCalledWith('new-tok');
      expect(tokenStorage.storeToken).toHaveBeenCalledWith('new-tok');
      expect(tokenStorage.saveAgent).toHaveBeenCalled();
      expect(result.current.agent).toEqual(mockAgent);
    });
  });

  describe('disconnectAgent', () => {
    it('falls back to account token after disconnect', async () => {
      vi.mocked(tokenStorage.retrieveAccountToken).mockResolvedValue('acct-tok');
      vi.spyOn(api, 'getMyAgent').mockResolvedValue(mockAgent);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Login first
      await act(async () => {
        await result.current.loginWithAgentToken('agent-tok');
      });

      await act(async () => {
        result.current.disconnectAgent();
      });

      await waitFor(() => {
        expect(result.current.isAccountToken).toBe(true);
      });
      expect(result.current.agent).toBeNull();
      expect(result.current.token).toBe('acct-tok');
    });

    it('fully logs out when no account token', async () => {
      vi.mocked(tokenStorage.retrieveAccountToken).mockResolvedValue(null);
      vi.spyOn(api, 'getMyAgent').mockResolvedValue(mockAgent);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.loginWithAgentToken('agent-tok');
      });

      await act(async () => {
        result.current.disconnectAgent();
      });

      await waitFor(() => {
        expect(result.current.token).toBeNull();
      });
    });
  });

  describe('logout', () => {
    it('clears everything on full logout', async () => {
      vi.spyOn(api, 'getMyAgent').mockResolvedValue(mockAgent);

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.loginWithAgentToken('tok');
      });

      act(() => {
        result.current.logout();
      });

      expect(result.current.token).toBeNull();
      expect(result.current.agent).toBeNull();
      expect(result.current.isAccountToken).toBe(false);
      expect(api.clearToken).toHaveBeenCalled();
      expect(tokenStorage.clearToken).toHaveBeenCalled();
      expect(tokenStorage.clearAccountToken).toHaveBeenCalled();
    });
  });

  describe('deleteSavedAgent', () => {
    it('removes saved agent and updates list', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.deleteSavedAgent('AGENT-1');
      });

      expect(tokenStorage.removeSavedAgent).toHaveBeenCalledWith('AGENT-1');
    });
  });
});
