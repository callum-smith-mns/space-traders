import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ShipsWindow from '../components/ShipsWindow';
import * as useQueriesModule from '../hooks/useQueries';
import { mockShip, mockShipInTransit } from './mocks';

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('ShipsWindow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading spinner when loading', () => {
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<ShipsWindow />, { wrapper });
    expect(screen.getByText('Scanning fleet…')).toBeInTheDocument();
  });

  it('shows error message on error', () => {
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as any);

    render(<ShipsWindow />, { wrapper });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('shows empty message when no ships', () => {
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    render(<ShipsWindow />, { wrapper });
    expect(screen.getByText('No ships in fleet.')).toBeInTheDocument();
  });

  it('renders ship rows', () => {
    const ships = [
      mockShip({ symbol: 'SHIP-1' }),
      mockShip({ symbol: 'SHIP-2', nav: { ...mockShip().nav, status: 'DOCKED' } }),
    ];
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: ships,
      isLoading: false,
      error: null,
    } as any);

    render(<ShipsWindow />, { wrapper });
    expect(screen.getByText('SHIP-1')).toBeInTheDocument();
    expect(screen.getByText('SHIP-2')).toBeInTheDocument();
  });

  it('highlights the selected ship', () => {
    const ships = [mockShip({ symbol: 'SHIP-1' }), mockShip({ symbol: 'SHIP-2' })];
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: ships,
      isLoading: false,
      error: null,
    } as any);

    const { container } = render(<ShipsWindow selectedShip="SHIP-1" />, { wrapper });
    const selected = container.querySelector('.ship-row--selected');
    expect(selected).toBeInTheDocument();
    expect(selected?.textContent).toContain('SHIP-1');
  });

  it('calls onSelectShip when clicking a ship row', () => {
    const ships = [mockShip({ symbol: 'SHIP-1' })];
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: ships,
      isLoading: false,
      error: null,
    } as any);

    const onSelect = vi.fn();
    render(<ShipsWindow onSelectShip={onSelect} />, { wrapper });
    (screen.getByText('SHIP-1').closest('.ship-row') as HTMLElement)?.click();
    expect(onSelect).toHaveBeenCalledWith(ships[0]);
  });

  it('renders transit bar for in-transit ships', () => {
    const ships = [mockShipInTransit({ symbol: 'SHIP-TRANSIT' })];
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: ships,
      isLoading: false,
      error: null,
    } as any);

    const { container } = render(<ShipsWindow />, { wrapper });
    expect(screen.getByText('EN ROUTE')).toBeInTheDocument();
    expect(container.querySelector('.ship-transit')).toBeInTheDocument();
  });

  it('renders cooldown bar for ships with cooldown', () => {
    const future = new Date(Date.now() + 30_000).toISOString();
    const ships = [mockShip({
      symbol: 'SHIP-CD',
      cooldown: { shipSymbol: 'SHIP-CD', totalSeconds: 60, remainingSeconds: 30, expiration: future },
    })];
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: ships,
      isLoading: false,
      error: null,
    } as any);

    const { container } = render(<ShipsWindow />, { wrapper });
    expect(container.querySelector('.ship-cooldown')).toBeInTheDocument();
    expect(screen.getByText('COOLDOWN')).toBeInTheDocument();
  });

  it('shows fuel bar per ship', () => {
    const ships = [mockShip({ fuel: { current: 200, capacity: 600, consumed: { amount: 0, timestamp: '' } } })];
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: ships,
      isLoading: false,
      error: null,
    } as any);

    render(<ShipsWindow />, { wrapper });
    expect(screen.getByText('200/600')).toBeInTheDocument();
  });

  it('shows location or destination', () => {
    const orbiting = mockShip({ nav: { ...mockShip().nav, waypointSymbol: 'X1-SYS-WP', status: 'IN_ORBIT' } });
    const transit = mockShipInTransit();
    vi.spyOn(useQueriesModule, 'useShips').mockReturnValue({
      data: [orbiting, transit],
      isLoading: false,
      error: null,
    } as any);

    render(<ShipsWindow />, { wrapper });
    expect(screen.getByText('X1-SYS-WP')).toBeInTheDocument();
    // Transit destination text appears in both ship-location and transit bar
    expect(screen.getAllByText('→ X1-TEST-B2').length).toBeGreaterThanOrEqual(1);
  });
});
