import type { Ship, Waypoint, Contract } from '../services/api';

export function mockShip(overrides: Partial<Ship> = {}): Ship {
  return {
    symbol: 'SHIP-1',
    nav: {
      systemSymbol: 'X1-TEST',
      waypointSymbol: 'X1-TEST-A1',
      route: {
        origin: { symbol: 'X1-TEST-A1', type: 'PLANET' },
        destination: { symbol: 'X1-TEST-A1', type: 'PLANET' },
        departureTime: new Date().toISOString(),
        arrival: new Date().toISOString(),
      },
      status: 'IN_ORBIT',
      flightMode: 'CRUISE',
    },
    crew: { current: 10, capacity: 20, required: 5, morale: 80 },
    fuel: { current: 400, capacity: 600, consumed: { amount: 0, timestamp: '' } },
    frame: { symbol: 'FRAME_FRIGATE', name: 'Frigate', condition: 0.9, integrity: 0.95 },
    reactor: { symbol: 'REACTOR_SOLAR', name: 'Solar Reactor', condition: 0.85, integrity: 0.9, powerOutput: 20 },
    engine: { symbol: 'ENGINE_IMPULSE', name: 'Impulse Drive', condition: 0.8, integrity: 0.85, speed: 30 },
    modules: [{ symbol: 'MODULE_CARGO', name: 'Cargo Hold', capacity: 40 }],
    mounts: [{ symbol: 'MOUNT_MINING_LASER', name: 'Mining Laser', strength: 10 }],
    cargo: { capacity: 40, units: 5, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', units: 5 }] },
    registration: { name: 'SHIP-1', factionSymbol: 'COSMIC', role: 'COMMAND' },
    ...overrides,
  };
}

export function mockShipInTransit(overrides: Partial<Ship> = {}): Ship {
  const now = new Date();
  const arrival = new Date(now.getTime() + 60_000);
  return mockShip({
    nav: {
      systemSymbol: 'X1-TEST',
      waypointSymbol: 'X1-TEST-A1',
      route: {
        origin: { symbol: 'X1-TEST-A1', type: 'PLANET' },
        destination: { symbol: 'X1-TEST-B2', type: 'PLANET' },
        departureTime: now.toISOString(),
        arrival: arrival.toISOString(),
      },
      status: 'IN_TRANSIT',
      flightMode: 'CRUISE',
    },
    ...overrides,
  });
}

export function mockWaypoint(overrides: Partial<Waypoint> = {}): Waypoint {
  return {
    symbol: 'X1-TEST-A1',
    type: 'PLANET',
    systemSymbol: 'X1-TEST',
    x: 10,
    y: 20,
    orbitals: [],
    traits: [{ symbol: 'MARKETPLACE', name: 'Marketplace', description: 'Has market' }],
    isUnderConstruction: false,
    ...overrides,
  };
}

export function mockContract(overrides: Partial<Contract> = {}): Contract {
  const future = new Date(Date.now() + 86400_000).toISOString();
  return {
    id: 'contract-1',
    factionSymbol: 'COSMIC',
    type: 'PROCUREMENT',
    terms: {
      deadline: future,
      payment: { onAccepted: 1000, onFulfilled: 5000 },
      deliver: [{
        tradeSymbol: 'IRON_ORE',
        destinationSymbol: 'X1-TEST-A1',
        unitsRequired: 100,
        unitsFulfilled: 30,
      }],
    },
    accepted: false,
    fulfilled: false,
    expiration: future,
    deadlineToAccept: future,
    ...overrides,
  } as Contract;
}
