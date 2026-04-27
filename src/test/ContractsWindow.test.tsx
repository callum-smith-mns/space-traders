import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContractsWindow from '../components/ContractsWindow';
import * as AuthModule from '../contexts/AuthContext';
import * as useQueriesModule from '../hooks/useQueries';
import { api } from '../services/api';
import { mockContract } from './mocks';

vi.mock('../services/api', () => ({
  api: {
    negotiateContract: vi.fn(),
    fulfillContract: vi.fn(),
  },
}));

function mockUseAuth(overrides: Partial<ReturnType<typeof AuthModule.useAuth>> = {}) {
  return {
    token: 'tok',
    agent: null,
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

describe('ContractsWindow', () => {
  beforeEach(() => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading spinner when loading', () => {
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<ContractsWindow />, { wrapper: createWrapper() });
    expect(screen.getByText('Scanning contracts…')).toBeInTheDocument();
  });

  it('shows error message on error', () => {
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<ContractsWindow />, { wrapper: createWrapper() });
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('shows empty state when no contracts', () => {
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<ContractsWindow />, { wrapper: createWrapper() });
    expect(screen.getByText('No contracts available.')).toBeInTheDocument();
  });

  it('shows negotiate button with selected ship in empty state', () => {
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<ContractsWindow selectedShipSymbol="SHIP-1" />, { wrapper: createWrapper() });
    expect(screen.getByText('Negotiate New Contract')).toBeInTheDocument();
  });

  it('renders contract rows', () => {
    const contracts = [
      mockContract({ id: 'c-1', type: 'PROCUREMENT', factionSymbol: 'COSMIC' }),
      mockContract({ id: 'c-2', type: 'TRANSPORT', factionSymbol: 'VOID', accepted: true }),
    ];
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: contracts,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<ContractsWindow />, { wrapper: createWrapper() });
    expect(screen.getByText('PROCUREMENT')).toBeInTheDocument();
    expect(screen.getByText('TRANSPORT')).toBeInTheDocument();
    expect(screen.getByText('COSMIC')).toBeInTheDocument();
    expect(screen.getByText('VOID')).toBeInTheDocument();
  });

  it('shows status badges correctly', () => {
    const contracts = [
      mockContract({ id: 'c-avail', accepted: false, fulfilled: false }),
      mockContract({ id: 'c-active', accepted: true, fulfilled: false }),
      mockContract({ id: 'c-done', accepted: true, fulfilled: true }),
    ];
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: contracts,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<ContractsWindow />, { wrapper: createWrapper() });
    expect(screen.getByText('AVAILABLE')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('FULFILLED')).toBeInTheDocument();
  });

  it('expands contract on click and shows detail', () => {
    const contracts = [mockContract({
      id: 'c-1',
      terms: {
        deadline: new Date(Date.now() + 86400_000).toISOString(),
        payment: { onAccepted: 1000, onFulfilled: 5000 },
        deliver: [{ tradeSymbol: 'IRON_ORE', destinationSymbol: 'X1-A1', unitsRequired: 100, unitsFulfilled: 30 }],
      },
    })];
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: contracts,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<ContractsWindow />, { wrapper: createWrapper() });

    // Click to expand
    fireEvent.click(document.querySelector('.contract-row')!);

    expect(screen.getByText('Payment')).toBeInTheDocument();
    expect(screen.getByText('Deadlines')).toBeInTheDocument();
    expect(screen.getByText('Deliveries')).toBeInTheDocument();
    expect(screen.getByText('IRON_ORE')).toBeInTheDocument();
    expect(screen.getByText('30 / 100')).toBeInTheDocument();
    expect(screen.getByText('Accept Contract')).toBeInTheDocument();
  });

  it('accepts a contract', async () => {
    const setAgent = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ setAgent }));

    const contracts = [mockContract({ id: 'c-1' })];
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: contracts,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);

    const mutateAsync = vi.fn().mockResolvedValue({
      agent: { symbol: 'A', credits: 2000 },
      contract: { ...contracts[0], accepted: true },
    });
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync,
      isPending: false,
    } as any);

    render(<ContractsWindow />, { wrapper: createWrapper() });

    fireEvent.click(document.querySelector('.contract-row')!);
    fireEvent.click(screen.getByText('Accept Contract'));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith('c-1');
      expect(setAgent).toHaveBeenCalled();
    });
  });

  it('fulfills a contract when all deliveries met', async () => {
    const setAgent = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ setAgent }));

    const contracts = [mockContract({
      id: 'c-1',
      accepted: true,
      fulfilled: false,
      terms: {
        deadline: new Date(Date.now() + 86400_000).toISOString(),
        payment: { onAccepted: 1000, onFulfilled: 5000 },
        deliver: [{ tradeSymbol: 'IRON_ORE', destinationSymbol: 'X1-A1', unitsRequired: 100, unitsFulfilled: 100 }],
      },
    })];
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: contracts,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(api.fulfillContract).mockResolvedValue({
      agent: { symbol: 'A', credits: 7000 },
      contract: { ...contracts[0], fulfilled: true },
    } as any);

    render(<ContractsWindow />, { wrapper: createWrapper() });

    fireEvent.click(document.querySelector('.contract-row')!);
    fireEvent.click(screen.getByText('Fulfill Contract'));

    await waitFor(() => {
      expect(api.fulfillContract).toHaveBeenCalledWith('c-1');
      expect(setAgent).toHaveBeenCalled();
    });
  });

  it('shows error on failed fulfill', async () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());

    const contracts = [mockContract({
      id: 'c-1',
      accepted: true,
      terms: {
        deadline: new Date(Date.now() + 86400_000).toISOString(),
        payment: { onAccepted: 0, onFulfilled: 0 },
        deliver: [{ tradeSymbol: 'X', destinationSymbol: 'Y', unitsRequired: 1, unitsFulfilled: 1 }],
      },
    })];
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: contracts,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(api.fulfillContract).mockRejectedValue(new Error('Not ready'));

    render(<ContractsWindow />, { wrapper: createWrapper() });
    fireEvent.click(document.querySelector('.contract-row')!);
    fireEvent.click(screen.getByText('Fulfill Contract'));

    await waitFor(() => expect(screen.getByText('Not ready')).toBeInTheDocument());
  });

  it('negotiates contract from toolbar', async () => {
    const contracts = [mockContract({ id: 'c-1', accepted: true })];
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: contracts,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(api.negotiateContract).mockResolvedValue({
      contract: mockContract({ id: 'c-new' }),
    } as any);

    render(<ContractsWindow selectedShipSymbol="SHIP-1" />, { wrapper: createWrapper() });

    // Negotiate button should be disabled because there's an active contract
    const btn = screen.getByText('Negotiate');
    expect(btn).toBeDisabled();
  });

  it('shows EXPIRED status for expired contracts', () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const contracts = [mockContract({
      id: 'c-exp',
      expiration: past,
    })];
    vi.spyOn(useQueriesModule, 'useContracts').mockReturnValue({
      data: contracts,
      isLoading: false,
      error: null,
      isFetching: false,
    } as any);
    vi.spyOn(useQueriesModule, 'useAcceptContract').mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any);

    render(<ContractsWindow />, { wrapper: createWrapper() });
    expect(screen.getByText('EXPIRED')).toBeInTheDocument();
  });
});
