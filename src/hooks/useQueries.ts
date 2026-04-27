import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useEffect, useRef, useCallback } from 'react';
import { api, type Ship, type ShipCooldown, type Contract, type Waypoint, type Faction } from '../services/api';

/* ═══════════════════════════════════════════
   Shared paginated fetchers
   ═══════════════════════════════════════════ */

async function fetchAllWaypoints(systemSymbol: string): Promise<Waypoint[]> {
  const all: Waypoint[] = [];
  let page = 1;
  while (true) {
    const batch = await api.listWaypoints(systemSymbol, page, 20);
    all.push(...batch);
    if (batch.length < 20) break;
    page++;
  }
  return all;
}

async function fetchAllFactions(): Promise<Faction[]> {
  const first = await api.listFactions(1, 20);
  let all = [...first.data];
  const total = first.meta.total;
  const pages = Math.ceil(total / 20);
  for (let p = 2; p <= pages; p++) {
    const page = await api.listFactions(p, 20);
    all = [...all, ...page.data];
  }
  return all;
}

/* ═══════════════════════════════════════════
   Query keys — centralised to avoid typos
   ═══════════════════════════════════════════ */

export const queryKeys = {
  ships: ['ships'] as const,
  contracts: ['contracts'] as const,
  factions: ['factions'] as const,
  cooldown: (shipSymbol: string) => ['cooldown', shipSymbol] as const,
  waypoints: (systemSymbol: string) => ['waypoints', systemSymbol] as const,
  market: (systemSymbol: string, waypointSymbol: string) =>
    ['market', systemSymbol, waypointSymbol] as const,
  shipyard: (systemSymbol: string, waypointSymbol: string) =>
    ['shipyard', systemSymbol, waypointSymbol] as const,
  shipLocation: (shipSymbol: string) => ['shipLocation', shipSymbol] as const,
};

/** Keys that are agent-specific and must be cleared on agent switch. */
const AGENT_QUERY_KEYS = [
  queryKeys.ships,
  queryKeys.contracts,
];

/**
 * Watches for agent changes and removes stale agent-specific data from the
 * query cache so the new agent's data is fetched fresh.
 */
export function useAgentQueryReset(agentSymbol: string | null | undefined) {
  const qc = useQueryClient();
  const prevSymbol = useRef(agentSymbol);

  useEffect(() => {
    if (prevSymbol.current && agentSymbol && prevSymbol.current !== agentSymbol) {
      // Agent switched — remove old agent's cached data
      for (const key of AGENT_QUERY_KEYS) {
        qc.removeQueries({ queryKey: key });
      }
      // Also remove trade data, market, and waypoint caches (they may reference old ship positions)
      qc.removeQueries({ queryKey: ['tradeData'] });
      qc.removeQueries({ queryKey: ['market'] });
    }
    prevSymbol.current = agentSymbol;
  }, [agentSymbol, qc]);
}

/* ═══════════════════════════════════════════
   Hooks
   ═══════════════════════════════════════════ */

/** All ships belonging to the agent. */
export function useShips() {
  return useQuery({
    queryKey: queryKeys.ships,
    queryFn: () => api.listMyShips(),
    staleTime: 30_000, // re-check every 30s but serve from cache immediately
  });
}

/** All contracts for the agent. */
export function useContracts() {
  return useQuery({
    queryKey: queryKeys.contracts,
    queryFn: () => api.listMyContracts(),
    staleTime: 60_000,
  });
}

/** All factions (public, rarely changes). */
export function useFactions() {
  return useQuery({
    queryKey: queryKeys.factions,
    queryFn: fetchAllFactions,
    staleTime: Infinity, // factions basically never change
    gcTime: 1000 * 60 * 60 * 24 * 7, // keep for a week
  });
}

/** All waypoints in a system (paginated automatically). */
export function useWaypoints(systemSymbol: string | undefined | null) {
  return useQuery({
    queryKey: queryKeys.waypoints(systemSymbol ?? ''),
    queryFn: () => fetchAllWaypoints(systemSymbol!),
    enabled: !!systemSymbol,
    staleTime: 1000 * 60 * 30, // system waypoints are mostly static — 30 min stale time
    gcTime: 1000 * 60 * 60 * 24, // keep for 24 hours
  });
}

/** Shipyard data for a specific waypoint. */
export function useShipyard(
  systemSymbol: string | undefined | null,
  waypointSymbol: string | undefined | null,
  options?: Partial<Pick<UseQueryOptions, 'enabled'>>
) {
  return useQuery({
    queryKey: queryKeys.shipyard(systemSymbol ?? '', waypointSymbol ?? ''),
    queryFn: () => api.getShipyard(systemSymbol!, waypointSymbol!),
    enabled: !!systemSymbol && !!waypointSymbol && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000,
    gcTime: 1000 * 60 * 60,
  });
}

/** Market data for a specific waypoint. */
export function useMarket(
  systemSymbol: string | undefined | null,
  waypointSymbol: string | undefined | null,
  options?: Partial<Pick<UseQueryOptions, 'enabled'>>
) {
  return useQuery({
    queryKey: queryKeys.market(systemSymbol ?? '', waypointSymbol ?? ''),
    queryFn: () => api.getMarket(systemSymbol!, waypointSymbol!),
    enabled: !!systemSymbol && !!waypointSymbol && (options?.enabled !== false),
    staleTime: 5 * 60 * 1000, // markets can shift — 5 min stale
    gcTime: 1000 * 60 * 60, // keep for 1 hour
  });
}

/* ═══════════════════════════════════════════
   Mutations with cache updates
   ═══════════════════════════════════════════ */

/** Accept a contract — updates cache in-place. */
export function useAcceptContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: string) => api.acceptContract(contractId),
    onSuccess: (result) => {
      qc.setQueryData<Contract[]>(queryKeys.contracts, (old) =>
        old?.map((c) => (c.id === result.contract.id ? result.contract : c))
      );
    },
  });
}

/** Invalidate the ships cache (call after navigation, purchase, etc.). */
export function useInvalidateShips() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.ships });
}

/** Update a single ship in the cache. */
export function useUpdateShipCache() {
  const qc = useQueryClient();
  return (updated: Ship) => {
    qc.setQueryData<Ship[]>(queryKeys.ships, (old) =>
      old?.map((s) => (s.symbol === updated.symbol ? updated : s))
    );
  };
}

/**
 * Centralized cooldown manager for a ship.
 * - Stores cooldown in the query cache (survives component unmounts)
 * - Ticks down every second
 * - Syncs cooldown to the ships list cache so the fleet list shows it
 * - Fetches current cooldown from API on first mount for a given ship
 */
export function useShipCooldown(shipSymbol: string) {
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const key = queryKeys.cooldown(shipSymbol);
  // Read cooldown from the query cache (reactive)
  const { data: cooldown = null } = useQuery<ShipCooldown | null>({
    queryKey: key,
    queryFn: () => api.getShipCooldown(shipSymbol),
    staleTime: Infinity,  // manual control — never auto-refetch
    gcTime: 5 * 60_000,   // keep 5 min after unmount
    enabled: !!shipSymbol,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // On first mount / ship change, fetch from API if no cached value
  useEffect(() => {
    if (!shipSymbol) return;
    const cached = qc.getQueryData<ShipCooldown | null>(key);
    if (cached === undefined) {
      // Not yet in cache — trigger the query
      qc.invalidateQueries({ queryKey: key });
    }
  }, [shipSymbol, qc, key]);

  // Patch only the cooldown field on the ships list (no stale spread)
  const syncToShipCache = useCallback((cd: ShipCooldown | null) => {
    qc.setQueryData<Ship[]>(queryKeys.ships, (old) =>
      old?.map((s) =>
        s.symbol === shipSymbol
          ? { ...s, cooldown: cd ?? undefined }
          : s
      )
    );
  }, [qc, shipSymbol]);

  // Set a new cooldown (called after API actions)
  const setCooldown = useCallback((cd: ShipCooldown | null) => {
    qc.setQueryData<ShipCooldown | null>(key, cd);
    syncToShipCache(cd);
  }, [qc, key, syncToShipCache]);

  // Ticker: decrement remainingSeconds every second
  useEffect(() => {
    clearInterval(timerRef.current);
    if (!cooldown || cooldown.remainingSeconds <= 0) return;

    timerRef.current = setInterval(() => {
      qc.setQueryData<ShipCooldown | null>(key, (prev) => {
        if (!prev || prev.remainingSeconds <= 1) {
          clearInterval(timerRef.current);
          // Sync expiration to ships cache
          syncToShipCache(null);
          return null;
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [cooldown, cooldown?.expiration, qc, key, syncToShipCache]);

  const isOnCooldown = !!cooldown && cooldown.remainingSeconds > 0;

  return { cooldown, setCooldown, isOnCooldown } as const;
}

/**
 * Prefetch data associated with a ship: its system waypoints and the market
 * at its current location. This warms the cache so subsequent views are instant.
 */
export function usePrefetchShipData() {
  const qc = useQueryClient();
  return (ship: Ship) => {
    const sys = ship.nav.systemSymbol;
    const wp = ship.nav.waypointSymbol;

    // Prefetch system waypoints (only if not already cached)
    qc.prefetchQuery({
      queryKey: queryKeys.waypoints(sys),
      queryFn: () => fetchAllWaypoints(sys),
      staleTime: 1000 * 60 * 30,
    });

    // Prefetch market at the ship's current waypoint
    qc.prefetchQuery({
      queryKey: queryKeys.market(sys, wp),
      queryFn: () => api.getMarket(sys, wp),
      staleTime: 5 * 60 * 1000,
    });
  };
}

/**
 * Watches all in-transit ships and automatically refreshes them in the query
 * cache when they arrive. Every component reading from `useShips()` will
 * re-render with the updated status.
 */
export function useShipArrivalWatcher() {
  const qc = useQueryClient();
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const ships = qc.getQueryData<Ship[]>(queryKeys.ships);

  useEffect(() => {
    if (!ships) return;

    const activeSymbols = new Set<string>();

    for (const ship of ships) {
      if (ship.nav.status !== 'IN_TRANSIT') continue;

      activeSymbols.add(ship.symbol);

      // Skip if we already have a timer for this ship+arrival combo
      const timerKey = `${ship.symbol}:${ship.nav.route.arrival}`;
      if (timers.current.has(timerKey)) continue;

      const arrival = new Date(ship.nav.route.arrival).getTime();
      const delay = Math.max(0, arrival - Date.now() + 500); // +500ms buffer for server

      const timer = setTimeout(async () => {
        timers.current.delete(timerKey);
        try {
          const updated = await api.getShip(ship.symbol);
          // Update the ship in the ships list cache
          qc.setQueryData<Ship[]>(queryKeys.ships, (old) =>
            old?.map((s) => (s.symbol === updated.symbol ? updated : s))
          );
        } catch {
          // If individual fetch fails, invalidate the whole list
          qc.invalidateQueries({ queryKey: queryKeys.ships });
        }
      }, delay);

      timers.current.set(timerKey, timer);
    }

    // Clean up timers for ships that are no longer in transit
    for (const [key, timer] of timers.current) {
      const symbol = key.split(':')[0];
      if (!activeSymbols.has(symbol)) {
        clearTimeout(timer);
        timers.current.delete(key);
      }
    }
  }, [ships, qc]);

  // Cleanup all timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const timer of t.values()) clearTimeout(timer);
      t.clear();
    };
  }, []);
}

/**
 * Returns the latest version of a ship from the query cache.
 * Keeps the selected ship in sync with cache updates from the arrival watcher.
 */
export function useShipFromCache(shipSymbol: string | null | undefined): Ship | null {
  const { data: ships } = useShips();
  if (!shipSymbol || !ships) return null;
  return ships.find((s) => s.symbol === shipSymbol) ?? null;
}
