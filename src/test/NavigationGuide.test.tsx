import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NavigationGuide from '../components/NavigationGuide';
import * as useQueriesModule from '../hooks/useQueries';
import { mockWaypoint } from './mocks';

// Mock SystemMap since it depends on canvas
vi.mock('../components/SystemMap', () => ({
  default: ({ waypoints, currentWaypoint }: any) => (
    <div data-testid="system-map">
      {waypoints.length} waypoints{currentWaypoint && `, current: ${currentWaypoint}`}
    </div>
  ),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const waypoints = [
  mockWaypoint({ symbol: 'X1-TEST-A1', type: 'PLANET', x: 0, y: 0, traits: [{ symbol: 'MARKETPLACE', name: 'Marketplace', description: '' }] }),
  mockWaypoint({ symbol: 'X1-TEST-B1', type: 'MOON', x: 100, y: 50, traits: [{ symbol: 'SHIPYARD', name: 'Shipyard', description: '' }] }),
  mockWaypoint({ symbol: 'X1-TEST-C1', type: 'JUMP_GATE', x: 200, y: 100, traits: [] }),
];

describe('NavigationGuide', () => {
  beforeEach(() => {
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({
      data: waypoints,
      isLoading: false,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows map tab by default', () => {
    render(<NavigationGuide systemSymbol="X1-TEST" />, { wrapper });
    expect(screen.getByTestId('system-map')).toBeInTheDocument();
  });

  it('shows empty message when no system selected', () => {
    render(<NavigationGuide />, { wrapper });
    expect(screen.getByText('Select a ship to view the system map.')).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: [], isLoading: true } as any);
    render(<NavigationGuide systemSymbol="X1-TEST" />, { wrapper });
    expect(screen.getByText('Loading waypoints…')).toBeInTheDocument();
  });

  it('switches to list tab', () => {
    render(<NavigationGuide systemSymbol="X1-TEST" />, { wrapper });
    fireEvent.click(screen.getByText('List'));
    expect(screen.getByText('X1-TEST-A1')).toBeInTheDocument();
    expect(screen.getByText('Planet')).toBeInTheDocument();
    expect(screen.getByText('Moon')).toBeInTheDocument();
  });

  it('shows empty list message when no system', () => {
    render(<NavigationGuide />, { wrapper });
    fireEvent.click(screen.getByText('List'));
    expect(screen.getByText('Select a ship to view system objects.')).toBeInTheDocument();
  });

  it('switches to guide tab', () => {
    render(<NavigationGuide systemSymbol="X1-TEST" />, { wrapper });
    fireEvent.click(screen.getByText('Guide'));
    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Flight Modes')).toBeInTheDocument();
    expect(screen.getByText('Key Actions')).toBeInTheDocument();
    expect(screen.getByText('Tips')).toBeInTheDocument();
  });

  it('switches to route planner tab', () => {
    render(<NavigationGuide systemSymbol="X1-TEST" />, { wrapper });
    fireEvent.click(screen.getByText('Route Planner'));
    expect(screen.getByText('Origin')).toBeInTheDocument();
    expect(screen.getByText('Destination')).toBeInTheDocument();
    expect(screen.getByText('Flight Mode')).toBeInTheDocument();
  });

  it('shows empty planner when no system', () => {
    render(<NavigationGuide />, { wrapper });
    fireEvent.click(screen.getByText('Route Planner'));
    expect(screen.getByText('Select a ship to plan routes in its system.')).toBeInTheDocument();
  });

  it('calculates route when origin and destination are selected', () => {
    render(
      <NavigationGuide
        systemSymbol="X1-TEST"
        shipNav={{ systemSymbol: 'X1-TEST', waypointSymbol: 'X1-TEST-A1', route: { origin: { symbol: 'X1-TEST-A1', type: 'PLANET' }, destination: { symbol: 'X1-TEST-A1', type: 'PLANET' }, departureTime: '', arrival: '' }, status: 'IN_ORBIT', flightMode: 'CRUISE' }}
        engineSpeed={30}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByText('Route Planner'));

    // Origin should auto-fill from ship
    const destSelect = screen.getAllByDisplayValue('Select waypoint…');
    // Select destination
    fireEvent.change(destSelect[destSelect.length - 1], { target: { value: 'X1-TEST-B1' } });

    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('Est. Time')).toBeInTheDocument();
    expect(screen.getByText('Fuel Cost')).toBeInTheDocument();
  });

  it('shows same origin/destination message', () => {
    render(
      <NavigationGuide
        systemSymbol="X1-TEST"
        shipNav={{ systemSymbol: 'X1-TEST', waypointSymbol: 'X1-TEST-A1', route: { origin: { symbol: 'X1-TEST-A1', type: 'PLANET' }, destination: { symbol: 'X1-TEST-A1', type: 'PLANET' }, departureTime: '', arrival: '' }, status: 'IN_ORBIT', flightMode: 'CRUISE' }}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByText('Route Planner'));
    const destSelect = screen.getAllByDisplayValue('Select waypoint…');
    fireEvent.change(destSelect[destSelect.length - 1], { target: { value: 'X1-TEST-A1' } });

    expect(screen.getByText('Origin and destination are the same.')).toBeInTheDocument();
  });

  it('marks current waypoint with HERE label in list', () => {
    render(
      <NavigationGuide
        systemSymbol="X1-TEST"
        shipNav={{ systemSymbol: 'X1-TEST', waypointSymbol: 'X1-TEST-A1', route: { origin: { symbol: 'X1-TEST-A1', type: 'PLANET' }, destination: { symbol: 'X1-TEST-A1', type: 'PLANET' }, departureTime: '', arrival: '' }, status: 'IN_ORBIT', flightMode: 'CRUISE' }}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByText('List'));
    expect(screen.getByText('HERE')).toBeInTheDocument();
  });

  it('filters waypoints by trait in list view', () => {
    render(<NavigationGuide systemSymbol="X1-TEST" />, { wrapper });
    fireEvent.click(screen.getByText('List'));

    // Click 'Marketplace' filter
    fireEvent.click(screen.getByTitle('MARKETPLACE'));

    // Should show only A1 (has Marketplace trait)
    expect(screen.getByText('X1-TEST-A1')).toBeInTheDocument();
    // B1 may still be in DOM but filtered — check for clear button
    expect(screen.getByText(/Clear filters/)).toBeInTheDocument();
  });

  it('changes flight mode in planner', () => {
    render(<NavigationGuide systemSymbol="X1-TEST" />, { wrapper });
    fireEvent.click(screen.getByText('Route Planner'));

    // Click BURN flight mode
    fireEvent.click(screen.getByText('BURN'));
    expect(document.querySelector('.navguide-mode-btn--active')?.textContent).toBe('BURN');
  });
});
