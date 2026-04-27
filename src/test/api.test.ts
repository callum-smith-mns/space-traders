import { api } from '../services/api';

// Helper to create mock fetch responses
function mockFetch(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(status >= 200 && status < 300 ? { data } : data),
  });
}

function mockFetchError(message: string, code = 400) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: code,
    headers: new Headers(),
    json: () => Promise.resolve({ error: { message, code } }),
  });
}

describe('SpaceTradersApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    api.clearToken();
    // Reset rate limit state by accessing the internal
    (api as any)._rateLimitResetAt = null;
    (api as any)._rateLimitListeners = [];
  });

  describe('setToken / clearToken', () => {
    it('sets the auth token and includes it in requests', async () => {
      const fetchMock = mockFetch({ symbol: 'AGENT-1' });
      vi.stubGlobal('fetch', fetchMock);
      api.setToken('test-token');
      await api.getMyAgent();
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.headers['Authorization']).toBe('Bearer test-token');
    });

    it('clears the token so no auth header is sent', async () => {
      api.setToken('test-token');
      api.clearToken();
      const fetchMock = mockFetch({ symbol: 'AGENT-1' });
      vi.stubGlobal('fetch', fetchMock);
      await api.getMyAgent();
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.headers['Authorization']).toBeUndefined();
    });
  });

  describe('request pipeline', () => {
    beforeEach(() => {
      api.setToken('tok');
    });

    it('sends GET requests with correct URL', async () => {
      const fetchMock = mockFetch({ symbol: 'AGENT-1' });
      vi.stubGlobal('fetch', fetchMock);
      await api.getMyAgent();
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.spacetraders.io/v2/my/agent',
        expect.objectContaining({
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        })
      );
    });

    it('sends POST requests with body', async () => {
      const fetchMock = mockFetch({ nav: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.navigateShip('SHIP-1', 'WP-1');
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/my/ships/SHIP-1/navigate');
      expect(opts.method).toBe('POST');
      expect(JSON.parse(opts.body)).toEqual({ waypointSymbol: 'WP-1' });
    });

    it('sends empty body for POST without payload', async () => {
      const fetchMock = mockFetch({ nav: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.orbitShip('SHIP-1');
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.method).toBe('POST');
      expect(opts.body).toBe('{}');
    });

    it('throws on non-200 response with API error message', async () => {
      vi.stubGlobal('fetch', mockFetchError('Ship not found', 404));
      api.setToken('tok');
      await expect(api.getShip('NONEXISTENT')).rejects.toThrow('Ship not found');
    });

    it('throws generic error when no message provided', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: {} }),
      }));
      api.setToken('tok');
      await expect(api.getMyAgent()).rejects.toThrow('API error 500');
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      api.setToken('tok');
    });

    it('notifies listeners on 429 with retry-after header', async () => {
      const listener = vi.fn();
      api.onRateLimitChange(listener);

      // First call: 429 with retry-after
      const fetch429 = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '2' }),
          json: () => Promise.resolve({ error: { message: 'Rate limited', code: 429 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ data: { symbol: 'AGENT-1' } }),
        });

      vi.stubGlobal('fetch', fetch429);

      // The request should retry after rate limit
      const result = await api.getMyAgent();
      expect(result.symbol).toBe('AGENT-1');
      expect(listener).toHaveBeenCalled();
      expect(fetch429).toHaveBeenCalledTimes(2);
    });

    it('notifies with reset timestamp on 429 without retry-after', async () => {
      const listener = vi.fn();
      api.onRateLimitChange(listener);

      const resetTime = new Date(Date.now() + 100).toISOString();
      const fetch429 = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'x-ratelimit-reset': resetTime }),
          json: () => Promise.resolve({ error: { message: 'Rate limited', code: 429 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ data: { symbol: 'AGENT-1' } }),
        });

      vi.stubGlobal('fetch', fetch429);
      await api.getMyAgent();
      expect(listener).toHaveBeenCalled();
    });

    it('uses 10s fallback on 429 with no headers', async () => {
      const listener = vi.fn();
      api.onRateLimitChange(listener);

      const fetch429 = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers(),
          json: () => Promise.resolve({ error: { message: 'Rate limited', code: 429 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ data: { symbol: 'AGENT-1' } }),
        });

      vi.stubGlobal('fetch', fetch429);

      // Override setTimeout to be instant
      vi.useFakeTimers();
      const promise = api.getMyAgent();
      await vi.advanceTimersByTimeAsync(15_000);
      await promise;
      vi.useRealTimers();

      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribes listener', () => {
      const listener = vi.fn();
      const unsub = api.onRateLimitChange(listener);
      unsub();
      // Trigger a rate limit notification manually
      (api as any)._notifyRateLimit(Date.now() + 5000);
      expect(listener).not.toHaveBeenCalled();
    });

    it('detects rate limit from remaining=0 header', async () => {
      const listener = vi.fn();
      api.onRateLimitChange(listener);

      const resetTime = new Date(Date.now() + 5000).toISOString();
      vi.stubGlobal('fetch', mockFetch(
        { symbol: 'AGENT-1' },
        200,
        { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': resetTime }
      ));

      await api.getMyAgent();
      expect(listener).toHaveBeenCalledWith(expect.any(Number));
    });

    it('clears rate limit when reset time has passed', async () => {
      (api as any)._rateLimitResetAt = Date.now() - 1000; // Past
      const listener = vi.fn();
      api.onRateLimitChange(listener);

      vi.stubGlobal('fetch', mockFetch(
        { symbol: 'AGENT-1' },
        200,
        { 'x-ratelimit-remaining': '10' }
      ));

      await api.getMyAgent();
      expect(listener).toHaveBeenCalledWith(null);
    });

    it('exposes rateLimitResetAt getter', () => {
      expect(api.rateLimitResetAt).toBeNull();
      (api as any)._rateLimitResetAt = 12345;
      expect(api.rateLimitResetAt).toBe(12345);
    });
  });

  describe('ship methods', () => {
    beforeEach(() => {
      api.setToken('tok');
    });

    it('listMyShips calls correct endpoint', async () => {
      const fetchMock = mockFetch([]);
      vi.stubGlobal('fetch', fetchMock);
      await api.listMyShips();
      expect(fetchMock.mock.calls[0][0]).toContain('/my/ships?page=1&limit=20');
    });

    it('getShip encodes ship symbol', async () => {
      const fetchMock = mockFetch({});
      vi.stubGlobal('fetch', fetchMock);
      await api.getShip('SHIP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/my/ships/SHIP-1');
    });

    it('orbitShip sends POST', async () => {
      const fetchMock = mockFetch({ nav: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.orbitShip('SHIP-1');
      const [url, opts] = fetchMock.mock.calls[0];
      expect(url).toContain('/orbit');
      expect(opts.method).toBe('POST');
    });

    it('dockShip sends POST', async () => {
      const fetchMock = mockFetch({ nav: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.dockShip('SHIP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/dock');
    });

    it('navigateShip sends waypointSymbol in body', async () => {
      const fetchMock = mockFetch({ nav: {}, fuel: {}, events: [] });
      vi.stubGlobal('fetch', fetchMock);
      await api.navigateShip('SHIP-1', 'WP-1');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ waypointSymbol: 'WP-1' });
    });

    it('warpShip sends waypointSymbol in body', async () => {
      const fetchMock = mockFetch({ nav: {}, fuel: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.warpShip('SHIP-1', 'WP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/warp');
    });

    it('setFlightMode sends PATCH with flightMode', async () => {
      const fetchMock = mockFetch({ nav: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.setFlightMode('SHIP-1', 'BURN');
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.method).toBe('PATCH');
      expect(JSON.parse(opts.body)).toEqual({ flightMode: 'BURN' });
    });
  });

  describe('scanning methods', () => {
    beforeEach(() => api.setToken('tok'));

    it('scanSystems POSTs to correct endpoint', async () => {
      const fetchMock = mockFetch({ cooldown: {}, systems: [] });
      vi.stubGlobal('fetch', fetchMock);
      await api.scanSystems('SHIP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/scan/systems');
    });

    it('scanWaypoints POSTs to correct endpoint', async () => {
      const fetchMock = mockFetch({ cooldown: {}, waypoints: [] });
      vi.stubGlobal('fetch', fetchMock);
      await api.scanWaypoints('SHIP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/scan/waypoints');
    });

    it('scanShips POSTs to correct endpoint', async () => {
      const fetchMock = mockFetch({ cooldown: {}, ships: [] });
      vi.stubGlobal('fetch', fetchMock);
      await api.scanShips('SHIP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/scan/ships');
    });
  });

  describe('extraction methods', () => {
    beforeEach(() => api.setToken('tok'));

    it('surveyWaypoint POSTs correctly', async () => {
      const fetchMock = mockFetch({ cooldown: {}, surveys: [] });
      vi.stubGlobal('fetch', fetchMock);
      await api.surveyWaypoint('SHIP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/survey');
    });

    it('extractResources POSTs correctly', async () => {
      const fetchMock = mockFetch({ cooldown: {}, extraction: {}, cargo: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.extractResources('SHIP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/extract');
    });

    it('extractWithSurvey sends survey in body', async () => {
      const survey = {
        signature: 'sig', symbol: 'WP', deposits: [], expiration: '', size: 'SMALL' as const,
      };
      const fetchMock = mockFetch({ cooldown: {}, extraction: {}, cargo: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.extractWithSurvey('SHIP-1', survey);
      expect(fetchMock.mock.calls[0][0]).toContain('/extract/survey');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(survey);
    });

    it('siphonResources POSTs correctly', async () => {
      const fetchMock = mockFetch({ cooldown: {}, siphon: {}, cargo: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.siphonResources('SHIP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/siphon');
    });

    it('refineShip sends produce in body', async () => {
      const fetchMock = mockFetch({ cargo: {}, cooldown: {}, produced: [], consumed: [] });
      vi.stubGlobal('fetch', fetchMock);
      await api.refineShip('SHIP-1', 'IRON');
      expect(fetchMock.mock.calls[0][0]).toContain('/refine');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ produce: 'IRON' });
    });
  });

  describe('refuel', () => {
    beforeEach(() => api.setToken('tok'));

    it('refuelShip without units sends empty body', async () => {
      const fetchMock = mockFetch({ agent: {}, fuel: {}, transaction: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.refuelShip('SHIP-1');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
    });

    it('refuelShip with units includes units in body', async () => {
      const fetchMock = mockFetch({ agent: {}, fuel: {}, transaction: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.refuelShip('SHIP-1', 50);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ units: 50 });
    });
  });

  describe('cargo methods', () => {
    beforeEach(() => api.setToken('tok'));

    it('sellCargo sends proper body', async () => {
      const fetchMock = mockFetch({ agent: {}, cargo: {}, transaction: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.sellCargo('SHIP-1', 'IRON', 10);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({ symbol: 'IRON', units: 10 });
      expect(fetchMock.mock.calls[0][0]).toContain('/sell');
    });

    it('purchaseCargo sends proper body', async () => {
      const fetchMock = mockFetch({ agent: {}, cargo: {}, transaction: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.purchaseCargo('SHIP-1', 'IRON', 5);
      expect(fetchMock.mock.calls[0][0]).toContain('/purchase');
    });

    it('jettisonCargo sends proper body', async () => {
      const fetchMock = mockFetch({ cargo: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.jettisonCargo('SHIP-1', 'IRON', 5);
      expect(fetchMock.mock.calls[0][0]).toContain('/jettison');
    });

    it('transferCargo includes destination ship in body', async () => {
      const fetchMock = mockFetch({ cargo: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.transferCargo('SHIP-1', 'SHIP-2', 'IRON', 5);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({ tradeSymbol: 'IRON', units: 5, shipSymbol: 'SHIP-2' });
    });
  });

  describe('market and shipyard', () => {
    beforeEach(() => api.setToken('tok'));

    it('getMarket calls correct URL', async () => {
      const fetchMock = mockFetch({});
      vi.stubGlobal('fetch', fetchMock);
      await api.getMarket('SYS-1', 'WP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/systems/SYS-1/waypoints/WP-1/market');
    });

    it('getShipyard calls correct URL', async () => {
      const fetchMock = mockFetch({});
      vi.stubGlobal('fetch', fetchMock);
      await api.getShipyard('SYS-1', 'WP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/systems/SYS-1/waypoints/WP-1/shipyard');
    });

    it('purchaseShip sends shipType and waypoint', async () => {
      const fetchMock = mockFetch({ agent: {}, ship: {}, transaction: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.purchaseShip('SHIP_MINING_DRONE', 'WP-1');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({ shipType: 'SHIP_MINING_DRONE', waypointSymbol: 'WP-1' });
    });
  });

  describe('waypoints and cooldown', () => {
    beforeEach(() => api.setToken('tok'));

    it('listWaypoints includes page params', async () => {
      const fetchMock = mockFetch([]);
      vi.stubGlobal('fetch', fetchMock);
      await api.listWaypoints('SYS-1', 2, 10);
      expect(fetchMock.mock.calls[0][0]).toContain('page=2&limit=10');
    });

    it('getShipCooldown returns cooldown on success', async () => {
      const cd = { shipSymbol: 'SHIP-1', totalSeconds: 60, remainingSeconds: 30 };
      const fetchMock = mockFetch(cd);
      vi.stubGlobal('fetch', fetchMock);
      const result = await api.getShipCooldown('SHIP-1');
      expect(result).toEqual(cd);
    });

    it('getShipCooldown returns null on error (204)', async () => {
      vi.stubGlobal('fetch', mockFetchError('No content', 204));
      const result = await api.getShipCooldown('SHIP-1');
      expect(result).toBeNull();
    });
  });

  describe('contracts', () => {
    beforeEach(() => api.setToken('tok'));

    it('listMyContracts calls correct endpoint', async () => {
      const fetchMock = mockFetch([]);
      vi.stubGlobal('fetch', fetchMock);
      await api.listMyContracts();
      expect(fetchMock.mock.calls[0][0]).toContain('/my/contracts');
    });

    it('acceptContract POSTs to correct endpoint', async () => {
      const fetchMock = mockFetch({ agent: {}, contract: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.acceptContract('contract-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/contracts/contract-1/accept');
    });

    it('negotiateContract POSTs to correct endpoint', async () => {
      const fetchMock = mockFetch({ contract: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.negotiateContract('SHIP-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/negotiate/contract');
    });

    it('deliverContractCargo sends proper body', async () => {
      const fetchMock = mockFetch({ contract: {}, cargo: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.deliverContractCargo('c-1', 'SHIP-1', 'IRON', 10);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({ shipSymbol: 'SHIP-1', tradeSymbol: 'IRON', units: 10 });
    });

    it('fulfillContract POSTs to correct endpoint', async () => {
      const fetchMock = mockFetch({ agent: {}, contract: {} });
      vi.stubGlobal('fetch', fetchMock);
      await api.fulfillContract('c-1');
      expect(fetchMock.mock.calls[0][0]).toContain('/contracts/c-1/fulfill');
    });
  });

  describe('factions', () => {
    beforeEach(() => api.setToken('tok'));

    it('listFactions calls correct endpoint with pagination', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ data: [], meta: { total: 0 } }),
      });
      vi.stubGlobal('fetch', fetchMock);
      await api.listFactions(2, 10);
      expect(fetchMock.mock.calls[0][0]).toContain('/factions?page=2&limit=10');
    });

    it('listFactions handles 429 and retries', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '0' }),
          json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ data: [{ symbol: 'COSMIC' }], meta: { total: 1 } }),
        });
      vi.stubGlobal('fetch', fetchMock);
      const result = await api.listFactions();
      expect(result.data).toHaveLength(1);
    });

    it('listFactions throws on non-200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: 'Server error' } }),
      }));
      await expect(api.listFactions()).rejects.toThrow('Server error');
    });
  });

  describe('registerAgent', () => {
    it('sends symbol and faction in body', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.resolve({ data: { agent: {}, token: 'new-tok' } }),
      });
      vi.stubGlobal('fetch', fetchMock);
      api.setToken('account-token');
      await api.registerAgent('AGENT', 'COSMIC');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body).toEqual({ symbol: 'AGENT', faction: 'COSMIC' });
    });

    it('registerAgent retries on 429', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ 'retry-after': '0' }),
          json: () => Promise.resolve({ error: { message: 'Rate limited' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () => Promise.resolve({ data: { agent: {}, token: 'tok' } }),
        });
      vi.stubGlobal('fetch', fetchMock);
      api.setToken('account-token');
      const result = await api.registerAgent('AGENT', 'COSMIC');
      expect(result.token).toBe('tok');
    });
  });
});
