import { type Page } from '@playwright/test';

const API = 'https://api.spacetraders.io/v2';

/* ─── Fixture data ────────────────────────────────────────────── */

export const AGENT = {
  accountId: 'acc-123',
  symbol: 'TESTPILOT',
  headquarters: 'X1-TEST-A1',
  credits: 175000,
  startingFaction: 'COSMIC',
  shipCount: 2,
};

export const FACTION = {
  symbol: 'COSMIC',
  name: 'Cosmic Engineers',
  description: 'A faction of cosmic engineers.',
  headquarters: 'X1-TEST-A1',
  traits: [
    { symbol: 'BUREAUCRATIC', name: 'Bureaucratic', description: 'Lots of paperwork.' },
    { symbol: 'INNOVATIVE', name: 'Innovative', description: 'Cutting edge.' },
  ],
  isRecruiting: true,
};

export const FACTIONS = [
  FACTION,
  {
    symbol: 'VOID',
    name: 'Void Traders',
    description: 'Traders of the void.',
    headquarters: 'X1-VOID-A1',
    traits: [{ symbol: 'CAPITALISTIC', name: 'Capitalistic', description: 'Money first.' }],
    isRecruiting: true,
  },
];

const waypointBase = {
  systemSymbol: 'X1-TEST',
  orbitals: [],
  traits: [],
  isUnderConstruction: false,
};

export const WAYPOINTS = [
  {
    ...waypointBase,
    symbol: 'X1-TEST-A1',
    type: 'PLANET',
    x: 0,
    y: 0,
    traits: [
      { symbol: 'MARKETPLACE', name: 'Marketplace', description: '' },
      { symbol: 'SHIPYARD', name: 'Shipyard', description: '' },
    ],
  },
  {
    ...waypointBase,
    symbol: 'X1-TEST-B2',
    type: 'ASTEROID_FIELD',
    x: 10,
    y: 20,
    traits: [
      { symbol: 'MINERAL_DEPOSITS', name: 'Mineral Deposits', description: '' },
    ],
  },
  {
    ...waypointBase,
    symbol: 'X1-TEST-C3',
    type: 'MOON',
    x: -5,
    y: 15,
    traits: [
      { symbol: 'MARKETPLACE', name: 'Marketplace', description: '' },
    ],
  },
];

function makeShipNav(waypointSymbol: string, status: 'DOCKED' | 'IN_ORBIT' | 'IN_TRANSIT' = 'DOCKED') {
  return {
    systemSymbol: 'X1-TEST',
    waypointSymbol,
    route: {
      origin: { symbol: waypointSymbol, type: 'PLANET', systemSymbol: 'X1-TEST', x: 0, y: 0 },
      destination: { symbol: waypointSymbol, type: 'PLANET', systemSymbol: 'X1-TEST', x: 0, y: 0 },
      departureTime: new Date().toISOString(),
      arrival: new Date().toISOString(),
    },
    status,
    flightMode: 'CRUISE' as const,
  };
}

function shipComponent(condition: number, integrity: number) {
  return { condition, integrity };
}

export const SHIPS = [
  {
    symbol: 'TESTPILOT-1',
    registration: { name: 'TESTPILOT-1', factionSymbol: 'COSMIC', role: 'COMMAND' },
    nav: makeShipNav('X1-TEST-A1', 'DOCKED'),
    crew: { current: 57, required: 57, capacity: 80, rotation: 'STRICT', morale: 100, wages: 0 },
    frame: { symbol: 'FRAME_FRIGATE', name: 'Frigate', description: '', moduleSlots: 8, mountingPoints: 5, fuelCapacity: 1200, requirements: { power: 8, crew: 57 }, quality: 1, ...shipComponent(1, 1) },
    reactor: { symbol: 'REACTOR_FISSION_I', name: 'Fission Reactor I', description: '', powerOutput: 31, requirements: { crew: 8 }, quality: 1, ...shipComponent(1, 1) },
    engine: { symbol: 'ENGINE_ION_DRIVE_II', name: 'Ion Drive II', description: '', speed: 30, requirements: { power: 6, crew: 8 }, quality: 1, ...shipComponent(1, 1) },
    modules: [
      { symbol: 'MODULE_CARGO_HOLD_II', name: 'Cargo Hold II', description: '', capacity: 40, requirements: { power: 2, crew: 2, slots: 2 } },
      { symbol: 'MODULE_CREW_QUARTERS_I', name: 'Crew Quarters I', description: '', capacity: 40, requirements: { power: 1, crew: 2, slots: 1 } },
    ],
    mounts: [
      { symbol: 'MOUNT_SENSOR_ARRAY_II', name: 'Sensor Array II', description: '', strength: 4, requirements: { power: 2, crew: 2 } },
      { symbol: 'MOUNT_MINING_LASER_II', name: 'Mining Laser II', description: '', strength: 5, deposits: ['IRON_ORE', 'COPPER_ORE'], requirements: { power: 2, crew: 2 } },
      { symbol: 'MOUNT_SURVEYOR_I', name: 'Surveyor I', description: '', strength: 1, requirements: { power: 1, crew: 1 } },
    ],
    cargo: {
      capacity: 40,
      units: 5,
      inventory: [
        { symbol: 'IRON_ORE', name: 'Iron Ore', description: 'Crude iron ore.', units: 5 },
      ],
    },
    fuel: { current: 1200, capacity: 1200, consumed: { amount: 0, timestamp: new Date().toISOString() } },
    cooldown: { shipSymbol: 'TESTPILOT-1', totalSeconds: 0, remainingSeconds: 0, expiration: new Date().toISOString() },
  },
  {
    symbol: 'TESTPILOT-2',
    registration: { name: 'TESTPILOT-2', factionSymbol: 'COSMIC', role: 'EXCAVATOR' },
    nav: makeShipNav('X1-TEST-B2', 'IN_ORBIT'),
    crew: { current: 0, required: 0, capacity: 0, rotation: 'STRICT', morale: 100, wages: 0 },
    frame: { symbol: 'FRAME_DRONE', name: 'Drone', description: '', moduleSlots: 3, mountingPoints: 2, fuelCapacity: 100, requirements: { power: 1, crew: 0 }, quality: 1, ...shipComponent(1, 1) },
    reactor: { symbol: 'REACTOR_CHEMICAL_I', name: 'Chemical Reactor I', description: '', powerOutput: 15, requirements: { crew: 3 }, quality: 1, ...shipComponent(1, 1) },
    engine: { symbol: 'ENGINE_IMPULSE_DRIVE_I', name: 'Impulse Drive I', description: '', speed: 3, requirements: { power: 3, crew: 0 }, quality: 1, ...shipComponent(0.6, 0.8) },
    modules: [
      { symbol: 'MODULE_CARGO_HOLD_I', name: 'Cargo Hold I', description: '', capacity: 15, requirements: { power: 1, crew: 0, slots: 1 } },
    ],
    mounts: [
      { symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser I', description: '', strength: 10, deposits: ['IRON_ORE'], requirements: { power: 1, crew: 0 } },
    ],
    cargo: { capacity: 15, units: 0, inventory: [] },
    fuel: { current: 80, capacity: 100, consumed: { amount: 0, timestamp: new Date().toISOString() } },
    cooldown: { shipSymbol: 'TESTPILOT-2', totalSeconds: 0, remainingSeconds: 0, expiration: new Date().toISOString() },
  },
];

export const CONTRACT = {
  id: 'contract-001',
  factionSymbol: 'COSMIC',
  type: 'PROCUREMENT',
  terms: {
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    payment: { onAccepted: 5000, onFulfilled: 50000 },
    deliver: [
      {
        tradeSymbol: 'IRON_ORE',
        destinationSymbol: 'X1-TEST-A1',
        unitsRequired: 40,
        unitsFulfilled: 0,
      },
    ],
  },
  accepted: false,
  fulfilled: false,
  expiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  deadlineToAccept: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
};

export const MARKET = {
  symbol: 'X1-TEST-A1',
  exports: [{ symbol: 'IRON', name: 'Iron', description: '' }],
  imports: [{ symbol: 'FOOD', name: 'Food', description: '' }],
  exchange: [{ symbol: 'FUEL', name: 'Fuel', description: '' }],
  tradeGoods: [
    { symbol: 'IRON', type: 'EXPORT', tradeVolume: 100, supply: 'ABUNDANT', purchasePrice: 4, sellPrice: 3 },
    { symbol: 'FOOD', type: 'IMPORT', tradeVolume: 100, supply: 'MODERATE', purchasePrice: 20, sellPrice: 18 },
    { symbol: 'FUEL', type: 'EXCHANGE', tradeVolume: 100, supply: 'HIGH', purchasePrice: 2, sellPrice: 1 },
  ],
};

export const SHIPYARD = {
  symbol: 'X1-TEST-A1',
  shipTypes: [{ type: 'SHIP_MINING_DRONE' }],
  modificationsFee: 100,
  ships: [
    {
      type: 'SHIP_MINING_DRONE',
      name: 'Mining Drone',
      description: 'A small mining drone.',
      supply: 'ABUNDANT',
      activity: 'STRONG',
      purchasePrice: 15000,
      frame: { symbol: 'FRAME_DRONE', name: 'Drone', description: '', moduleSlots: 3, mountingPoints: 2, fuelCapacity: 100, requirements: { power: 1, crew: 0 }, quality: 1, condition: 1, integrity: 1 },
      reactor: { symbol: 'REACTOR_CHEMICAL_I', name: 'Chemical Reactor', description: '', powerOutput: 15, requirements: { crew: 0 }, quality: 1, condition: 1, integrity: 1 },
      engine: { symbol: 'ENGINE_IMPULSE_DRIVE_I', name: 'Impulse Drive', description: '', speed: 3, requirements: { power: 3, crew: 0 }, quality: 1, condition: 1, integrity: 1 },
      modules: [{ symbol: 'MODULE_CARGO_HOLD_I', name: 'Cargo Hold', description: '', capacity: 15, requirements: { power: 1, crew: 0, slots: 1 } }],
      mounts: [{ symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser', description: '', strength: 10, requirements: { power: 1, crew: 0 } }],
      crew: { required: 0, capacity: 0 },
    },
  ],
};

export const AGENT_TOKEN = 'mock-agent-token-for-testing';
export const ACCOUNT_TOKEN = 'mock-account-token-for-testing';

/* ─── Route handler setup ─────────────────────────────────────── */

/** Install API mock routes on a Playwright page. Call before navigating. */
export async function mockAllApiRoutes(page: Page) {
  // GET /my/agent
  await page.route(`${API}/my/agent`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { data: AGENT } });
    }
    return route.fallback();
  });

  // GET /factions
  await page.route(`${API}/factions*`, (route) => {
    return route.fulfill({
      json: { data: FACTIONS, meta: { total: FACTIONS.length, page: 1, limit: 20 } },
    });
  });

  // POST /register
  await page.route(`${API}/register`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        json: {
          data: {
            agent: AGENT,
            contract: CONTRACT,
            faction: FACTION,
            ships: SHIPS,
            token: AGENT_TOKEN,
          },
        },
      });
    }
    return route.fallback();
  });

  // GET /my/ships
  await page.route(`${API}/my/ships?*`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: { data: SHIPS, meta: { total: SHIPS.length, page: 1, limit: 20 } },
      });
    }
    return route.fallback();
  });

  // GET /my/ships/{symbol}
  await page.route(/\/my\/ships\/[A-Z0-9-]+$/, (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const url = route.request().url();
    const symbol = url.split('/my/ships/')[1];
    const ship = SHIPS.find((s) => s.symbol === symbol);
    return route.fulfill({ json: { data: ship ?? SHIPS[0] } });
  });

  // GET /my/ships/{symbol}/cooldown
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/cooldown/, (route) => {
    return route.fulfill({ status: 204, body: '' });
  });

  // POST orbit / dock / navigate / warp / nav patch
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/(orbit|dock)/, (route) => {
    const action = route.request().url().includes('/orbit') ? 'IN_ORBIT' : 'DOCKED';
    const url = route.request().url();
    const symbol = url.match(/\/my\/ships\/([A-Z0-9-]+)\//)?.[1] ?? SHIPS[0].symbol;
    const ship = SHIPS.find((s) => s.symbol === symbol) ?? SHIPS[0];
    return route.fulfill({
      json: { data: { nav: { ...ship.nav, status: action } } },
    });
  });

  await page.route(/\/my\/ships\/[A-Z0-9-]+\/navigate/, (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const url = route.request().url();
    const symbol = url.match(/\/my\/ships\/([A-Z0-9-]+)\//)?.[1] ?? SHIPS[0].symbol;
    const ship = SHIPS.find((s) => s.symbol === symbol) ?? SHIPS[0];
    const arrival = new Date(Date.now() + 30_000).toISOString();
    return route.fulfill({
      json: {
        data: {
          nav: { ...ship.nav, status: 'IN_TRANSIT', route: { ...ship.nav.route, arrival, departureTime: new Date().toISOString() } },
          fuel: { ...ship.fuel, current: ship.fuel.current - 10 },
          events: [],
        },
      },
    });
  });

  await page.route(/\/my\/ships\/[A-Z0-9-]+\/nav$/, (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback();
    return route.fulfill({
      json: { data: { nav: { ...SHIPS[0].nav, flightMode: 'BURN' }, fuel: SHIPS[0].fuel, events: [] } },
    });
  });

  // Scanning
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/scan\/waypoints/, (route) => {
    return route.fulfill({
      json: {
        data: {
          cooldown: { shipSymbol: 'TESTPILOT-1', totalSeconds: 60, remainingSeconds: 60 },
          waypoints: WAYPOINTS.map((w) => ({ ...w, traits: w.traits, chart: { waypointSymbol: w.symbol, submittedBy: 'TESTPILOT', submittedOn: new Date().toISOString() } })),
        },
      },
    });
  });

  await page.route(/\/my\/ships\/[A-Z0-9-]+\/scan\/ships/, (route) => {
    return route.fulfill({
      json: {
        data: {
          cooldown: { shipSymbol: 'TESTPILOT-1', totalSeconds: 60, remainingSeconds: 60 },
          ships: [],
        },
      },
    });
  });

  await page.route(/\/my\/ships\/[A-Z0-9-]+\/scan\/systems/, (route) => {
    return route.fulfill({
      json: {
        data: {
          cooldown: { shipSymbol: 'TESTPILOT-1', totalSeconds: 60, remainingSeconds: 60 },
          systems: [],
        },
      },
    });
  });

  // Survey
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/survey/, (route) => {
    return route.fulfill({
      json: {
        data: {
          cooldown: { shipSymbol: 'TESTPILOT-1', totalSeconds: 60, remainingSeconds: 60 },
          surveys: [
            {
              signature: 'X1-TEST-B2-SURVEY-1',
              symbol: 'X1-TEST-B2',
              deposits: [{ symbol: 'IRON_ORE' }, { symbol: 'COPPER_ORE' }],
              expiration: new Date(Date.now() + 3600_000).toISOString(),
              size: 'MODERATE',
            },
          ],
        },
      },
    });
  });

  // Extract
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/extract$/, (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      json: {
        data: {
          cooldown: { shipSymbol: 'TESTPILOT-1', totalSeconds: 70, remainingSeconds: 70 },
          extraction: { shipSymbol: 'TESTPILOT-1', yield: { symbol: 'IRON_ORE', units: 3 } },
          cargo: { capacity: 40, units: 8, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', description: '', units: 8 }] },
          events: [],
        },
      },
    });
  });

  await page.route(/\/my\/ships\/[A-Z0-9-]+\/extract\/survey/, (route) => {
    return route.fulfill({
      json: {
        data: {
          cooldown: { shipSymbol: 'TESTPILOT-1', totalSeconds: 70, remainingSeconds: 70 },
          extraction: { shipSymbol: 'TESTPILOT-1', yield: { symbol: 'IRON_ORE', units: 5 } },
          cargo: { capacity: 40, units: 10, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', description: '', units: 10 }] },
          events: [],
        },
      },
    });
  });

  // Siphon
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/siphon/, (route) => {
    return route.fulfill({
      json: {
        data: {
          cooldown: { shipSymbol: 'TESTPILOT-1', totalSeconds: 70, remainingSeconds: 70 },
          siphon: { shipSymbol: 'TESTPILOT-1', yield: { symbol: 'LIQUID_HYDROGEN', units: 3 } },
          cargo: { capacity: 40, units: 8, inventory: [{ symbol: 'LIQUID_HYDROGEN', name: 'Liquid Hydrogen', description: '', units: 3 }] },
          events: [],
        },
      },
    });
  });

  // Refuel
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/refuel/, (route) => {
    return route.fulfill({
      json: {
        data: {
          agent: { ...AGENT, credits: AGENT.credits - 100 },
          fuel: { current: 1200, capacity: 1200 },
          transaction: { waypointSymbol: 'X1-TEST-A1', shipSymbol: 'TESTPILOT-1', tradeSymbol: 'FUEL', type: 'PURCHASE', units: 100, pricePerUnit: 1, totalPrice: 100, timestamp: new Date().toISOString() },
        },
      },
    });
  });

  // Sell cargo
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/sell/, (route) => {
    return route.fulfill({
      json: {
        data: {
          agent: { ...AGENT, credits: AGENT.credits + 50 },
          cargo: { capacity: 40, units: 0, inventory: [] },
          transaction: { waypointSymbol: 'X1-TEST-A1', shipSymbol: 'TESTPILOT-1', tradeSymbol: 'IRON_ORE', type: 'SELL', units: 5, pricePerUnit: 10, totalPrice: 50, timestamp: new Date().toISOString() },
        },
      },
    });
  });

  // Purchase cargo
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/purchase$/, (route) => {
    return route.fulfill({
      json: {
        data: {
          agent: { ...AGENT, credits: AGENT.credits - 20 },
          cargo: { capacity: 40, units: 6, inventory: [{ symbol: 'FOOD', name: 'Food', description: '', units: 1 }] },
          transaction: { waypointSymbol: 'X1-TEST-A1', shipSymbol: 'TESTPILOT-1', tradeSymbol: 'FOOD', type: 'PURCHASE', units: 1, pricePerUnit: 20, totalPrice: 20, timestamp: new Date().toISOString() },
        },
      },
    });
  });

  // Jettison
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/jettison/, (route) => {
    return route.fulfill({
      json: { data: { cargo: { capacity: 40, units: 0, inventory: [] } } },
    });
  });

  // Transfer
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/transfer/, (route) => {
    return route.fulfill({
      json: { data: { cargo: { capacity: 40, units: 0, inventory: [] } } },
    });
  });

  // Contracts
  await page.route(`${API}/my/contracts*`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: { data: [CONTRACT], meta: { total: 1, page: 1, limit: 20 } },
      });
    }
    return route.fallback();
  });

  // Accept contract
  await page.route(/\/my\/contracts\/[^/]+\/accept/, (route) => {
    return route.fulfill({
      json: {
        data: {
          agent: { ...AGENT, credits: AGENT.credits + 5000 },
          contract: { ...CONTRACT, accepted: true },
        },
      },
    });
  });

  // Deliver to contract
  await page.route(/\/my\/contracts\/[^/]+\/deliver/, (route) => {
    return route.fulfill({
      json: {
        data: {
          contract: {
            ...CONTRACT,
            accepted: true,
            terms: {
              ...CONTRACT.terms,
              deliver: [{ ...CONTRACT.terms.deliver[0], unitsFulfilled: 5 }],
            },
          },
          cargo: { capacity: 40, units: 0, inventory: [] },
        },
      },
    });
  });

  // Fulfill contract
  await page.route(/\/my\/contracts\/[^/]+\/fulfill/, (route) => {
    return route.fulfill({
      json: {
        data: {
          agent: { ...AGENT, credits: AGENT.credits + 55000 },
          contract: { ...CONTRACT, accepted: true, fulfilled: true },
        },
      },
    });
  });

  // Negotiate contract
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/negotiate\/contract/, (route) => {
    return route.fulfill({
      json: {
        data: {
          contract: {
            ...CONTRACT,
            id: 'contract-002',
            accepted: false,
            fulfilled: false,
          },
        },
      },
    });
  });

  // Purchase ship
  await page.route(`${API}/my/ships`, (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    return route.fulfill({
      status: 201,
      json: {
        data: {
          agent: { ...AGENT, credits: AGENT.credits - 15000, shipCount: 3 },
          ship: { ...SHIPS[1], symbol: 'TESTPILOT-3' },
          transaction: { waypointSymbol: 'X1-TEST-A1', shipSymbol: '', shipType: 'SHIP_MINING_DRONE', price: 15000, agentSymbol: 'TESTPILOT', timestamp: new Date().toISOString() },
        },
      },
    });
  });

  // Waypoints
  await page.route(/\/systems\/[^/]+\/waypoints(\?|$)/, (route) => {
    if (route.request().url().includes('/market') || route.request().url().includes('/shipyard')) {
      return route.fallback();
    }
    return route.fulfill({
      json: { data: WAYPOINTS, meta: { total: WAYPOINTS.length, page: 1, limit: 20 } },
    });
  });

  // Market
  await page.route(/\/systems\/[^/]+\/waypoints\/[^/]+\/market/, (route) => {
    return route.fulfill({ json: { data: MARKET } });
  });

  // Shipyard
  await page.route(/\/systems\/[^/]+\/waypoints\/[^/]+\/shipyard/, (route) => {
    return route.fulfill({ json: { data: SHIPYARD } });
  });

  // Refine
  await page.route(/\/my\/ships\/[A-Z0-9-]+\/refine/, (route) => {
    return route.fulfill({
      json: {
        data: {
          cargo: { capacity: 40, units: 5, inventory: [{ symbol: 'IRON', name: 'Iron', description: '', units: 5 }] },
          cooldown: { shipSymbol: 'TESTPILOT-1', totalSeconds: 30, remainingSeconds: 30 },
          produced: [{ tradeSymbol: 'IRON', units: 5 }],
          consumed: [{ tradeSymbol: 'IRON_ORE', units: 50 }],
        },
      },
    });
  });
}

/* ─── Auth helpers ─────────────────────────────────────────────── */

/**
 * Inject an agent token into the app via localStorage encryption,
 * bypassing the login screen. Uses the crypto API available to the page.
 */
export async function injectAgentAuth(page: Page) {
  await page.evaluate(async (token: string) => {
    const agent = {
      accountId: 'acc-123',
      symbol: 'TESTPILOT',
      headquarters: 'X1-TEST-A1',
      credits: 175000,
      startingFaction: 'COSMIC',
      shipCount: 2,
    };

    // Derive same key the app uses
    const raw = new TextEncoder().encode(`spacetraders-ui::${window.location.origin}`);
    const keyMaterial = await crypto.subtle.importKey('raw', raw, 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('spacetraders-salt-v1'), iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );

    // Encrypt and store the agent token
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
    localStorage.setItem('st_encrypted_token', btoa(String.fromCharCode(...new Uint8Array(encrypted))));
    localStorage.setItem('st_iv', btoa(String.fromCharCode(...iv)));

    // Also save agent info so the app can restore the session
    const savedAgents = [{
      symbol: agent.symbol,
      faction: agent.startingFaction,
      headquarters: agent.headquarters,
      tokenKey: `st_tok_${agent.symbol}`,
      ivKey: `st_iv_${agent.symbol}`,
    }];
    localStorage.setItem('st_saved_agents', JSON.stringify(savedAgents));

    // Per-agent token
    const iv2 = crypto.getRandomValues(new Uint8Array(12));
    const enc2 = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv2 }, key, new TextEncoder().encode(token));
    localStorage.setItem(`st_tok_${agent.symbol}`, btoa(String.fromCharCode(...new Uint8Array(enc2))));
    localStorage.setItem(`st_iv_${agent.symbol}`, btoa(String.fromCharCode(...iv2)));
  }, AGENT_TOKEN);
}

/**
 * Set up mocks + inject auth and navigate to the game screen.
 * Returns after the game screen has loaded.
 */
export async function setupGameScreen(page: Page) {
  await mockAllApiRoutes(page);
  // Go to origin first so we can access localStorage
  await page.goto('/');
  await injectAgentAuth(page);
  // Reload to pick up the injected auth
  await page.reload();
  // The app auto-launches into the game screen after token restore
  await page.waitForSelector('.game-topbar', { timeout: 15_000 });
}
