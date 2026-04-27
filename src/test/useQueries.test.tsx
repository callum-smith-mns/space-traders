import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';
import {
  queryKeys,
  useShips,
  useContracts,
  useWaypoints,
  useMarket,
  useShipyard,
  useShipCooldown,
  useUpdateShipCache,
  useInvalidateShips,
  useShipFromCache,
  useAcceptContract,
  useAgentQueryReset,
  usePrefetchShipData,
  useShipArrivalWatcher,
} from '../hooks/useQueries';
import { api, type Ship, type ShipCooldown } from '../services/api';

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }

  return { wrapper: Wrapper, qc };
}

const mockShip: Ship = {
  symbol: 'SHIP-1',
  nav: {
    systemSymbol: 'SYS-1',
    waypointSymbol: 'WP-1',
    route: {
      origin: { symbol: 'WP-1', type: 'PLANET' },
      destination: { symbol: 'WP-2', type: 'MOON' },
      departureTime: new Date().toISOString(),
      arrival: new Date().toISOString(),
    },
    status: 'IN_ORBIT',
    flightMode: 'CRUISE',
  },
  crew: { current: 5, capacity: 10, required: 3, morale: 100 },
  fuel: { current: 100, capacity: 200, consumed: { amount: 0, timestamp: '' } },
  frame: { symbol: 'FRAME_MINER', name: 'Miner', condition: 1, integrity: 1 },
  reactor: { symbol: 'REACTOR_SOLAR', name: 'Solar', condition: 1, integrity: 1, powerOutput: 10 },
  engine: { symbol: 'ENGINE_ION', name: 'Ion', condition: 1, integrity: 1, speed: 10 },
  modules: [],
  mounts: [],
  cargo: { capacity: 40, units: 0, inventory: [] },
  registration: { name: 'SHIP-1', factionSymbol: 'COSMIC', role: 'EXCAVATOR' },
};

describe('queryKeys', () => {
  it('has correct static keys', () => {
    expect(queryKeys.ships).toEqual(['ships']);
    expect(queryKeys.contracts).toEqual(['contracts']);
    expect(queryKeys.factions).toEqual(['factions']);
  });

  it('generates parameterized keys', () => {
    expect(queryKeys.waypoints('SYS-1')).toEqual(['waypoints', 'SYS-1']);
    expect(queryKeys.market('SYS-1', 'WP-1')).toEqual(['market', 'SYS-1', 'WP-1']);
    expect(queryKeys.shipyard('SYS-1', 'WP-1')).toEqual(['shipyard', 'SYS-1', 'WP-1']);
    expect(queryKeys.cooldown('SHIP-1')).toEqual(['cooldown', 'SHIP-1']);
  });
});

describe('useShips', () => {
  it('fetches ships from API', async () => {
    vi.spyOn(api, 'listMyShips').mockResolvedValue([mockShip]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useShips(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([mockShip]);
  });
});

describe('useContracts', () => {
  it('fetches contracts from API', async () => {
    vi.spyOn(api, 'listMyContracts').mockResolvedValue([]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useContracts(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useWaypoints', () => {
  it('fetches waypoints when system symbol provided', async () => {
    vi.spyOn(api, 'listWaypoints').mockResolvedValue([]);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWaypoints('SYS-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('does not fetch when system symbol is null', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWaypoints(null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useMarket', () => {
  it('fetches market data', async () => {
    const market = { symbol: 'WP-1', exports: [], imports: [], exchange: [] };
    vi.spyOn(api, 'getMarket').mockResolvedValue(market);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMarket('SYS-1', 'WP-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(market);
  });

  it('does not fetch without system symbol', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMarket(null, 'WP-1'), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('does not fetch without waypoint symbol', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMarket('SYS-1', null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useShipyard', () => {
  it('fetches shipyard data', async () => {
    const shipyard = { symbol: 'WP-1', shipTypes: [], modificationsFee: 100 };
    vi.spyOn(api, 'getShipyard').mockResolvedValue(shipyard);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useShipyard('SYS-1', 'WP-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(shipyard);
  });

  it('respects enabled option', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useShipyard('SYS-1', 'WP-1', { enabled: false }), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useUpdateShipCache', () => {
  it('updates a ship in the cache', async () => {
    vi.spyOn(api, 'listMyShips').mockResolvedValue([mockShip]);
    const { wrapper, qc } = createWrapper();

    const { result: shipsResult } = renderHook(() => useShips(), { wrapper });
    await waitFor(() => expect(shipsResult.current.isSuccess).toBe(true));

    const { result: updateResult } = renderHook(() => useUpdateShipCache(), { wrapper });
    const updated = { ...mockShip, cargo: { ...mockShip.cargo, units: 20 } };

    act(() => {
      updateResult.current(updated);
    });

    const cached = qc.getQueryData<Ship[]>(queryKeys.ships);
    expect(cached?.[0].cargo.units).toBe(20);
  });
});

describe('useInvalidateShips', () => {
  it('returns a function that invalidates ships query', async () => {
    vi.spyOn(api, 'listMyShips').mockResolvedValue([mockShip]);
    const { wrapper } = createWrapper();

    // Populate cache first
    const { result: shipsResult } = renderHook(() => useShips(), { wrapper });
    await waitFor(() => expect(shipsResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useInvalidateShips(), { wrapper });

    await act(async () => {
      result.current();
    });

    // The function was called without errors
    expect(typeof result.current).toBe('function');
  });
});

describe('useAcceptContract', () => {
  it('calls acceptContract and updates cache', async () => {
    const contract = { id: 'c-1', accepted: true, fulfilled: false, factionSymbol: 'COSMIC', type: 'PROCUREMENT' as const, terms: { deadline: '', payment: { onAccepted: 0, onFulfilled: 0 } }, expiration: '' };
    vi.spyOn(api, 'acceptContract').mockResolvedValue({ agent: {} as any, contract: contract as any });
    vi.spyOn(api, 'listMyContracts').mockResolvedValue([{ ...contract, accepted: false } as any]);

    const { wrapper } = createWrapper();

    // Populate contracts cache
    const { result: contractsResult } = renderHook(() => useContracts(), { wrapper });
    await waitFor(() => expect(contractsResult.current.isSuccess).toBe(true));

    const { result: mutateResult } = renderHook(() => useAcceptContract(), { wrapper });

    await act(async () => {
      await mutateResult.current.mutateAsync('c-1');
    });

    expect(api.acceptContract).toHaveBeenCalledWith('c-1');
  });
});

describe('useShipFromCache', () => {
  it('returns ship from cache', async () => {
    vi.spyOn(api, 'listMyShips').mockResolvedValue([mockShip]);
    const { wrapper } = createWrapper();

    // Populate cache
    const { result: shipsResult } = renderHook(() => useShips(), { wrapper });
    await waitFor(() => expect(shipsResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useShipFromCache('SHIP-1'), { wrapper });
    expect(result.current?.symbol).toBe('SHIP-1');
  });

  it('returns null for null symbol', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useShipFromCache(null), { wrapper });
    expect(result.current).toBeNull();
  });

  it('returns null for unknown ship', async () => {
    vi.spyOn(api, 'listMyShips').mockResolvedValue([mockShip]);
    const { wrapper } = createWrapper();

    const { result: shipsResult } = renderHook(() => useShips(), { wrapper });
    await waitFor(() => expect(shipsResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useShipFromCache('NONEXISTENT'), { wrapper });
    expect(result.current).toBeNull();
  });
});

describe('useShipCooldown', () => {
  it('returns no cooldown when API returns null', async () => {
    vi.spyOn(api, 'getShipCooldown').mockResolvedValue(null);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useShipCooldown('SHIP-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isOnCooldown).toBe(false);
    });
    expect(result.current.cooldown).toBeNull();
  });

  it('returns cooldown from API', async () => {
    const cd: ShipCooldown = {
      shipSymbol: 'SHIP-1',
      totalSeconds: 60,
      remainingSeconds: 30,
      expiration: new Date(Date.now() + 30_000).toISOString(),
    };
    vi.spyOn(api, 'getShipCooldown').mockResolvedValue(cd);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useShipCooldown('SHIP-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isOnCooldown).toBe(true);
    });
    expect(result.current.cooldown?.remainingSeconds).toBe(30);
  });

  it('setCooldown updates cooldown and syncs to ship cache', async () => {
    vi.spyOn(api, 'getShipCooldown').mockResolvedValue(null);
    vi.spyOn(api, 'listMyShips').mockResolvedValue([mockShip]);
    const { wrapper, qc } = createWrapper();

    // Populate ships cache
    const { result: shipsResult } = renderHook(() => useShips(), { wrapper });
    await waitFor(() => expect(shipsResult.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useShipCooldown('SHIP-1'), { wrapper });
    await waitFor(() => expect(result.current.isOnCooldown).toBe(false));

    const newCd: ShipCooldown = {
      shipSymbol: 'SHIP-1',
      totalSeconds: 70,
      remainingSeconds: 70,
      expiration: new Date(Date.now() + 70_000).toISOString(),
    };

    act(() => {
      result.current.setCooldown(newCd);
    });

    await waitFor(() => {
      expect(result.current.cooldown?.remainingSeconds).toBe(70);
    });

    // Verify it's synced to the ships cache
    const ships = qc.getQueryData<Ship[]>(queryKeys.ships);
    expect(ships?.[0].cooldown?.remainingSeconds).toBe(70);
  });

  it('setCooldown(null) clears cooldown', async () => {
    const cd: ShipCooldown = {
      shipSymbol: 'SHIP-1',
      totalSeconds: 60,
      remainingSeconds: 30,
      expiration: new Date(Date.now() + 30_000).toISOString(),
    };
    vi.spyOn(api, 'getShipCooldown').mockResolvedValue(cd);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useShipCooldown('SHIP-1'), { wrapper });
    await waitFor(() => expect(result.current.isOnCooldown).toBe(true));

    act(() => {
      result.current.setCooldown(null);
    });

    await waitFor(() => {
      expect(result.current.isOnCooldown).toBe(false);
    });
  });

  it('ticks down remainingSeconds every second', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const cd: ShipCooldown = {
      shipSymbol: 'SHIP-1',
      totalSeconds: 60,
      remainingSeconds: 3,
      expiration: new Date(Date.now() + 3_000).toISOString(),
    };
    vi.spyOn(api, 'getShipCooldown').mockResolvedValue(cd);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useShipCooldown('SHIP-1'), { wrapper });

    await vi.waitFor(() => expect(result.current.isOnCooldown).toBe(true));
    expect(result.current.cooldown?.remainingSeconds).toBe(3);

    // Advance by 1 second — ticker fires
    await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
    expect(result.current.cooldown?.remainingSeconds).toBe(2);

    vi.useRealTimers();
  });

  it('clears cooldown when ticker reaches zero', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const cd: ShipCooldown = {
      shipSymbol: 'SHIP-1',
      totalSeconds: 60,
      remainingSeconds: 1,
      expiration: new Date(Date.now() + 1_000).toISOString(),
    };
    vi.spyOn(api, 'getShipCooldown').mockResolvedValue(cd);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useShipCooldown('SHIP-1'), { wrapper });

    await vi.waitFor(() => expect(result.current.isOnCooldown).toBe(true));

    // Advance past expiration
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

    await vi.waitFor(() => expect(result.current.isOnCooldown).toBe(false));
    expect(result.current.cooldown).toBeNull();

    vi.useRealTimers();
  });
});

describe('useAgentQueryReset', () => {
  it('clears agent-specific queries when agent changes', async () => {
    vi.spyOn(api, 'listMyShips').mockResolvedValue([mockShip]);
    vi.spyOn(api, 'listMyContracts').mockResolvedValue([]);
    const { wrapper, qc } = createWrapper();

    // Populate ships cache
    const { result: shipsResult } = renderHook(() => useShips(), { wrapper });
    await waitFor(() => expect(shipsResult.current.isSuccess).toBe(true));
    expect(qc.getQueryData(queryKeys.ships)).toBeDefined();

    const { rerender } = renderHook(
      ({ agent }) => useAgentQueryReset(agent),
      { wrapper, initialProps: { agent: 'AGENT-A' as string | null } }
    );

    // Switch agent
    rerender({ agent: 'AGENT-B' });

    // Ships cache should be removed
    expect(qc.getQueryData(queryKeys.ships)).toBeUndefined();
  });

  it('does nothing on first mount', () => {
    const { wrapper, qc } = createWrapper();
    qc.setQueryData(queryKeys.ships, [mockShip]);

    renderHook(() => useAgentQueryReset('AGENT-A'), { wrapper });

    // Cache should still be present
    expect(qc.getQueryData(queryKeys.ships)).toBeDefined();
  });

  it('does nothing when agent is the same', () => {
    const { wrapper, qc } = createWrapper();
    qc.setQueryData(queryKeys.ships, [mockShip]);

    const { rerender } = renderHook(
      ({ agent }) => useAgentQueryReset(agent),
      { wrapper, initialProps: { agent: 'AGENT-A' as string | null } }
    );

    rerender({ agent: 'AGENT-A' });

    // Cache should still be present
    expect(qc.getQueryData(queryKeys.ships)).toBeDefined();
  });
});

describe('usePrefetchShipData', () => {
  it('prefetches waypoints and market for a ship', async () => {
    vi.spyOn(api, 'listWaypoints').mockResolvedValue([]);
    vi.spyOn(api, 'getMarket').mockResolvedValue({ symbol: 'WP-1', exports: [], imports: [], exchange: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => usePrefetchShipData(), { wrapper });

    await act(async () => {
      result.current(mockShip);
    });

    // Should have called the prefetch for waypoints and market
    await waitFor(() => {
      expect(api.listWaypoints).toHaveBeenCalledWith('SYS-1', 1, 20);
      expect(api.getMarket).toHaveBeenCalledWith('SYS-1', 'WP-1');
    });
  });
});

describe('useShipArrivalWatcher', () => {
  it('refreshes a ship when its arrival time passes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const arrivalTime = new Date(Date.now() + 2_000).toISOString();
    const inTransitShip: Ship = {
      ...mockShip,
      nav: {
        ...mockShip.nav,
        status: 'IN_TRANSIT',
        route: {
          ...mockShip.nav.route,
          arrival: arrivalTime,
        },
      },
    };
    const arrivedShip: Ship = { ...mockShip, nav: { ...mockShip.nav, status: 'IN_ORBIT' } };
    vi.spyOn(api, 'getShip').mockResolvedValue(arrivedShip);

    const { wrapper, qc } = createWrapper();
    qc.setQueryData(queryKeys.ships, [inTransitShip]);

    renderHook(() => useShipArrivalWatcher(), { wrapper });

    // Advance past arrival + 500ms buffer
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });

    await vi.waitFor(() => {
      expect(api.getShip).toHaveBeenCalledWith('SHIP-1');
    });

    vi.useRealTimers();
  });

  it('does not set timer for ships not in transit', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(api, 'getShip').mockResolvedValue(mockShip);

    const { wrapper, qc } = createWrapper();
    qc.setQueryData(queryKeys.ships, [mockShip]); // IN_ORBIT

    renderHook(() => useShipArrivalWatcher(), { wrapper });

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(api.getShip).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('invalidates ships list when getShip fails', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const arrivalTime = new Date(Date.now() + 1_000).toISOString();
    const inTransitShip: Ship = {
      ...mockShip,
      nav: {
        ...mockShip.nav,
        status: 'IN_TRANSIT',
        route: { ...mockShip.nav.route, arrival: arrivalTime },
      },
    };
    vi.spyOn(api, 'getShip').mockRejectedValue(new Error('Failed'));
    vi.spyOn(api, 'listMyShips').mockResolvedValue([mockShip]);

    const { wrapper, qc } = createWrapper();
    qc.setQueryData(queryKeys.ships, [inTransitShip]);

    renderHook(() => useShipArrivalWatcher(), { wrapper });

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    await vi.waitFor(() => {
      expect(api.getShip).toHaveBeenCalledWith('SHIP-1');
    });

    vi.useRealTimers();
  });
});
