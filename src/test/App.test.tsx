import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import * as AuthModule from '../contexts/AuthContext';

// Mock all screen components to simple stubs
vi.mock('../components/LoginScreen', () => ({ default: () => <div data-testid="login-screen">Login</div> }));
vi.mock('../components/AgentScreen', () => ({ default: ({ onLaunch }: { onLaunch: () => void }) => <div data-testid="agent-screen"><button onClick={onLaunch}>Launch</button></div> }));
vi.mock('../components/GameScreen', () => ({ default: ({ onBack }: { onBack: () => void }) => <div data-testid="game-screen"><button onClick={onBack}>Back</button></div> }));
vi.mock('../components/LoadingScreen', () => ({ default: () => <div data-testid="loading-screen">Loading</div> }));
vi.mock('../components/StarField', () => ({ default: () => <div data-testid="starfield" /> }));
vi.mock('../components/RateLimitOverlay', () => ({ default: () => <div data-testid="rate-limit" /> }));

function mockUseAuth(overrides: Partial<ReturnType<typeof AuthModule.useAuth>> = {}) {
  const defaults: ReturnType<typeof AuthModule.useAuth> = {
    token: null,
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
  };
  return { ...defaults, ...overrides };
}

describe('App', () => {
  it('renders StarField and RateLimitOverlay', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ loading: false }));
    render(<BrowserRouter><App /></BrowserRouter>);
    expect(screen.getByTestId('starfield')).toBeInTheDocument();
    expect(screen.getByTestId('rate-limit')).toBeInTheDocument();
  });

  it('shows loading screen when loading', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ loading: true }));
    render(<BrowserRouter><App /></BrowserRouter>);
    expect(screen.getByTestId('loading-screen')).toBeInTheDocument();
  });

  it('shows login screen when no token', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ token: null }));
    render(<BrowserRouter><App /></BrowserRouter>);
    expect(screen.getByTestId('login-screen')).toBeInTheDocument();
  });

  it('shows agent screen for account token without agent', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      token: 'acct-tok',
      isAccountToken: true,
      agent: null,
    }));
    render(<BrowserRouter><App /></BrowserRouter>);
    expect(screen.getByTestId('agent-screen')).toBeInTheDocument();
  });

  it('shows agent screen for agent token before launch', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      token: 'agent-tok',
      agent: { symbol: 'A', headquarters: 'H', credits: 0, startingFaction: 'C', shipCount: 1 },
    }));
    render(<BrowserRouter><App /></BrowserRouter>);
    // With agent but no inGame -> AgentScreen
    expect(screen.getByTestId('agent-screen')).toBeInTheDocument();
  });
});
