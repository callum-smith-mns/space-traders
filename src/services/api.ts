const BASE_URL = 'https://api.spacetraders.io/v2';

export interface Agent {
  accountId?: string;
  symbol: string;
  headquarters: string;
  credits: number;
  startingFaction: string;
  shipCount: number;
}

export interface Faction {
  symbol: string;
  name: string;
  description: string;
  headquarters: string;
  traits: { symbol: string; name: string; description: string }[];
  isRecruiting: boolean;
}

export interface RegisterResponse {
  agent: Agent;
  contract: unknown;
  faction: Faction;
  ships: unknown[];
  token: string;
}

export interface ShipNav {
  systemSymbol: string;
  waypointSymbol: string;
  route: {
    origin: { symbol: string; type: string };
    destination: { symbol: string; type: string };
    departureTime: string;
    arrival: string;
  };
  status: 'IN_TRANSIT' | 'IN_ORBIT' | 'DOCKED';
  flightMode: 'DRIFT' | 'STEALTH' | 'CRUISE' | 'BURN';
}

export interface ShipFuel {
  current: number;
  capacity: number;
  consumed: { amount: number; timestamp: string };
}

export interface ShipFrame {
  symbol: string;
  name: string;
  condition: number;
  integrity: number;
  fuelCapacity: number;
  moduleSlots: number;
  mountingPoints: number;
}

export interface ShipReactor {
  symbol: string;
  name: string;
  condition: number;
  integrity: number;
  powerOutput: number;
}

export interface ShipEngine {
  symbol: string;
  name: string;
  condition: number;
  integrity: number;
  speed: number;
}

export interface ShipModule {
  symbol: string;
  name: string;
  capacity?: number;
  range?: number;
}

export interface ShipMount {
  symbol: string;
  name: string;
  strength?: number;
}

export interface ShipCrew {
  current: number;
  capacity: number;
  required: number;
  morale: number;
}

export interface ShipCargo {
  capacity: number;
  units: number;
  inventory: { symbol: string; name: string; units: number }[];
}

export interface Ship {
  symbol: string;
  nav: ShipNav;
  crew: ShipCrew;
  fuel: ShipFuel;
  frame: ShipFrame;
  reactor: ShipReactor;
  engine: ShipEngine;
  modules: ShipModule[];
  mounts: ShipMount[];
  cargo: ShipCargo;
  registration: {
    name: string;
    factionSymbol: string;
    role: string;
  };
  cooldown?: ShipCooldown;
}

export interface ShipCooldown {
  shipSymbol: string;
  totalSeconds: number;
  remainingSeconds: number;
  expiration?: string;
}

export interface Waypoint {
  symbol: string;
  type: string;
  systemSymbol: string;
  x: number;
  y: number;
  orbitals: { symbol: string }[];
  traits: { symbol: string; name: string; description: string }[];
  isUnderConstruction: boolean;
}

export interface ScannedSystem {
  symbol: string;
  sectorSymbol: string;
  type: string;
  x: number;
  y: number;
  distance: number;
}

export interface ScannedWaypoint {
  symbol: string;
  type: string;
  systemSymbol: string;
  x: number;
  y: number;
  orbitals: { symbol: string }[];
  traits: { symbol: string; name: string; description: string }[];
}

export interface ScannedShip {
  symbol: string;
  registration: { name: string; factionSymbol: string; role: string };
  nav: ShipNav;
  frame: { symbol: string };
  engine: { symbol: string };
}

export interface ExtractionYield {
  symbol: string;
  units: number;
}

export interface SiphonYield {
  symbol: string;
  units: number;
}

export interface SurveyDeposit {
  symbol: string;
}

export interface Survey {
  signature: string;
  symbol: string;
  deposits: SurveyDeposit[];
  expiration: string;
  size: 'SMALL' | 'MODERATE' | 'LARGE';
}

export interface MarketTransaction {
  waypointSymbol: string;
  shipSymbol: string;
  tradeSymbol: string;
  type: 'PURCHASE' | 'SELL';
  units: number;
  pricePerUnit: number;
  totalPrice: number;
  timestamp: string;
}

export interface Market {
  symbol: string;
  exports: { symbol: string; name: string }[];
  imports: { symbol: string; name: string }[];
  exchange: { symbol: string; name: string }[];
  tradeGoods?: {
    symbol: string;
    type: string;
    tradeVolume: number;
    supply: string;
    purchasePrice: number;
    sellPrice: number;
  }[];
}

export interface ShipyardShip {
  type: string;
  name: string;
  description: string;
  supply: string;
  activity?: string;
  purchasePrice: number;
  frame: ShipFrame;
  reactor: ShipReactor;
  engine: ShipEngine;
  modules: ShipModule[];
  mounts: ShipMount[];
  crew: { required: number; capacity: number };
}

export interface ShipyardTransaction {
  waypointSymbol: string;
  shipSymbol: string;
  shipType: string;
  price: number;
  agentSymbol: string;
  timestamp: string;
}

export interface Shipyard {
  symbol: string;
  shipTypes: { type: string }[];
  transactions?: ShipyardTransaction[];
  ships?: ShipyardShip[];
  modificationsFee: number;
}

interface ApiError {
  error: {
    message: string;
    code: number;
  };
}

export interface ContractDeliverGood {
  tradeSymbol: string;
  destinationSymbol: string;
  unitsRequired: number;
  unitsFulfilled: number;
}

export interface ContractPayment {
  onAccepted: number;
  onFulfilled: number;
}

export interface ContractTerms {
  deadline: string;
  payment: ContractPayment;
  deliver?: ContractDeliverGood[];
}

export interface Contract {
  id: string;
  factionSymbol: string;
  type: 'PROCUREMENT' | 'TRANSPORT' | 'SHUTTLE';
  terms: ContractTerms;
  accepted: boolean;
  fulfilled: boolean;
  deadlineToAccept?: string;
  expiration: string;
}

class SpaceTradersApi {
  private token: string | null = null;
  private _rateLimitResetAt: number | null = null;
  private _rateLimitListeners: Array<(resetAt: number | null) => void> = [];
  private static readonly MAX_RETRIES = 3;

  /** Subscribe to rate-limit state changes. Returns an unsubscribe function. */
  onRateLimitChange(listener: (resetAt: number | null) => void): () => void {
    this._rateLimitListeners.push(listener);
    return () => {
      this._rateLimitListeners = this._rateLimitListeners.filter(l => l !== listener);
    };
  }

  get rateLimitResetAt(): number | null {
    return this._rateLimitResetAt;
  }

  private _notifyRateLimit(resetAt: number | null) {
    if (resetAt === this._rateLimitResetAt) return;
    this._rateLimitResetAt = resetAt;
    for (const l of this._rateLimitListeners) l(resetAt);
  }

  /** Read rate-limit headers from any API response and fire events when exhausted. */
  private _handleRateLimitHeaders(res: Response) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    const resetHeader = res.headers.get('x-ratelimit-reset');

    if (res.status === 429) {
      // Use retry-after header (seconds) or the reset timestamp
      const retryAfter = res.headers.get('retry-after');
      if (retryAfter) {
        this._notifyRateLimit(Date.now() + Number(retryAfter) * 1000);
      } else if (resetHeader) {
        this._notifyRateLimit(new Date(resetHeader).getTime());
      } else {
        // Fallback: 10-second cooldown
        this._notifyRateLimit(Date.now() + 10_000);
      }
      return;
    }

    if (remaining !== null && Number(remaining) <= 0 && resetHeader) {
      this._notifyRateLimit(new Date(resetHeader).getTime());
    } else if (this._rateLimitResetAt && Date.now() >= this._rateLimitResetAt) {
      // Rate limit period has passed — clear
      this._notifyRateLimit(null);
    }
  }

  /** Wait until any active rate-limit window has passed before making a request. */
  private async _waitForRateLimit(): Promise<void> {
    if (!this._rateLimitResetAt) return;
    const wait = this._rateLimitResetAt - Date.now();
    if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait + 100));
    }
    this._notifyRateLimit(null);
  }

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
    _retryCount = 0
  ): Promise<T> {
    await this._waitForRateLimit();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    if (options.method === 'POST' && !options.body) {
      options.body = '{}';
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    this._handleRateLimitHeaders(res);

    if (res.status === 429) {
      if (_retryCount >= SpaceTradersApi.MAX_RETRIES) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      await this._waitForRateLimit();
      return this.request<T>(path, options, _retryCount + 1);
    }

    const json = await res.json();

    if (!res.ok) {
      const err = json as ApiError;
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    return (json as { data: T }).data;
  }

  async getMyAgent(): Promise<Agent> {
    return this.request<Agent>('/my/agent');
  }

  async listFactions(
    page = 1,
    limit = 20,
    _retryCount = 0
  ): Promise<{ data: Faction[]; meta: { total: number } }> {
    await this._waitForRateLimit();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(
      `${BASE_URL}/factions?page=${page}&limit=${limit}`,
      { headers }
    );
    this._handleRateLimitHeaders(res);
    if (res.status === 429) {
      if (_retryCount >= SpaceTradersApi.MAX_RETRIES) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      await this._waitForRateLimit();
      return this.listFactions(page, limit, _retryCount + 1);
    }
    const json = await res.json();
    if (!res.ok) {
      const err = json as ApiError;
      throw new Error(err.error?.message || `API error ${res.status}`);
    }
    return json as { data: Faction[]; meta: { total: number } };
  }

  async registerAgent(
    symbol: string,
    faction: string,
    _retryCount = 0
  ): Promise<RegisterResponse> {
    if (!this.token) {
      throw new Error('An account token is required to register a new agent. Log in with your account token from my.spacetraders.io.');
    }
    await this._waitForRateLimit();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
    };
    const res = await fetch(`${BASE_URL}/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ symbol, faction }),
    });
    this._handleRateLimitHeaders(res);
    if (res.status === 429) {
      if (_retryCount >= SpaceTradersApi.MAX_RETRIES) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      await this._waitForRateLimit();
      return this.registerAgent(symbol, faction, _retryCount + 1);
    }
    const json = await res.json();
    if (!res.ok) {
      const err = json as ApiError;
      throw new Error(err.error?.message || `API error ${res.status}`);
    }
    return (json as { data: RegisterResponse }).data;
  }

  async listMyShips(page = 1, limit = 20): Promise<Ship[]> {
    return this.request<Ship[]>(`/my/ships?page=${page}&limit=${limit}`);
  }

  async getShip(shipSymbol: string): Promise<Ship> {
    return this.request<Ship>(`/my/ships/${encodeURIComponent(shipSymbol)}`);
  }

  // --- Navigation ---

  async orbitShip(shipSymbol: string): Promise<{ nav: ShipNav }> {
    return this.request<{ nav: ShipNav }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/orbit`,
      { method: 'POST' }
    );
  }

  async dockShip(shipSymbol: string): Promise<{ nav: ShipNav }> {
    return this.request<{ nav: ShipNav }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/dock`,
      { method: 'POST' }
    );
  }

  async navigateShip(
    shipSymbol: string,
    waypointSymbol: string
  ): Promise<{ nav: ShipNav; fuel: ShipFuel; events: unknown[] }> {
    return this.request<{ nav: ShipNav; fuel: ShipFuel; events: unknown[] }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/navigate`,
      { method: 'POST', body: JSON.stringify({ waypointSymbol }) }
    );
  }

  async warpShip(
    shipSymbol: string,
    waypointSymbol: string
  ): Promise<{ nav: ShipNav; fuel: ShipFuel }> {
    return this.request<{ nav: ShipNav; fuel: ShipFuel }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/warp`,
      { method: 'POST', body: JSON.stringify({ waypointSymbol }) }
    );
  }

  async setFlightMode(
    shipSymbol: string,
    flightMode: ShipNav['flightMode']
  ): Promise<{ nav: ShipNav }> {
    return this.request<{ nav: ShipNav }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/nav`,
      { method: 'PATCH', body: JSON.stringify({ flightMode }) }
    );
  }

  // --- Scanning ---

  async scanSystems(shipSymbol: string): Promise<{ cooldown: ShipCooldown; systems: ScannedSystem[] }> {
    return this.request<{ cooldown: ShipCooldown; systems: ScannedSystem[] }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/scan/systems`,
      { method: 'POST' }
    );
  }

  async scanWaypoints(shipSymbol: string): Promise<{ cooldown: ShipCooldown; waypoints: ScannedWaypoint[] }> {
    return this.request<{ cooldown: ShipCooldown; waypoints: ScannedWaypoint[] }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/scan/waypoints`,
      { method: 'POST' }
    );
  }

  async scanShips(shipSymbol: string): Promise<{ cooldown: ShipCooldown; ships: ScannedShip[] }> {
    return this.request<{ cooldown: ShipCooldown; ships: ScannedShip[] }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/scan/ships`,
      { method: 'POST' }
    );
  }

  // --- Resource extraction ---

  async surveyWaypoint(shipSymbol: string): Promise<{ cooldown: ShipCooldown; surveys: Survey[] }> {
    return this.request<{ cooldown: ShipCooldown; surveys: Survey[] }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/survey`,
      { method: 'POST' }
    );
  }

  async extractResources(shipSymbol: string): Promise<{ cooldown: ShipCooldown; extraction: { shipSymbol: string; yield: ExtractionYield }; cargo: ShipCargo }> {
    return this.request<{ cooldown: ShipCooldown; extraction: { shipSymbol: string; yield: ExtractionYield }; cargo: ShipCargo }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/extract`,
      { method: 'POST' }
    );
  }

  async extractWithSurvey(shipSymbol: string, survey: Survey): Promise<{ cooldown: ShipCooldown; extraction: { shipSymbol: string; yield: ExtractionYield }; cargo: ShipCargo }> {
    return this.request<{ cooldown: ShipCooldown; extraction: { shipSymbol: string; yield: ExtractionYield }; cargo: ShipCargo }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/extract/survey`,
      { method: 'POST', body: JSON.stringify(survey) }
    );
  }

  async siphonResources(shipSymbol: string): Promise<{ cooldown: ShipCooldown; siphon: { shipSymbol: string; yield: SiphonYield }; cargo: ShipCargo }> {
    return this.request<{ cooldown: ShipCooldown; siphon: { shipSymbol: string; yield: SiphonYield }; cargo: ShipCargo }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/siphon`,
      { method: 'POST' }
    );
  }

  async refineShip(shipSymbol: string, produce: string): Promise<{ cargo: ShipCargo; cooldown: ShipCooldown; produced: { tradeSymbol: string; units: number }[]; consumed: { tradeSymbol: string; units: number }[] }> {
    return this.request<{ cargo: ShipCargo; cooldown: ShipCooldown; produced: { tradeSymbol: string; units: number }[]; consumed: { tradeSymbol: string; units: number }[] }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/refine`,
      { method: 'POST', body: JSON.stringify({ produce }) }
    );
  }

  // --- Refueling ---

  async refuelShip(shipSymbol: string, units?: number): Promise<{ agent: Agent; fuel: ShipFuel; transaction: MarketTransaction }> {
    const body: Record<string, unknown> = {};
    if (units !== undefined) body.units = units;
    return this.request<{ agent: Agent; fuel: ShipFuel; transaction: MarketTransaction }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/refuel`,
      { method: 'POST', body: JSON.stringify(body) }
    );
  }

  // --- Cargo ---

  async sellCargo(shipSymbol: string, symbol: string, units: number): Promise<{ agent: Agent; cargo: ShipCargo; transaction: MarketTransaction }> {
    return this.request<{ agent: Agent; cargo: ShipCargo; transaction: MarketTransaction }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/sell`,
      { method: 'POST', body: JSON.stringify({ symbol, units }) }
    );
  }

  async purchaseCargo(shipSymbol: string, symbol: string, units: number): Promise<{ agent: Agent; cargo: ShipCargo; transaction: MarketTransaction }> {
    return this.request<{ agent: Agent; cargo: ShipCargo; transaction: MarketTransaction }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/purchase`,
      { method: 'POST', body: JSON.stringify({ symbol, units }) }
    );
  }

  async jettisonCargo(shipSymbol: string, symbol: string, units: number): Promise<{ cargo: ShipCargo }> {
    return this.request<{ cargo: ShipCargo }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/jettison`,
      { method: 'POST', body: JSON.stringify({ symbol, units }) }
    );
  }

  // --- Market ---

  async getMarket(systemSymbol: string, waypointSymbol: string): Promise<Market> {
    return this.request<Market>(
      `/systems/${encodeURIComponent(systemSymbol)}/waypoints/${encodeURIComponent(waypointSymbol)}/market`
    );
  }

  // --- Shipyard ---

  async getShipyard(systemSymbol: string, waypointSymbol: string): Promise<Shipyard> {
    return this.request<Shipyard>(
      `/systems/${encodeURIComponent(systemSymbol)}/waypoints/${encodeURIComponent(waypointSymbol)}/shipyard`
    );
  }

  async purchaseShip(shipType: string, waypointSymbol: string): Promise<{ agent: Agent; ship: Ship; transaction: ShipyardTransaction }> {
    return this.request<{ agent: Agent; ship: Ship; transaction: ShipyardTransaction }>(
      '/my/ships',
      { method: 'POST', body: JSON.stringify({ shipType, waypointSymbol }) }
    );
  }

  // --- Waypoints ---

  async listWaypoints(systemSymbol: string, page = 1, limit = 20): Promise<Waypoint[]> {
    return this.request<Waypoint[]>(
      `/systems/${encodeURIComponent(systemSymbol)}/waypoints?page=${page}&limit=${limit}`
    );
  }

  async getShipCooldown(shipSymbol: string): Promise<ShipCooldown | null> {
    try {
      return await this.request<ShipCooldown>(
        `/my/ships/${encodeURIComponent(shipSymbol)}/cooldown`
      );
    } catch {
      return null; // 204 No Content = no active cooldown
    }
  }

  async listMyContracts(page = 1, limit = 20): Promise<Contract[]> {
    return this.request<Contract[]>(`/my/contracts?page=${page}&limit=${limit}`);
  }

  async acceptContract(contractId: string): Promise<{ agent: Agent; contract: Contract }> {
    return this.request<{ agent: Agent; contract: Contract }>(
      `/my/contracts/${encodeURIComponent(contractId)}/accept`,
      { method: 'POST' }
    );
  }

  async negotiateContract(shipSymbol: string): Promise<{ contract: Contract }> {
    return this.request<{ contract: Contract }>(
      `/my/ships/${encodeURIComponent(shipSymbol)}/negotiate/contract`,
      { method: 'POST' }
    );
  }

  async transferCargo(
    fromShipSymbol: string,
    toShipSymbol: string,
    tradeSymbol: string,
    units: number
  ): Promise<{ cargo: ShipCargo }> {
    return this.request<{ cargo: ShipCargo }>(
      `/my/ships/${encodeURIComponent(fromShipSymbol)}/transfer`,
      { method: 'POST', body: JSON.stringify({ tradeSymbol, units, shipSymbol: toShipSymbol }) }
    );
  }

  async deliverContractCargo(
    contractId: string,
    shipSymbol: string,
    tradeSymbol: string,
    units: number
  ): Promise<{ contract: Contract; cargo: ShipCargo }> {
    return this.request<{ contract: Contract; cargo: ShipCargo }>(
      `/my/contracts/${encodeURIComponent(contractId)}/deliver`,
      { method: 'POST', body: JSON.stringify({ shipSymbol, tradeSymbol, units }) }
    );
  }

  async fulfillContract(contractId: string): Promise<{ agent: Agent; contract: Contract }> {
    return this.request<{ agent: Agent; contract: Contract }>(
      `/my/contracts/${encodeURIComponent(contractId)}/fulfill`,
      { method: 'POST' }
    );
  }
}

export const api = new SpaceTradersApi();
