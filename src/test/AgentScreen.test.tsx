import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AgentScreen from '../components/AgentScreen';
import * as AuthModule from '../contexts/AuthContext';
import * as useQueriesModule from '../hooks/useQueries';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    registerAgent: vi.fn(),
  },
}));

function mockUseAuth(overrides: Partial<ReturnType<typeof AuthModule.useAuth>> = {}) {
  const defaults: ReturnType<typeof AuthModule.useAuth> = {
    token: 'test-token',
    agent: null,
    loading: false,
    error: null,
    isAccountToken: true,
    loginWithAccountToken: vi.fn(),
    loginWithAgentToken: vi.fn(),
    loginSavedAgent: vi.fn(),
    disconnectAgent: vi.fn(),
    logout: vi.fn(),
    setAgent: vi.fn(),
    setAgentToken: vi.fn(),
    savedAgents: [],
    deleteSavedAgent: vi.fn(),
  };
  return { ...defaults, ...overrides };
}

describe('AgentScreen', () => {
  const onLaunch = vi.fn();

  beforeEach(() => {
    onLaunch.mockClear();
    vi.spyOn(useQueriesModule, 'useFactions').mockReturnValue({
      data: [
        {
          symbol: 'COSMIC',
          name: 'Cosmic Engineers',
          description: 'Space builders',
          headquarters: 'X1-HQ',
          traits: [{ symbol: 'INNOVATIVE', name: 'Innovative', description: 'Tech' }],
          isRecruiting: true,
        },
        {
          symbol: 'VOID',
          name: 'Void Farers',
          description: 'Explorers',
          headquarters: 'X2-HQ',
          traits: [],
          isRecruiting: false,
        },
      ],
      isLoading: false,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders mission control screen', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<AgentScreen onLaunch={onLaunch} />);
    expect(screen.getByText('Mission Control')).toBeInTheDocument();
  });

  it('shows account token notice when no agent', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ isAccountToken: true, agent: null }));
    render(<AgentScreen onLaunch={onLaunch} />);
    expect(screen.getByText('Account Token')).toBeInTheDocument();
  });

  it('shows agent info when agent exists', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      agent: { symbol: 'PILOT', headquarters: 'X1-HQ', credits: 150000, startingFaction: 'COSMIC', shipCount: 3 },
    }));
    render(<AgentScreen onLaunch={onLaunch} />);
    expect(screen.getByText('PILOT')).toBeInTheDocument();
    expect(screen.getByText('150,000')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Continue Mission ▸')).toBeInTheDocument();
  });

  it('calls onLaunch when clicking Continue Mission', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      agent: { symbol: 'PILOT', headquarters: 'X1-HQ', credits: 100, startingFaction: 'COSMIC', shipCount: 1 },
    }));
    render(<AgentScreen onLaunch={onLaunch} />);
    fireEvent.click(screen.getByText('Continue Mission ▸'));
    expect(onLaunch).toHaveBeenCalled();
  });

  it('shows faction cards for registration', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<AgentScreen onLaunch={onLaunch} />);
    // Faction names appear in both the card and detail panel
    expect(screen.getAllByText('Cosmic Engineers').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Void Farers').length).toBeGreaterThanOrEqual(1);
    // Status labels may appear in both the card and the detail panel
    expect(screen.getAllByText('RECRUITING').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('CLOSED').length).toBeGreaterThanOrEqual(1);
  });

  it('shows loading text when factions are loading', () => {
    vi.spyOn(useQueriesModule, 'useFactions').mockReturnValue({ data: [], isLoading: true } as any);
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<AgentScreen onLaunch={onLaunch} />);
    expect(screen.getByText('Loading factions...')).toBeInTheDocument();
  });

  it('shows faction detail when selected', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<AgentScreen onLaunch={onLaunch} />);
    // COSMIC is selected by default
    expect(screen.getByText('Space builders')).toBeInTheDocument();
    expect(screen.getByText('HQ: X1-HQ')).toBeInTheDocument();
  });

  it('selects a different faction', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<AgentScreen onLaunch={onLaunch} />);

    fireEvent.click(screen.getByText('Void Farers'));
    expect(screen.getByText('Explorers')).toBeInTheDocument();
    expect(screen.getByText('HQ: X2-HQ')).toBeInTheDocument();
  });

  it('validates callsign length on register', async () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<AgentScreen onLaunch={onLaunch} />);

    await userEvent.type(screen.getByLabelText('Agent Callsign'), 'AB');
    fireEvent.click(screen.getByText('Register Agent'));

    expect(screen.getByText('Callsign must be 3-14 characters.')).toBeInTheDocument();
  });

  it('registers agent successfully', async () => {
    const setAgentToken = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ setAgentToken }));
    vi.mocked(api.registerAgent).mockResolvedValue({
      token: 'new-token',
      agent: { symbol: 'NEWPILOT', headquarters: 'X1-HQ', credits: 100_000, startingFaction: 'COSMIC', shipCount: 1 },
    } as any);

    render(<AgentScreen onLaunch={onLaunch} />);
    await userEvent.type(screen.getByLabelText('Agent Callsign'), 'NEWPILOT');
    fireEvent.click(screen.getByText('Register Agent'));

    await waitFor(() => {
      expect(api.registerAgent).toHaveBeenCalledWith('NEWPILOT', 'COSMIC');
      expect(setAgentToken).toHaveBeenCalled();
    });
  });

  it('shows error on failed registration', async () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    vi.mocked(api.registerAgent).mockRejectedValue(new Error('Agent name taken'));

    render(<AgentScreen onLaunch={onLaunch} />);
    await userEvent.type(screen.getByLabelText('Agent Callsign'), 'TAKEN');
    fireEvent.click(screen.getByText('Register Agent'));

    await waitFor(() => expect(screen.getByText('Agent name taken')).toBeInTheDocument());
  });

  it('handles non-Error on registration failure', async () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    vi.mocked(api.registerAgent).mockRejectedValue('string err');

    render(<AgentScreen onLaunch={onLaunch} />);
    await userEvent.type(screen.getByLabelText('Agent Callsign'), 'TAKEN');
    fireEvent.click(screen.getByText('Register Agent'));

    await waitFor(() => expect(screen.getByText('Registration failed.')).toBeInTheDocument());
  });

  it('calls logout', () => {
    const logout = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ logout }));
    render(<AgentScreen onLaunch={onLaunch} />);
    fireEvent.click(screen.getByText('Change Account'));
    expect(logout).toHaveBeenCalled();
  });

  it('calls disconnectAgent', () => {
    const disconnectAgent = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      agent: { symbol: 'PILOT', headquarters: 'HQ', credits: 0, startingFaction: 'C', shipCount: 1 },
      disconnectAgent,
    }));
    render(<AgentScreen onLaunch={onLaunch} />);
    fireEvent.click(screen.getByText('Switch Agent'));
    expect(disconnectAgent).toHaveBeenCalled();
  });

  it('renders other saved agents and switch to them', async () => {
    const loginSaved = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      agent: { symbol: 'PILOT-A', headquarters: 'HQ', credits: 0, startingFaction: 'C', shipCount: 1 },
      savedAgents: [
        { symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'HQ' },
        { symbol: 'PILOT-B', faction: 'VOID', headquarters: 'HQ2' },
      ],
      loginSavedAgent: loginSaved,
    }));

    render(<AgentScreen onLaunch={onLaunch} />);
    expect(screen.getByText('Switch agent')).toBeInTheDocument();
    expect(screen.getByText('PILOT-B')).toBeInTheDocument();

    fireEvent.click(screen.getByText('PILOT-B'));
    await waitFor(() => expect(loginSaved).toHaveBeenCalledWith('PILOT-B'));
  });

  it('handles error switching agents', async () => {
    const loginSaved = vi.fn().mockRejectedValue(new Error('Bad token'));
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      agent: { symbol: 'PILOT-A', headquarters: 'HQ', credits: 0, startingFaction: 'C', shipCount: 1 },
      savedAgents: [
        { symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'HQ' },
        { symbol: 'PILOT-B', faction: 'VOID', headquarters: 'HQ2' },
      ],
      loginSavedAgent: loginSaved,
    }));

    render(<AgentScreen onLaunch={onLaunch} />);
    fireEvent.click(screen.getByText('PILOT-B'));
    await waitFor(() => expect(screen.getByText('Bad token')).toBeInTheDocument());
  });

  it('shows delete confirmation and deletes saved agent', () => {
    const deleteFn = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      agent: { symbol: 'PILOT-A', headquarters: 'HQ', credits: 0, startingFaction: 'C', shipCount: 1 },
      savedAgents: [
        { symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'HQ' },
        { symbol: 'PILOT-B', faction: 'VOID', headquarters: 'HQ2' },
      ],
      deleteSavedAgent: deleteFn,
    }));

    render(<AgentScreen onLaunch={onLaunch} />);
    // Click the × to start delete
    fireEvent.click(screen.getByTitle('Remove agent'));
    expect(screen.getByText('Remove')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Remove'));
    expect(deleteFn).toHaveBeenCalledWith('PILOT-B');
  });

  it('cancels delete confirmation', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      agent: { symbol: 'PILOT-A', headquarters: 'HQ', credits: 0, startingFaction: 'C', shipCount: 1 },
      savedAgents: [
        { symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'HQ' },
        { symbol: 'PILOT-B', faction: 'VOID', headquarters: 'HQ2' },
      ],
    }));

    render(<AgentScreen onLaunch={onLaunch} />);
    fireEvent.click(screen.getByTitle('Remove agent'));
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Remove')).not.toBeInTheDocument();
  });

  it('shows faction traits with overflow', () => {
    vi.spyOn(useQueriesModule, 'useFactions').mockReturnValue({
      data: [{
        symbol: 'COSMIC',
        name: 'Cosmic',
        description: 'Desc',
        headquarters: 'HQ',
        traits: [
          { symbol: 'T1', name: 'Trait 1', description: '' },
          { symbol: 'T2', name: 'Trait 2', description: '' },
          { symbol: 'T3', name: 'Trait 3', description: '' },
          { symbol: 'T4', name: 'Trait 4', description: '' },
          { symbol: 'T5', name: 'Trait 5', description: '' },
        ],
        isRecruiting: true,
      }],
      isLoading: false,
    } as any);
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());

    render(<AgentScreen onLaunch={onLaunch} />);
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('shows Registering... text while registering', async () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    // Never resolve the promise to keep "Registering..." visible
    vi.mocked(api.registerAgent).mockReturnValue(new Promise(() => {}));

    render(<AgentScreen onLaunch={onLaunch} />);
    await userEvent.type(screen.getByLabelText('Agent Callsign'), 'HELLO');
    fireEvent.click(screen.getByText('Register Agent'));

    await waitFor(() => expect(screen.getByText('Registering...')).toBeInTheDocument());
  });
});
