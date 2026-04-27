import {
  storeToken,
  retrieveToken,
  clearToken,
  storeAccountToken,
  retrieveAccountToken,
  clearAccountToken,
  getSavedAgents,
  saveAgent,
  retrieveSavedAgentToken,
  removeSavedAgent,
} from '../services/tokenStorage';

describe('tokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('agent token', () => {
    it('stores and retrieves a token', async () => {
      await storeToken('my-secret-token');
      const result = await retrieveToken();
      expect(result).toBe('my-secret-token');
    });

    it('returns null when no token stored', async () => {
      const result = await retrieveToken();
      expect(result).toBeNull();
    });

    it('returns null when only encrypted data is missing', async () => {
      localStorage.setItem('st_iv', btoa('fake'));
      const result = await retrieveToken();
      expect(result).toBeNull();
    });

    it('returns null when only IV is missing', async () => {
      localStorage.setItem('st_encrypted_token', btoa('fake'));
      const result = await retrieveToken();
      expect(result).toBeNull();
    });

    it('clearToken removes both keys', () => {
      localStorage.setItem('st_encrypted_token', 'data');
      localStorage.setItem('st_iv', 'iv');
      clearToken();
      expect(localStorage.getItem('st_encrypted_token')).toBeNull();
      expect(localStorage.getItem('st_iv')).toBeNull();
    });

    it('clears corrupted token and returns null', async () => {
      localStorage.setItem('st_encrypted_token', btoa('corrupt'));
      localStorage.setItem('st_iv', btoa('badiv'));
      const result = await retrieveToken();
      expect(result).toBeNull();
      expect(localStorage.getItem('st_encrypted_token')).toBeNull();
    });
  });

  describe('account token', () => {
    it('stores and retrieves an account token', async () => {
      await storeAccountToken('acct-token-123');
      const result = await retrieveAccountToken();
      expect(result).toBe('acct-token-123');
    });

    it('returns null when no account token stored', async () => {
      const result = await retrieveAccountToken();
      expect(result).toBeNull();
    });

    it('clearAccountToken removes both keys', () => {
      localStorage.setItem('st_acct_token', 'data');
      localStorage.setItem('st_acct_iv', 'iv');
      clearAccountToken();
      expect(localStorage.getItem('st_acct_token')).toBeNull();
      expect(localStorage.getItem('st_acct_iv')).toBeNull();
    });

    it('clears corrupted account token and returns null', async () => {
      localStorage.setItem('st_acct_token', btoa('corrupt'));
      localStorage.setItem('st_acct_iv', btoa('badiv'));
      const result = await retrieveAccountToken();
      expect(result).toBeNull();
      expect(localStorage.getItem('st_acct_token')).toBeNull();
    });
  });

  describe('saved agents', () => {
    it('returns empty array when no agents saved', () => {
      expect(getSavedAgents()).toEqual([]);
    });

    it('returns empty array for corrupted JSON', () => {
      localStorage.setItem('st_saved_agents', 'not-json');
      expect(getSavedAgents()).toEqual([]);
    });

    it('saves and retrieves an agent', async () => {
      await saveAgent('AGENT-1', 'COSMIC', 'X1-HQ', 'secret-tok');
      const agents = getSavedAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].symbol).toBe('AGENT-1');
      expect(agents[0].faction).toBe('COSMIC');
      expect(agents[0].headquarters).toBe('X1-HQ');
    });

    it('retrieves encrypted token for saved agent', async () => {
      await saveAgent('AGENT-1', 'COSMIC', 'X1-HQ', 'secret-tok');
      const token = await retrieveSavedAgentToken('AGENT-1');
      expect(token).toBe('secret-tok');
    });

    it('returns null for non-existent agent token', async () => {
      const token = await retrieveSavedAgentToken('NONEXISTENT');
      expect(token).toBeNull();
    });

    it('updates existing agent on re-save', async () => {
      await saveAgent('AGENT-1', 'COSMIC', 'X1-HQ', 'old-tok');
      await saveAgent('AGENT-1', 'VOID', 'X2-HQ', 'new-tok');
      const agents = getSavedAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].faction).toBe('VOID');
      const token = await retrieveSavedAgentToken('AGENT-1');
      expect(token).toBe('new-tok');
    });

    it('saves multiple agents', async () => {
      await saveAgent('AGENT-1', 'COSMIC', 'X1-HQ', 'tok-1');
      await saveAgent('AGENT-2', 'VOID', 'X2-HQ', 'tok-2');
      const agents = getSavedAgents();
      expect(agents).toHaveLength(2);
    });

    it('removes a saved agent', async () => {
      await saveAgent('AGENT-1', 'COSMIC', 'X1-HQ', 'tok');
      removeSavedAgent('AGENT-1');
      expect(getSavedAgents()).toHaveLength(0);
      // Token storage keys should be cleaned up
      expect(localStorage.getItem('st_tok_AGENT-1')).toBeNull();
      expect(localStorage.getItem('st_iv_AGENT-1')).toBeNull();
    });

    it('remove handles non-existent agent gracefully', () => {
      removeSavedAgent('NONEXISTENT');
      expect(getSavedAgents()).toEqual([]);
    });
  });
});
