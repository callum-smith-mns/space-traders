import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FlightControl from '../components/FlightControl';
import * as AuthModule from '../contexts/AuthContext';
import * as useQueriesModule from '../hooks/useQueries';
import { mockShip, mockShipInTransit, mockWaypoint } from './mocks';


vi.mock('../services/api', () => ({
  api: {
    orbitShip: vi.fn(),
    dockShip: vi.fn(),
    navigateShip: vi.fn(),
    warpShip: vi.fn(),
    setFlightMode: vi.fn(),
    refuelShip: vi.fn(),
    scanSystems: vi.fn(),
    scanWaypoints: vi.fn(),
    scanShips: vi.fn(),
    extractResources: vi.fn(),
    extractWithSurvey: vi.fn(),
    siphonResources: vi.fn(),
    surveyWaypoint: vi.fn(),
    sellCargo: vi.fn(),
    purchaseCargo: vi.fn(),
    jettisonCargo: vi.fn(),
    transferCargo: vi.fn(),
    refineShip: vi.fn(),
    getMarket: vi.fn(),
    getShipyard: vi.fn(),
    listWaypoints: vi.fn(),
    listMyShips: vi.fn(),
    listMyContracts: vi.fn(),
    deliverContractCargo: vi.fn(),
    fulfillContract: vi.fn(),
    purchaseShip: vi.fn(),
  },
}));

import { api } from '../services/api';

import * as surveyCache from '../utils/surveyCache';

vi.mock('../utils/surveyCache', () => ({
  getSurveys: vi.fn().mockReturnValue([]),
  setSurveys: vi.fn(),
  addSurveys: vi.fn(),
  removeSurvey: vi.fn(),
}));

function mockUseAuth(overrides: Partial<ReturnType<typeof AuthModule.useAuth>> = {}) {
  return {
    token: 'tok',
    agent: { symbol: 'PILOT', headquarters: 'X1-HQ', credits: 50000, startingFaction: 'COSMIC', shipCount: 2 },
    loading: false,
    error: null,
    isAccountToken: false,
    loginWithAccountToken: vi.fn(),
    loginWithAgentToken: vi.fn(),
    loginSavedAgent: vi.fn(),
    disconnectAgent: vi.fn(),
    logout: vi.fn(),
    setAgent: vi.fn(),
    setAgentToken: vi.fn(),
    savedAgents: [],
    deleteSavedAgent: vi.fn(),
    ...overrides,
  };
}

const defaultWaypoints = [
  mockWaypoint({ symbol: 'X1-TEST-A1', type: 'PLANET', traits: [
    { symbol: 'MARKETPLACE', name: 'Marketplace', description: '' },
    { symbol: 'SHIPYARD', name: 'Shipyard', description: '' },
  ] }),
  mockWaypoint({ symbol: 'X1-TEST-B1', type: 'MOON', x: 100, y: 50, traits: [] }),
];

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

function setupMocks() {
  vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
  vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: defaultWaypoints, isLoading: false } as any);
  vi.spyOn(useQueriesModule, 'useMarket').mockReturnValue({ data: null, isLoading: false, refetch: vi.fn() } as any);
  vi.spyOn(useQueriesModule, 'useShipyard').mockReturnValue({ data: null, isLoading: false } as any);
  vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({ data: [], isLoading: false } as any);
  // Re-configure survey cache mock (vi.restoreAllMocks clears mockReturnValue)
  vi.mocked(surveyCache.getSurveys).mockReturnValue([]);
  vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({ data: [], isLoading: false } as any);
  vi.spyOn(useQueriesModule, 'useShipCooldown').mockReturnValue({
    cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 0, remainingSeconds: 0 },
    setCooldown: vi.fn(),
    isOnCooldown: false,
  } as any);
}

describe('FlightControl', () => {
  const onShipUpdate = vi.fn();

  beforeEach(() => {
    onShipUpdate.mockClear();
    setupMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders ship header with details', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText('SHIP-1')).toBeInTheDocument();
    expect(screen.getAllByText(/COMMAND/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/IN ORBIT/)).toBeInTheDocument();
  });

  it('shows Details tab by default', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    // Details tab shows frame, reactor, engine info
    expect(screen.getByText(/Frame — Frigate/)).toBeInTheDocument();
    expect(screen.getByText(/Reactor — Solar Reactor/)).toBeInTheDocument();
    expect(screen.getByText(/Engine — Impulse Drive/)).toBeInTheDocument();
  });

  it('shows ship modules and mounts in details', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText('Cargo Hold')).toBeInTheDocument();
    expect(screen.getByText('Mining Laser')).toBeInTheDocument();
  });

  it('shows cargo in details panel', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText('Iron Ore')).toBeInTheDocument();
    expect(screen.getByText('×5')).toBeInTheDocument();
  });

  it('shows empty cargo hint when cargo is empty', () => {
    const ship = mockShip({ cargo: { capacity: 40, units: 0, inventory: [] } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText('Cargo hold is empty.')).toBeInTheDocument();
  });

  it('switches to Navigation tab', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));

    expect(screen.getByText('Orbit')).toBeInTheDocument();
    expect(screen.getByText('Dock')).toBeInTheDocument();
    expect(screen.getByText('Refuel')).toBeInTheDocument();
    expect(screen.getByText('Flight Mode')).toBeInTheDocument();
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Go')).toBeInTheDocument();
  });

  it('shows transit info for in-transit ship', () => {
    const ship = mockShipInTransit();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    expect(screen.getByText(/En route to/)).toBeInTheDocument();
  });

  it('disables navigation buttons appropriately', () => {
    // Ship in orbit: Orbit disabled, Dock enabled
    const ship = mockShip({ nav: { ...mockShip().nav, status: 'IN_ORBIT' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    expect(screen.getByText('Orbit')).toBeDisabled();
    expect(screen.getByText('Dock')).not.toBeDisabled();
    expect(screen.getByText('Refuel')).toBeDisabled(); // only enabled when docked
  });

  it('enables refuel when docked', () => {
    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    expect(screen.getByText('Dock')).toBeDisabled();
    expect(screen.getByText('Orbit')).not.toBeDisabled();
    expect(screen.getByText('Refuel')).not.toBeDisabled();
  });

  it('switches to Scan tab', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Scan'));

    expect(screen.getByText('Scan Waypoints')).toBeInTheDocument();
    expect(screen.getByText('Scan Ships')).toBeInTheDocument();
    expect(screen.getByText('Scan Systems')).toBeInTheDocument();
  });

  it('shows scan hint when not in orbit', () => {
    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Scan'));
    expect(screen.getByText('Ship must be in orbit to scan.')).toBeInTheDocument();
  });

  it('shows Extract tab when ship has mining mount', () => {
    const ship = mockShip({
      mounts: [{ symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser I', strength: 10 }],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText('Extract')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Extract'));

    expect(screen.getByText('Mine / Extract')).toBeInTheDocument();
  });

  it('shows siphon button when ship has siphon mount', () => {
    const ship = mockShip({
      mounts: [
        { symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser', strength: 10 },
        { symbol: 'MOUNT_GAS_SIPHON_I', name: 'Gas Siphon I', strength: 5 },
      ],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Extract'));
    expect(screen.getByText('Siphon')).toBeInTheDocument();
  });

  it('hides Extract tab when ship has no mining/siphon mounts', () => {
    const ship = mockShip({
      mounts: [{ symbol: 'MOUNT_TURRET_I', name: 'Turret', strength: 5 }],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.queryByText('Extract')).not.toBeInTheDocument();
  });

  it('switches to Cargo tab', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    // Multiple buttons say 'Cargo' (tab + section title)
    const cargoButtons = screen.getAllByText('Cargo');
    fireEvent.click(cargoButtons[0]);

    // Cargo panel shows items with sell/jettison buttons
    expect(screen.getAllByText('Iron Ore').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to Market tab', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Market'));
    // Market tab renders (content depends on market data)
    expect(document.querySelector('.fc-panel')).toBeInTheDocument();
  });

  it('shows Shipyard tab when waypoint has SHIPYARD trait', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText('Shipyard')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Shipyard'));
    expect(document.querySelector('.fc-panel')).toBeInTheDocument();
  });

  it('hides Shipyard tab when waypoint lacks SHIPYARD trait', () => {
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({
      data: [mockWaypoint({ symbol: 'X1-TEST-A1', traits: [] })],
      isLoading: false,
    } as any);

    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.queryByText('Shipyard')).not.toBeInTheDocument();
  });

  it('shows cooldown bar when on cooldown', () => {
    vi.spyOn(useQueriesModule, 'useShipCooldown').mockReturnValue({
      cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 60, remainingSeconds: 30 },
      setCooldown: vi.fn(),
      isOnCooldown: true,
    } as any);

    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText(/COOLDOWN/)).toBeInTheDocument();
  });

  it('shows flight mode buttons in nav tab', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));

    expect(screen.getByText('DRIFT')).toBeInTheDocument();
    expect(screen.getByText('STEALTH')).toBeInTheDocument();
    expect(screen.getByText('CRUISE')).toBeInTheDocument();
    expect(screen.getByText('BURN')).toBeInTheDocument();
  });

  it('shows destination selector with waypoints', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));

    const select = document.querySelector('.fc-select') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // Should have waypoint options
    expect(select.innerHTML).toContain('X1-TEST-B1');
  });

  it('renders registration info in details', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText('COSMIC')).toBeInTheDocument();
  });

  it('shows extract hint when not in orbit', () => {
    const ship = mockShip({
      nav: { ...mockShip().nav, status: 'DOCKED' },
      mounts: [{ symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser', strength: 10 }],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Extract'));
    expect(screen.getByText('Ship must be in orbit to extract.')).toBeInTheDocument();
  });

  it('show EN ROUTE status for in-transit ship', () => {
    const ship = mockShipInTransit();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText('EN ROUTE')).toBeInTheDocument();
  });

  it('shows crew info in details', () => {
    const ship = mockShip({ crew: { current: 15, capacity: 30, required: 10, morale: 90 } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.getByText('15 / 30')).toBeInTheDocument();
    expect(screen.getAllByText('90%').length).toBeGreaterThanOrEqual(1);
  });

  it('shows market overview when market data has no tradeGoods', () => {
    vi.spyOn(useQueriesModule, 'useMarket').mockReturnValue({
      data: {
        symbol: 'X1-TEST-A1',
        exports: [{ symbol: 'IRON', name: 'Iron' }],
        imports: [{ symbol: 'FOOD', name: 'Food' }],
        exchange: [{ symbol: 'FUEL', name: 'Fuel' }],
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Market'));
    expect(screen.getByText('Market Overview')).toBeInTheDocument();
    expect(screen.getByText('Exports')).toBeInTheDocument();
    expect(screen.getByText('Imports')).toBeInTheDocument();
    expect(screen.getByText('Exchange')).toBeInTheDocument();
  });

  it('shows trade goods table when market has tradeGoods', () => {
    vi.spyOn(useQueriesModule, 'useMarket').mockReturnValue({
      data: {
        symbol: 'X1-TEST-A1',
        exports: [],
        imports: [],
        exchange: [],
        tradeGoods: [{
          symbol: 'IRON',
          type: 'EXPORT',
          tradeVolume: 100,
          supply: 'ABUNDANT',
          purchasePrice: 50,
          sellPrice: 45,
        }],
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Market'));
    expect(screen.getByText('Trade Goods')).toBeInTheDocument();
    expect(screen.getByText('IRON')).toBeInTheDocument();
    expect(screen.getByText('ABUNDANT')).toBeInTheDocument();
    expect(screen.getAllByText('Buy').length).toBeGreaterThanOrEqual(1);
  });

  it('shows market loading', () => {
    vi.spyOn(useQueriesModule, 'useMarket').mockReturnValue({
      data: null,
      isLoading: true,
      refetch: vi.fn(),
    } as any);

    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Market'));
    expect(screen.getByText('Loading market…')).toBeInTheDocument();
  });

  it('shows dock notice in market when not docked', () => {
    vi.spyOn(useQueriesModule, 'useMarket').mockReturnValue({
      data: { symbol: 'X1', exports: [], imports: [], exchange: [], tradeGoods: [{ symbol: 'X', type: 'E', tradeVolume: 1, supply: 'A', purchasePrice: 1, sellPrice: 1 }] },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const ship = mockShip({ nav: { ...mockShip().nav, status: 'IN_ORBIT' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Market'));
    expect(screen.getByText('Dock at this waypoint to buy and sell goods.')).toBeInTheDocument();
  });

  it('shows shipyard with ships for sale', () => {
    vi.spyOn(useQueriesModule, 'useShipyard').mockReturnValue({
      data: {
        symbol: 'X1-TEST-A1',
        shipTypes: [{ type: 'SHIP_MINING_DRONE' }],
        ships: [{
          type: 'SHIP_MINING_DRONE',
          name: 'Mining Drone',
          description: 'A small mining vessel',
          supply: 'MODERATE',
          purchasePrice: 20000,
          frame: { symbol: 'F', name: 'Drone Frame', condition: 1, integrity: 1, fuelCapacity: 100, moduleSlots: 2, mountingPoints: 1 },
          reactor: { symbol: 'R', name: 'Basic Reactor', condition: 1, integrity: 1, powerOutput: 5 },
          engine: { symbol: 'E', name: 'Ion Engine', condition: 1, integrity: 1, speed: 10 },
          modules: [{ symbol: 'M', name: 'Cargo Module' }],
          mounts: [{ symbol: 'MOUNT_MINING', name: 'Mining Laser' }],
          crew: { required: 1, capacity: 2 },
        }],
        modificationsFee: 5000,
      },
      isLoading: false,
    } as any);

    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Shipyard'));
    expect(screen.getByText('Mining Drone')).toBeInTheDocument();
    expect(screen.getByText('MODERATE')).toBeInTheDocument();
    expect(screen.getByText('¢20,000')).toBeInTheDocument();
  });

  it('shows shipyard loading', () => {
    vi.spyOn(useQueriesModule, 'useShipyard').mockReturnValue({
      data: null,
      isLoading: true,
    } as any);

    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Shipyard'));
    expect(screen.getByText('Loading shipyard…')).toBeInTheDocument();
  });

  it('shows empty shipyard message', () => {
    vi.spyOn(useQueriesModule, 'useShipyard').mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Not found'),
    } as any);

    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Shipyard'));
    expect(screen.getByText('No shipyard at this waypoint.')).toBeInTheDocument();
  });

  it('shows cargo panel with sell and jettison buttons', () => {
    const ship = mockShip({
      nav: { ...mockShip().nav, status: 'DOCKED' },
      cargo: {
        capacity: 40,
        units: 10,
        inventory: [
          { symbol: 'IRON_ORE', name: 'Iron Ore', units: 10 },
        ],
      },
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    const cargoBtns = screen.getAllByText('Cargo');
    fireEvent.click(cargoBtns[0]);

    expect(screen.getAllByText('Iron Ore').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Sell All')).toBeInTheDocument();
    expect(screen.getByText('Jettison')).toBeInTheDocument();
  });

  it('shows empty cargo in cargo panel', () => {
    const ship = mockShip({
      cargo: { capacity: 40, units: 0, inventory: [] },
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    const cargoBtns = screen.getAllByText('Cargo');
    fireEvent.click(cargoBtns[0]);

    expect(screen.getAllByText('Cargo hold is empty.').length).toBeGreaterThanOrEqual(1);
  });

  it('shows fuel bar with deduction preview', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    // Fuel bar should show current/capacity
    expect(screen.getByText(/FUEL 400\/600/)).toBeInTheDocument();
  });

  it('renders survey button when ship has surveyor mount', () => {
    const ship = mockShip({
      mounts: [
        { symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser', strength: 10 },
        { symbol: 'MOUNT_SURVEYOR_I', name: 'Surveyor', strength: 5 },
      ],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Extract'));
    expect(screen.getByText('Survey')).toBeInTheDocument();
  });

  it('shows condition classes based on values', () => {
    const ship = mockShip({
      frame: { symbol: 'F', name: 'Frame', condition: 0.3, integrity: 0.3 },
      reactor: { symbol: 'R', name: 'Reactor', condition: 0.5, integrity: 0.5, powerOutput: 10 },
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    // Low conditions should show bad/warn classes
    const badElements = document.querySelectorAll('.fc-cond--bad');
    expect(badElements.length).toBeGreaterThanOrEqual(1);
  });

  it('shows no modules section when ship has no modules', () => {
    const ship = mockShip({ modules: [] });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.queryByText('Modules')).not.toBeInTheDocument();
  });

  it('shows no mounts section when ship has no mounts', () => {
    const ship = mockShip({ mounts: [] });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    expect(screen.queryByText('Mounts')).not.toBeInTheDocument();
  });

  // ── Navigation Handler Tests ──

  it('calls orbitShip when Orbit is clicked', async () => {
    vi.mocked(api.orbitShip).mockResolvedValue({ nav: { ...mockShip().nav, status: 'IN_ORBIT' } });
    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    fireEvent.click(screen.getByText('Orbit'));

    await waitFor(() => {
      expect(api.orbitShip).toHaveBeenCalledWith('SHIP-1');
    });
  });

  it('calls dockShip when Dock is clicked', async () => {
    vi.mocked(api.dockShip).mockResolvedValue({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    const ship = mockShip({ nav: { ...mockShip().nav, status: 'IN_ORBIT' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    fireEvent.click(screen.getByText('Dock'));

    await waitFor(() => {
      expect(api.dockShip).toHaveBeenCalledWith('SHIP-1');
    });
  });

  it('calls refuelShip when Refuel is clicked', async () => {
    vi.mocked(api.refuelShip).mockResolvedValue({
      fuel: { current: 600, capacity: 600, consumed: { amount: 0, timestamp: '' } },
      agent: { symbol: 'PILOT', headquarters: 'X1-HQ', credits: 49000, startingFaction: 'COSMIC', shipCount: 2 },
      transaction: { totalPrice: 1000, waypointSymbol: 'X1-TEST-A1', shipSymbol: 'SHIP-1', tradeSymbol: 'FUEL', type: 'PURCHASE', units: 200, pricePerUnit: 5, timestamp: '' },
    });
    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    fireEvent.click(screen.getByText('Refuel'));

    await waitFor(() => {
      expect(api.refuelShip).toHaveBeenCalledWith('SHIP-1');
    });
  });

  it('calls setFlightMode when flight mode button clicked', async () => {
    vi.mocked(api.setFlightMode).mockResolvedValue({ nav: { ...mockShip().nav, flightMode: 'BURN' } });
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    fireEvent.click(screen.getByText('BURN'));

    await waitFor(() => {
      expect(api.setFlightMode).toHaveBeenCalledWith('SHIP-1', 'BURN');
    });
  });

  it('calls navigateShip when Go is clicked with destination', async () => {
    vi.mocked(api.navigateShip).mockResolvedValue({
      nav: { ...mockShip().nav, status: 'IN_TRANSIT' },
      fuel: { current: 350, capacity: 600, consumed: { amount: 50, timestamp: '' } },
    });
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    const select = document.querySelector('.fc-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'X1-TEST-B1' } });
    fireEvent.click(screen.getByText('Go'));

    await waitFor(() => {
      expect(api.navigateShip).toHaveBeenCalledWith('SHIP-1', 'X1-TEST-B1');
    });
  });

  it('shows travel estimates when destination selected', () => {
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    const select = document.querySelector('.fc-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'X1-TEST-B1' } });

    expect(screen.getByText(/Distance/)).toBeInTheDocument();
    expect(screen.getByText(/Est\. Time/)).toBeInTheDocument();
    expect(screen.getByText(/Est\. Fuel/)).toBeInTheDocument();
  });

  it('flashes error when orbit fails', async () => {
    vi.mocked(api.orbitShip).mockRejectedValue(new Error('Cannot orbit'));
    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    fireEvent.click(screen.getByText('Orbit'));

    await waitFor(() => {
      expect(screen.getByText('Cannot orbit')).toBeInTheDocument();
    });
  });

  // ── Scan Handler Tests ──

  it('scans waypoints and renders results', async () => {
    vi.mocked(api.scanWaypoints).mockResolvedValue({
      cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 60, remainingSeconds: 60, expiration: '' },
      waypoints: [{
        symbol: 'X1-TEST-C1',
        type: 'ASTEROID',
        x: 200,
        y: 100,
        traits: [{ symbol: 'MINERAL_DEPOSITS', name: 'Mineral Deposits', description: '' }],
        orbitals: [],
      }],
    });
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Scan'));
    fireEvent.click(screen.getByText('Scan Waypoints'));

    await waitFor(() => {
      expect(screen.getByText('X1-TEST-C1')).toBeInTheDocument();
      expect(screen.getByText('ASTEROID')).toBeInTheDocument();
      expect(screen.getByText('Mineral Deposits')).toBeInTheDocument();
    });
  });

  it('scans ships and renders results', async () => {
    vi.mocked(api.scanShips).mockResolvedValue({
      cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 60, remainingSeconds: 60, expiration: '' },
      ships: [{
        symbol: 'ENEMY-1',
        registration: { name: 'ENEMY-1', factionSymbol: 'PIRATES', role: 'PATROL' },
        nav: { systemSymbol: 'X1-TEST', waypointSymbol: 'X1-TEST-A1', route: { origin: { symbol: 'X1-TEST-A1', type: '' }, destination: { symbol: 'X1-TEST-A1', type: '' }, departureTime: '', arrival: '' }, status: 'IN_ORBIT', flightMode: 'CRUISE' },
        frame: { symbol: 'F', name: 'Frame' },
        reactor: { symbol: 'R', name: 'Reactor' },
        engine: { symbol: 'E', name: 'Engine' },
        mounts: [],
      }],
    });
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Scan'));
    fireEvent.click(screen.getByText('Scan Ships'));

    await waitFor(() => {
      expect(screen.getByText('ENEMY-1')).toBeInTheDocument();
      expect(screen.getByText(/PATROL/)).toBeInTheDocument();
    });
  });

  it('scans systems and renders results', async () => {
    vi.mocked(api.scanSystems).mockResolvedValue({
      cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 60, remainingSeconds: 60, expiration: '' },
      systems: [{
        symbol: 'X1-OTHER',
        sectorSymbol: 'X1',
        type: 'RED_STAR',
        x: 500,
        y: 300,
        distance: 200,
      }],
    });
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Scan'));
    fireEvent.click(screen.getByText('Scan Systems'));

    await waitFor(() => {
      expect(screen.getByText('X1-OTHER')).toBeInTheDocument();
      expect(screen.getByText(/RED_STAR/)).toBeInTheDocument();
      expect(screen.getByText(/200 dist/)).toBeInTheDocument();
    });
  });

  it('flashes error on scan failure', async () => {
    vi.mocked(api.scanWaypoints).mockRejectedValue(new Error('Scan blocked'));
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Scan'));
    fireEvent.click(screen.getByText('Scan Waypoints'));

    await waitFor(() => {
      expect(screen.getByText('Scan blocked')).toBeInTheDocument();
    });
  });

  // ── Extract Handler Tests ──

  it('extracts resources when Mine/Extract clicked', async () => {
    vi.mocked(api.extractResources).mockResolvedValue({
      cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 70, remainingSeconds: 70, expiration: '' },
      extraction: { shipSymbol: 'SHIP-1', yield: { symbol: 'IRON_ORE', units: 3 } },
      cargo: { capacity: 40, units: 8, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', units: 8 }] },
    });
    const ship = mockShip({
      mounts: [{ symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser', strength: 10 }],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Extract'));
    fireEvent.click(screen.getByText('Mine / Extract'));

    await waitFor(() => {
      expect(api.extractResources).toHaveBeenCalledWith('SHIP-1');
      expect(screen.getByText(/Extracted 3 IRON_ORE/)).toBeInTheDocument();
    });
  });

  it('siphons resources when Siphon clicked', async () => {
    vi.mocked(api.siphonResources).mockResolvedValue({
      cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 70, remainingSeconds: 70, expiration: '' },
      siphon: { shipSymbol: 'SHIP-1', yield: { symbol: 'LIQUID_HYDROGEN', units: 5 } },
      cargo: { capacity: 40, units: 10, inventory: [{ symbol: 'LIQUID_HYDROGEN', name: 'Liquid Hydrogen', units: 10 }] },
    });
    const ship = mockShip({
      mounts: [
        { symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser', strength: 10 },
        { symbol: 'MOUNT_GAS_SIPHON_I', name: 'Gas Siphon I', strength: 5 },
      ],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Extract'));
    fireEvent.click(screen.getByText('Siphon'));

    await waitFor(() => {
      expect(api.siphonResources).toHaveBeenCalledWith('SHIP-1');
      expect(screen.getByText(/Siphoned 5 LIQUID_HYDROGEN/)).toBeInTheDocument();
    });
  });

  it('performs survey and shows results', async () => {
    const futureExpiry = new Date(Date.now() + 300_000).toISOString();
    vi.mocked(api.surveyWaypoint).mockResolvedValue({
      cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 70, remainingSeconds: 70, expiration: '' },
      surveys: [{
        signature: 'survey-123',
        symbol: 'X1-TEST-A1',
        deposits: [{ symbol: 'IRON_ORE' }, { symbol: 'IRON_ORE' }, { symbol: 'COPPER_ORE' }],
        expiration: futureExpiry,
        size: 'LARGE',
      }],
    });
    const ship = mockShip({
      mounts: [
        { symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser', strength: 10 },
        { symbol: 'MOUNT_SURVEYOR_I', name: 'Surveyor', strength: 5 },
      ],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Extract'));
    fireEvent.click(screen.getByText('Survey'));

    await waitFor(() => {
      expect(api.surveyWaypoint).toHaveBeenCalledWith('SHIP-1');
      expect(screen.getByText('LARGE')).toBeInTheDocument();
      expect(screen.getByText('IRON_ORE')).toBeInTheDocument();
      expect(screen.getByText('×2')).toBeInTheDocument();
      expect(screen.getByText('COPPER_ORE')).toBeInTheDocument();
    });
  });

  it('toggles auto-mine on and off', async () => {
    vi.mocked(api.extractResources).mockResolvedValue({
      cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 70, remainingSeconds: 70, expiration: '' },
      extraction: { shipSymbol: 'SHIP-1', yield: { symbol: 'IRON_ORE', units: 2 } },
      cargo: { capacity: 40, units: 7, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', units: 7 }] },
    });
    const ship = mockShip({
      mounts: [{ symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser', strength: 10 }],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Extract'));

    // Click the Auto button next to Mine/Extract
    const autoButtons = screen.getAllByText('Auto');
    fireEvent.click(autoButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Auto-mine active/)).toBeInTheDocument();
    });

    // Click Auto again to turn off
    fireEvent.click(autoButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Auto-extract off')).toBeInTheDocument();
    });
  });

  it('shows extract error flash on failure', async () => {
    vi.mocked(api.extractResources).mockRejectedValue(new Error('Asteroid depleted'));
    const ship = mockShip({
      mounts: [{ symbol: 'MOUNT_MINING_LASER_I', name: 'Mining Laser', strength: 10 }],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Extract'));
    fireEvent.click(screen.getByText('Mine / Extract'));

    await waitFor(() => {
      expect(screen.getByText('Asteroid depleted')).toBeInTheDocument();
    });
  });

  // ── Cargo Handler Tests ──

  it('sells cargo via Cargo panel', async () => {
    vi.mocked(api.sellCargo).mockResolvedValue({
      cargo: { capacity: 40, units: 0, inventory: [] },
      agent: { symbol: 'PILOT', headquarters: 'X1-HQ', credits: 55000, startingFaction: 'COSMIC', shipCount: 2 },
      transaction: { totalPrice: 5000, waypointSymbol: 'X1-TEST-A1', shipSymbol: 'SHIP-1', tradeSymbol: 'IRON_ORE', type: 'SELL', units: 10, pricePerUnit: 500, timestamp: '' },
    });
    const ship = mockShip({
      nav: { ...mockShip().nav, status: 'DOCKED' },
      cargo: { capacity: 40, units: 10, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', units: 10 }] },
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    const cargoBtns = screen.getAllByText('Cargo');
    fireEvent.click(cargoBtns[0]);
    fireEvent.click(screen.getByText('Sell All'));

    await waitFor(() => {
      expect(api.sellCargo).toHaveBeenCalledWith('SHIP-1', 'IRON_ORE', 10);
      expect(screen.getByText(/Sold 10 IRON_ORE/)).toBeInTheDocument();
    });
  });

  it('jettisons cargo via Cargo panel', async () => {
    vi.mocked(api.jettisonCargo).mockResolvedValue({
      cargo: { capacity: 40, units: 0, inventory: [] },
    });
    const ship = mockShip({
      cargo: { capacity: 40, units: 5, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', units: 5 }] },
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    const cargoBtns = screen.getAllByText('Cargo');
    fireEvent.click(cargoBtns[0]);
    fireEvent.click(screen.getByText('Jettison'));

    await waitFor(() => {
      expect(api.jettisonCargo).toHaveBeenCalledWith('SHIP-1', 'IRON_ORE', 5);
      expect(screen.getByText(/Jettisoned 5 IRON_ORE/)).toBeInTheDocument();
    });
  });

  it('transfers cargo to nearby ship', async () => {
    vi.mocked(api.transferCargo).mockResolvedValue({
      cargo: { capacity: 40, units: 0, inventory: [] },
    });
    const ship = mockShip({
      cargo: { capacity: 40, units: 5, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', units: 5 }] },
    });
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: [ship, mockShip({ symbol: 'SHIP-2', nav: { ...mockShip().nav, waypointSymbol: 'X1-TEST-A1' } })],
      isLoading: false,
    } as any);

    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    const cargoBtns = screen.getAllByText('Cargo');
    fireEvent.click(cargoBtns[0]);

    // Select transfer target
    const transferSelect = document.querySelector('.fc-cargo-transfer-select') as HTMLSelectElement;
    fireEvent.change(transferSelect, { target: { value: 'SHIP-2' } });

    fireEvent.click(screen.getByText('Transfer'));

    await waitFor(() => {
      expect(api.transferCargo).toHaveBeenCalledWith('SHIP-1', 'SHIP-2', 'IRON_ORE', 5);
      expect(screen.getByText(/Transferred 5 IRON_ORE → SHIP-2/)).toBeInTheDocument();
    });
  });

  it('delivers cargo to a contract', async () => {
    vi.mocked(api.deliverContractCargo).mockResolvedValue({
      cargo: { capacity: 40, units: 0, inventory: [] },
      contract: {
        id: 'c1',
        factionSymbol: 'COSMIC',
        type: 'PROCUREMENT',
        accepted: true,
        fulfilled: false,
        terms: {
          deadline: new Date(Date.now() + 86400_000).toISOString(),
          payment: { onAccepted: 1000, onFulfilled: 5000 },
          deliver: [{ tradeSymbol: 'IRON_ORE', destinationSymbol: 'X1-TEST-A1', unitsRequired: 10, unitsFulfilled: 10 }],
        },
        deadlineToAccept: new Date(Date.now() + 86400_000).toISOString(),
        expiration: new Date(Date.now() + 86400_000).toISOString(),
      },
    });
    vi.mocked(api.fulfillContract).mockResolvedValue({
      contract: {} as any,
      agent: { symbol: 'PILOT', headquarters: 'X1-HQ', credits: 55000, startingFaction: 'COSMIC', shipCount: 2 },
    });

    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: [{
        id: 'c1',
        factionSymbol: 'COSMIC',
        type: 'PROCUREMENT',
        accepted: true,
        fulfilled: false,
        terms: {
          deadline: new Date(Date.now() + 86400_000).toISOString(),
          payment: { onAccepted: 1000, onFulfilled: 5000 },
          deliver: [{ tradeSymbol: 'IRON_ORE', destinationSymbol: 'X1-TEST-A1', unitsRequired: 10, unitsFulfilled: 0 }],
        },
        deadlineToAccept: new Date(Date.now() + 86400_000).toISOString(),
        expiration: new Date(Date.now() + 86400_000).toISOString(),
      }],
      isLoading: false,
    } as any);

    const ship = mockShip({
      nav: { ...mockShip().nav, status: 'DOCKED' },
      cargo: { capacity: 40, units: 10, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', units: 10 }] },
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    const cargoBtns = screen.getAllByText('Cargo');
    fireEvent.click(cargoBtns[0]);

    expect(screen.getByText('Contract deliveries available at this waypoint')).toBeInTheDocument();

    // Click deliver button
    fireEvent.click(screen.getByText(/Deliver 10/));

    await waitFor(() => {
      expect(api.deliverContractCargo).toHaveBeenCalledWith('c1', 'SHIP-1', 'IRON_ORE', 10);
    });

    // Should auto-fulfill since all deliveries complete
    await waitFor(() => {
      expect(api.fulfillContract).toHaveBeenCalledWith('c1');
    });
  });

  it('refines ore when Refine clicked', async () => {
    vi.mocked(api.refineShip).mockResolvedValue({
      cargo: { capacity: 40, units: 5, inventory: [{ symbol: 'IRON', name: 'Iron', units: 5 }] },
      cooldown: { shipSymbol: 'SHIP-1', totalSeconds: 60, remainingSeconds: 60, expiration: '' },
      produced: [{ tradeSymbol: 'IRON', units: 5 }],
      consumed: [{ tradeSymbol: 'IRON_ORE', units: 10 }],
    });
    const ship = mockShip({
      cargo: { capacity: 40, units: 10, inventory: [{ symbol: 'IRON_ORE', name: 'Iron Ore', units: 10 }] },
      modules: [{ symbol: 'MODULE_ORE_REFINERY', name: 'Ore Refinery' }],
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    const cargoBtns = screen.getAllByText('Cargo');
    fireEvent.click(cargoBtns[0]);
    fireEvent.click(screen.getByText('Refine'));

    await waitFor(() => {
      expect(api.refineShip).toHaveBeenCalledWith('SHIP-1', 'IRON');
      expect(screen.getByText(/Refined:.*\+5 IRON/)).toBeInTheDocument();
    });
  });

  // ── Market Handler Tests ──

  it('buys cargo from market', async () => {
    vi.mocked(api.purchaseCargo).mockResolvedValue({
      cargo: { capacity: 40, units: 1, inventory: [{ symbol: 'IRON', name: 'Iron', units: 1 }] },
      agent: { symbol: 'PILOT', headquarters: 'X1-HQ', credits: 49950, startingFaction: 'COSMIC', shipCount: 2 },
      transaction: { totalPrice: 50, waypointSymbol: 'X1-TEST-A1', shipSymbol: 'SHIP-1', tradeSymbol: 'IRON', type: 'PURCHASE', units: 1, pricePerUnit: 50, timestamp: '' },
    });
    vi.spyOn(useQueriesModule, 'useMarket').mockReturnValue({
      data: {
        symbol: 'X1-TEST-A1',
        exports: [],
        imports: [],
        exchange: [],
        tradeGoods: [{ symbol: 'IRON', type: 'EXPORT', tradeVolume: 100, supply: 'ABUNDANT', purchasePrice: 50, sellPrice: 45 }],
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Market'));

    // Find Buy buttons - use getAllByText since there may be multiple
    const buyBtns = screen.getAllByText('Buy');
    fireEvent.click(buyBtns[buyBtns.length - 1]); // The action button, not the header

    await waitFor(() => {
      expect(api.purchaseCargo).toHaveBeenCalledWith('SHIP-1', 'IRON', 1);
      expect(screen.getByText(/Bought 1 IRON/)).toBeInTheDocument();
    });
  });

  it('sells cargo from market panel', async () => {
    vi.mocked(api.sellCargo).mockResolvedValue({
      cargo: { capacity: 40, units: 0, inventory: [] },
      agent: { symbol: 'PILOT', headquarters: 'X1-HQ', credits: 50045, startingFaction: 'COSMIC', shipCount: 2 },
      transaction: { totalPrice: 45, waypointSymbol: 'X1-TEST-A1', shipSymbol: 'SHIP-1', tradeSymbol: 'IRON', type: 'SELL', units: 1, pricePerUnit: 45, timestamp: '' },
    });
    vi.spyOn(useQueriesModule, 'useMarket').mockReturnValue({
      data: {
        symbol: 'X1-TEST-A1',
        exports: [],
        imports: [],
        exchange: [],
        tradeGoods: [{ symbol: 'IRON', type: 'EXPORT', tradeVolume: 100, supply: 'ABUNDANT', purchasePrice: 50, sellPrice: 45 }],
      },
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const ship = mockShip({
      nav: { ...mockShip().nav, status: 'DOCKED' },
      cargo: { capacity: 40, units: 1, inventory: [{ symbol: 'IRON', name: 'Iron', units: 1 }] },
    });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Market'));
    fireEvent.click(screen.getByText(/Sell.*\(1\)/));

    await waitFor(() => {
      expect(api.sellCargo).toHaveBeenCalledWith('SHIP-1', 'IRON', 1);
      expect(screen.getByText(/Sold 1 IRON/)).toBeInTheDocument();
    });
  });

  // ── Shipyard Handler Tests ──

  it('expands and collapses shipyard card', () => {
    vi.spyOn(useQueriesModule, 'useShipyard').mockReturnValue({
      data: {
        symbol: 'X1-TEST-A1',
        shipTypes: [{ type: 'SHIP_MINING_DRONE' }],
        ships: [{
          type: 'SHIP_MINING_DRONE',
          name: 'Mining Drone',
          description: 'A small mining vessel',
          supply: 'MODERATE',
          purchasePrice: 20000,
          frame: { symbol: 'F', name: 'Drone Frame', condition: 1, integrity: 1, fuelCapacity: 100, moduleSlots: 2, mountingPoints: 1 },
          reactor: { symbol: 'R', name: 'Basic Reactor', condition: 1, integrity: 1, powerOutput: 5 },
          engine: { symbol: 'E', name: 'Ion Engine', condition: 1, integrity: 1, speed: 10 },
          modules: [{ symbol: 'M', name: 'Cargo Module' }],
          mounts: [{ symbol: 'MOUNT_MINING', name: 'Mining Laser' }],
          crew: { required: 1, capacity: 2 },
        }],
        modificationsFee: 5000,
      },
      isLoading: false,
    } as any);

    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Shipyard'));

    // Click card to expand
    fireEvent.click(screen.getByText('Mining Drone'));
    expect(screen.getByText('A small mining vessel')).toBeInTheDocument();
    expect(screen.getByText('Specifications')).toBeInTheDocument();
    expect(screen.getByText(/Buy for/)).toBeInTheDocument();

    // Click header again to collapse
    fireEvent.click(screen.getByText('Mining Drone'));
    expect(screen.queryByText('A small mining vessel')).not.toBeInTheDocument();
  });

  it('purchases ship from shipyard', async () => {
    vi.mocked(api.purchaseShip).mockResolvedValue({
      ship: mockShip({ symbol: 'NEW-SHIP-1' }),
      agent: { symbol: 'PILOT', headquarters: 'X1-HQ', credits: 30000, startingFaction: 'COSMIC', shipCount: 3 },
      transaction: { waypointSymbol: 'X1-TEST-A1', shipSymbol: 'SHIP-1', shipType: 'SHIP_MINING_DRONE', price: 20000, agentSymbol: 'PILOT', timestamp: '' },
    });

    vi.spyOn(useQueriesModule, 'useShipyard').mockReturnValue({
      data: {
        symbol: 'X1-TEST-A1',
        shipTypes: [{ type: 'SHIP_MINING_DRONE' }],
        ships: [{
          type: 'SHIP_MINING_DRONE',
          name: 'Mining Drone',
          description: 'A small mining vessel',
          supply: 'MODERATE',
          purchasePrice: 20000,
          frame: { symbol: 'F', name: 'Drone Frame', condition: 1, integrity: 1, fuelCapacity: 100, moduleSlots: 2, mountingPoints: 1 },
          reactor: { symbol: 'R', name: 'Basic Reactor', condition: 1, integrity: 1, powerOutput: 5 },
          engine: { symbol: 'E', name: 'Ion Engine', condition: 1, integrity: 1, speed: 10 },
          modules: [{ symbol: 'M', name: 'Cargo Module' }],
          mounts: [{ symbol: 'MOUNT_MINING', name: 'Mining Laser' }],
          crew: { required: 1, capacity: 2 },
        }],
        modificationsFee: 5000,
      },
      isLoading: false,
    } as any);

    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Shipyard'));
    // Expand the card
    fireEvent.click(screen.getByText('Mining Drone'));
    // Click buy button
    fireEvent.click(screen.getByText(/Buy for/));

    await waitFor(() => {
      expect(api.purchaseShip).toHaveBeenCalledWith('SHIP_MINING_DRONE', 'X1-TEST-A1');
      expect(screen.getByText(/Purchased NEW-SHIP-1/)).toBeInTheDocument();
    });
  });

  it('shows shipyard empty state with ship types when no ships and docked', () => {
    vi.spyOn(useQueriesModule, 'useShipyard').mockReturnValue({
      data: {
        symbol: 'X1-TEST-A1',
        shipTypes: [{ type: 'SHIP_PROBE' }, { type: 'SHIP_FRIGATE' }],
        ships: [],
        modificationsFee: 0,
      },
      isLoading: false,
    } as any);

    const ship = mockShip({ nav: { ...mockShip().nav, status: 'DOCKED' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Shipyard'));
    expect(screen.getByText('No ships currently available for purchase.')).toBeInTheDocument();
    expect(screen.getByText('Ship Types Available')).toBeInTheDocument();
    expect(screen.getByText('PROBE')).toBeInTheDocument();
    expect(screen.getByText('FRIGATE')).toBeInTheDocument();
  });

  it('shows dock notice in shipyard when in orbit', () => {
    vi.spyOn(useQueriesModule, 'useShipyard').mockReturnValue({
      data: {
        symbol: 'X1-TEST-A1',
        shipTypes: [],
        ships: [],
        modificationsFee: 0,
      },
      isLoading: false,
    } as any);

    const ship = mockShip({ nav: { ...mockShip().nav, status: 'IN_ORBIT' } });
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Shipyard'));
    expect(screen.getByText('Dock at this waypoint to browse ships.')).toBeInTheDocument();
  });

  it('shows market no-market hint when market data is null', () => {
    vi.spyOn(useQueriesModule, 'useMarket').mockReturnValue({
      data: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Market'));
    expect(screen.getByText('No market at this waypoint.')).toBeInTheDocument();
  });

  it('handles navigate error with in-transit message', async () => {
    vi.mocked(api.navigateShip).mockRejectedValue(
      new Error('Ship is currently in-transit from X1-TEST-A1 to X1-TEST-B1 and arrives in 45 seconds')
    );
    const ship = mockShip();
    render(<FlightControl ship={ship} onShipUpdate={onShipUpdate} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Navigation'));
    const select = document.querySelector('.fc-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'X1-TEST-B1' } });
    fireEvent.click(screen.getByText('Go'));

    await waitFor(() => {
      expect(onShipUpdate).toHaveBeenCalled();
      expect(screen.getByText(/already en route to X1-TEST-B1/)).toBeInTheDocument();
    });
  });
});
