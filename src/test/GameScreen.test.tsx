import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GameScreen from '../components/GameScreen';
import * as AuthModule from '../contexts/AuthContext';
import * as useQueriesModule from '../hooks/useQueries';

// Mock all child window components
vi.mock('../components/ShipsWindow', () => ({
  default: ({ selectedShip, onSelectShip }: any) => (
    <div data-testid="ships-window">
      {selectedShip && <span>Selected: {selectedShip}</span>}
      <button onClick={() => onSelectShip?.({ symbol: 'MOCK-SHIP', nav: { systemSymbol: 'X1-TEST', waypointSymbol: 'X1-TEST-A1' } })}>
        Select Ship
      </button>
    </div>
  ),
  shipIcon: 'ship.png',
}));

vi.mock('../components/FlightControl', () => ({
  default: ({ ship, onShipUpdate }: any) => (
    <div data-testid="flight-control">
      Ship: {ship.symbol}
      <button onClick={() => onShipUpdate({ ...ship, fuel: { current: 100, capacity: 600, consumed: { amount: 0, timestamp: '' } } })}>
        Update Ship
      </button>
    </div>
  ),
}));

vi.mock('../components/ContractsWindow', () => ({
  default: ({ selectedShipSymbol }: any) => (
    <div data-testid="contracts-window">{selectedShipSymbol || 'no ship'}</div>
  ),
}));

vi.mock('../components/TradeRoutesWindow', () => ({
  default: ({ systemSymbol }: any) => (
    <div data-testid="trade-routes">{systemSymbol || 'no system'}</div>
  ),
}));

vi.mock('../components/NavigationGuide', () => ({
  default: () => <div data-testid="nav-guide">Nav Guide</div>,
}));

vi.mock('../components/DraggableWindow', () => ({
  default: ({ title, children }: any) => (
    <div data-testid={`dw-${title.toLowerCase().replace(/[^a-z]/g, '-')}`}>
      <div className="dw-title">{title}</div>
      {children}
    </div>
  ),
  __esModule: true,
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

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('GameScreen', () => {
  const onBack = vi.fn();

  beforeEach(() => {
    onBack.mockClear();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    vi.spyOn(useQueriesModule, 'usePrefetchShipData').mockReturnValue(vi.fn());
    vi.spyOn(useQueriesModule, 'useShipArrivalWatcher').mockReturnValue(undefined as any);
    vi.spyOn(useQueriesModule, 'useShipFromCache').mockReturnValue(null);
    vi.spyOn(useQueriesModule, 'useUpdateShipCache').mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('renders top bar with agent info', () => {
    render(<GameScreen onBack={onBack} />, { wrapper: createWrapper() });
    expect(screen.getByText('PILOT')).toBeInTheDocument();
    expect(screen.getByText('COSMIC')).toBeInTheDocument();
    expect(screen.getByText('¢ 50,000')).toBeInTheDocument();
  });

  it('renders all five windows', () => {
    render(<GameScreen onBack={onBack} />, { wrapper: createWrapper() });
    expect(screen.getByTestId('ships-window')).toBeInTheDocument();
    expect(screen.getByTestId('trade-routes')).toBeInTheDocument();
    expect(screen.getByTestId('contracts-window')).toBeInTheDocument();
    expect(screen.getByTestId('nav-guide')).toBeInTheDocument();
  });

  it('shows empty flight control when no ship selected', () => {
    render(<GameScreen onBack={onBack} />, { wrapper: createWrapper() });
    expect(screen.getByText('Select a ship from the fleet to begin.')).toBeInTheDocument();
  });

  it('calls onBack when Mission Control button clicked', () => {
    render(<GameScreen onBack={onBack} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Mission Control'));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls disconnectAgent when Switch Agent clicked', () => {
    const disconnectAgent = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ disconnectAgent }));
    render(<GameScreen onBack={onBack} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByText('Switch Agent'));
    expect(disconnectAgent).toHaveBeenCalled();
  });

  it('selects a ship and shows flight control', () => {
    const mockShip = {
      symbol: 'MOCK-SHIP',
      nav: { systemSymbol: 'X1-TEST', waypointSymbol: 'X1-TEST-A1', route: { origin: { symbol: 'X1-TEST-A1', type: 'PLANET' }, destination: { symbol: 'X1-TEST-A1', type: 'PLANET' }, departureTime: '', arrival: '' }, status: 'IN_ORBIT', flightMode: 'CRUISE' },
      fuel: { current: 400, capacity: 600, consumed: { amount: 0, timestamp: '' } },
      crew: { current: 10, capacity: 20, required: 5, morale: 80 },
      frame: { symbol: 'F', name: 'Frame', condition: 1, integrity: 1 },
      reactor: { symbol: 'R', name: 'Reactor', condition: 1, integrity: 1, powerOutput: 20 },
      engine: { symbol: 'E', name: 'Engine', condition: 1, integrity: 1, speed: 30 },
      modules: [],
      mounts: [],
      cargo: { capacity: 40, units: 0, inventory: [] },
      registration: { name: 'MOCK-SHIP', factionSymbol: 'COSMIC', role: 'COMMAND' },
    };

    vi.spyOn(useQueriesModule, 'useShipFromCache').mockReturnValue(mockShip as any);
    render(<GameScreen onBack={onBack} />, { wrapper: createWrapper() });

    // Flight control shows the ship
    expect(screen.getByTestId('flight-control')).toBeInTheDocument();
    expect(screen.getByText('Ship: MOCK-SHIP')).toBeInTheDocument();
  });

  it('resets windows when Reset Windows clicked', () => {
    // Store incomplete layouts to test reset
    localStorage.setItem('st-window-layouts', JSON.stringify({
      ships: { x: 999, y: 999, w: 100, h: 100 },
      trade: { x: 100, y: 100, w: 300, h: 300 },
      flight: { x: 200, y: 200, w: 400, h: 400 },
      contracts: { x: 300, y: 300, w: 300, h: 300 },
      navguide: { x: 400, y: 400, w: 300, h: 300 },
    }));
    render(<GameScreen onBack={onBack} />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText('Reset Windows'));
    expect(localStorage.getItem('st-window-layouts')).toBeNull();
  });
});
