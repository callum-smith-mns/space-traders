import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TradeRoutesWindow from '../components/TradeRoutesWindow';
import * as useQueriesModule from '../hooks/useQueries';
import { api } from '../services/api';
import { mockWaypoint } from './mocks';

vi.mock('../services/api', () => ({
  api: {
    getMarket: vi.fn(),
  },
}));

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('TradeRoutesWindow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows hint when no system is selected', () => {
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: undefined } as any);
    render(<TradeRoutesWindow />, { wrapper: createWrapper() });
    expect(screen.getByText('Select a ship to view system trade routes.')).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({
      data: [mockWaypoint({ traits: [{ symbol: 'MARKETPLACE', name: 'Marketplace', description: '' }] })],
    } as any);

    // The trade data query will be loading since marketWpSymbols has items but queryFn hasn't resolved
    render(<TradeRoutesWindow systemSymbol="X1-TEST" />, { wrapper: createWrapper() });
    // Shows loading spinner while fetching market data
    expect(screen.getByText('Scanning markets…')).toBeInTheDocument();
  });

  it('renders with system symbol and toggle buttons', () => {
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: [] } as any);
    render(<TradeRoutesWindow systemSymbol="X1-TEST" />, { wrapper: createWrapper() });
    expect(screen.getByText('System: X1-TEST')).toBeInTheDocument();
    expect(screen.getByText('Trade Routes')).toBeInTheDocument();
    // Markets button includes count
    expect(screen.getByText(/Markets/)).toBeInTheDocument();
  });

  it('toggles between routes and markets view', () => {
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: [] } as any);
    render(<TradeRoutesWindow systemSymbol="X1-TEST" />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByText(/Markets/));
    // Check that markets view toggle is active
    const marketsBtn = screen.getByText(/Markets/);
    expect(marketsBtn.className).toContain('tr-toggle-btn--active');
  });

  it('shows filter controls', () => {
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: [] } as any);
    render(<TradeRoutesWindow systemSymbol="X1-TEST" />, { wrapper: createWrapper() });
    expect(screen.getByText('Resource')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
  });

  it('shows no routes message when no data', () => {
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: [] } as any);
    render(<TradeRoutesWindow systemSymbol="X1-TEST" />, { wrapper: createWrapper() });
    expect(screen.getByText('No trade routes found in this system.')).toBeInTheDocument();
  });

  it('renders trade routes when market data is available', async () => {
    const waypoints = [
      mockWaypoint({
        symbol: 'X1-TEST-A1',
        traits: [{ symbol: 'MARKETPLACE', name: 'Marketplace', description: '' }],
      }),
      mockWaypoint({
        symbol: 'X1-TEST-B1',
        type: 'MOON',
        x: 50,
        y: 50,
        traits: [{ symbol: 'MARKETPLACE', name: 'Marketplace', description: '' }],
      }),
    ];
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: waypoints } as any);

    vi.mocked(api.getMarket).mockImplementation(async (_sys: string, wp: string) => {
      if (wp === 'X1-TEST-A1') {
        return {
          symbol: 'X1-TEST-A1',
          exports: [{ symbol: 'IRON', name: 'Iron' }],
          imports: [],
          exchange: [],
          tradeGoods: [{ symbol: 'IRON', type: 'EXPORT', tradeVolume: 100, supply: 'HIGH', purchasePrice: 50, sellPrice: 40 }],
        };
      }
      return {
        symbol: 'X1-TEST-B1',
        exports: [],
        imports: [{ symbol: 'IRON', name: 'Iron' }],
        exchange: [],
        tradeGoods: [{ symbol: 'IRON', type: 'IMPORT', tradeVolume: 100, supply: 'LOW', purchasePrice: 80, sellPrice: 70 }],
      };
    });

    render(<TradeRoutesWindow systemSymbol="X1-TEST" />, { wrapper: createWrapper() });

    // Wait for trade route card to appear
    await waitFor(() => {
      expect(document.querySelector('.tr-route-good')).toHaveTextContent('Iron');
    }, { timeout: 3000 });

    // Should show profit
    expect(screen.getByText(/\+¢/)).toBeInTheDocument();
  });

  it('shows markets view with exports/imports/exchange', async () => {
    const waypoints = [
      mockWaypoint({
        symbol: 'X1-TEST-A1',
        traits: [{ symbol: 'MARKETPLACE', name: 'Marketplace', description: '' }],
      }),
    ];
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: waypoints } as any);

    vi.mocked(api.getMarket).mockResolvedValue({
      symbol: 'X1-TEST-A1',
      exports: [{ symbol: 'IRON', name: 'Iron' }],
      imports: [{ symbol: 'FOOD', name: 'Food' }],
      exchange: [{ symbol: 'FUEL', name: 'Fuel' }],
    });

    render(<TradeRoutesWindow systemSymbol="X1-TEST" />, { wrapper: createWrapper() });

    // Switch to markets view
    await waitFor(() => {
      expect(screen.getByText(/Markets \(1\)/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Markets/));

    expect(screen.getByText('X1-TEST-A1')).toBeInTheDocument();
    expect(screen.getByText('EXP')).toBeInTheDocument();
    expect(screen.getByText('IMP')).toBeInTheDocument();
    expect(screen.getByText('XCH')).toBeInTheDocument();
  });

  it('filters routes by resource', async () => {
    const waypoints = [
      mockWaypoint({
        symbol: 'X1-TEST-A1',
        traits: [{ symbol: 'MARKETPLACE', name: 'Marketplace', description: '' }],
      }),
      mockWaypoint({
        symbol: 'X1-TEST-B1',
        type: 'MOON',
        traits: [{ symbol: 'MARKETPLACE', name: 'Marketplace', description: '' }],
      }),
    ];
    vi.spyOn(useQueriesModule, 'useWaypoints').mockReturnValue({ data: waypoints } as any);

    vi.mocked(api.getMarket).mockImplementation(async (_sys: string, wp: string) => {
      if (wp === 'X1-TEST-A1') {
        return {
          symbol: 'X1-TEST-A1',
          exports: [{ symbol: 'IRON', name: 'Iron' }, { symbol: 'GOLD', name: 'Gold' }],
          imports: [],
          exchange: [],
        };
      }
      return {
        symbol: 'X1-TEST-B1',
        exports: [],
        imports: [{ symbol: 'IRON', name: 'Iron' }, { symbol: 'GOLD', name: 'Gold' }],
        exchange: [],
      };
    });

    render(<TradeRoutesWindow systemSymbol="X1-TEST" />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(document.querySelector('.tr-route-good')).toHaveTextContent('Iron');
    });

    // Apply resource filter
    const resourceSelect = document.querySelector('.tr-filter-select') as HTMLSelectElement;
    fireEvent.change(resourceSelect, { target: { value: 'IRON' } });

    // Clear button should appear
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });
});
