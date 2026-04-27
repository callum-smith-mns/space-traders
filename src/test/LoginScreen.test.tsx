import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginScreen from '../components/LoginScreen';
import * as AuthModule from '../contexts/AuthContext';

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

describe('LoginScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders main view by default with account token form', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<LoginScreen />);
    expect(screen.getByText('SpaceTraders')).toBeInTheDocument();
    expect(screen.getByText('Account Token')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste your account token...')).toBeInTheDocument();
    expect(screen.getByText('Existing Agent Token')).toBeInTheDocument();
  });

  it('switches to agent token view and back', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<LoginScreen />);

    fireEvent.click(screen.getByText('Existing Agent Token'));
    expect(screen.getByPlaceholderText('Paste your agent bearer token...')).toBeInTheDocument();
    expect(screen.getByText('Agent Token')).toBeInTheDocument();

    fireEvent.click(screen.getByText('← Back'));
    expect(screen.getByPlaceholderText('Paste your account token...')).toBeInTheDocument();
  });

  it('submits account token', async () => {
    const loginFn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ loginWithAccountToken: loginFn }));

    render(<LoginScreen />);
    const input = screen.getByPlaceholderText('Paste your account token...');
    await userEvent.type(input, 'my-account-token');
    fireEvent.click(screen.getByText('Connect Account'));

    await waitFor(() => expect(loginFn).toHaveBeenCalledWith('my-account-token'));
  });

  it('shows error for empty account token', async () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<LoginScreen />);
    fireEvent.click(screen.getByText('Connect Account'));
    expect(screen.getByText('Please enter your account token.')).toBeInTheDocument();
  });

  it('submits agent token', async () => {
    const loginFn = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ loginWithAgentToken: loginFn }));

    render(<LoginScreen />);
    fireEvent.click(screen.getByText('Existing Agent Token'));
    const input = screen.getByPlaceholderText('Paste your agent bearer token...');
    await userEvent.type(input, 'my-agent-token');
    fireEvent.click(screen.getByText('Connect Agent'));

    await waitFor(() => expect(loginFn).toHaveBeenCalledWith('my-agent-token'));
  });

  it('shows error for empty agent token', async () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth());
    render(<LoginScreen />);
    fireEvent.click(screen.getByText('Existing Agent Token'));
    fireEvent.click(screen.getByText('Connect Agent'));
    expect(screen.getByText('Please enter your agent token.')).toBeInTheDocument();
  });

  it('shows auth error from context', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ error: 'Token expired' }));
    render(<LoginScreen />);
    expect(screen.getByText('Token expired')).toBeInTheDocument();
  });

  it('shows error on failed login', async () => {
    const loginFn = vi.fn().mockRejectedValue(new Error('Invalid token'));
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ loginWithAccountToken: loginFn }));

    render(<LoginScreen />);
    const input = screen.getByPlaceholderText('Paste your account token...');
    await userEvent.type(input, 'bad-token');
    fireEvent.click(screen.getByText('Connect Account'));

    await waitFor(() => expect(screen.getByText('Invalid token')).toBeInTheDocument());
  });

  it('handles non-Error rejection on account submit', async () => {
    const loginFn = vi.fn().mockRejectedValue('string error');
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ loginWithAccountToken: loginFn }));

    render(<LoginScreen />);
    await userEvent.type(screen.getByPlaceholderText('Paste your account token...'), 'tok');
    fireEvent.click(screen.getByText('Connect Account'));

    await waitFor(() => expect(screen.getByText('Authentication failed.')).toBeInTheDocument());
  });

  it('handles non-Error rejection on agent submit', async () => {
    const loginFn = vi.fn().mockRejectedValue('string error');
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ loginWithAgentToken: loginFn }));

    render(<LoginScreen />);
    fireEvent.click(screen.getByText('Existing Agent Token'));
    await userEvent.type(screen.getByPlaceholderText('Paste your agent bearer token...'), 'tok');
    fireEvent.click(screen.getByText('Connect Agent'));

    await waitFor(() => expect(screen.getByText('Authentication failed.')).toBeInTheDocument());
  });

  it('renders saved agents section when agents exist', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      savedAgents: [
        { symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'X1-HQ', tokenKey: 'k1', ivKey: 'iv1' },
        { symbol: 'PILOT-B', faction: 'VOID', headquarters: 'X2-HQ', tokenKey: 'k2', ivKey: 'iv2' },
      ],
    }));

    render(<LoginScreen />);
    expect(screen.getByText('Saved Agents')).toBeInTheDocument();
    expect(screen.getByText('PILOT-A')).toBeInTheDocument();
    expect(screen.getByText('PILOT-B')).toBeInTheDocument();
  });

  it('clicking a saved agent calls loginSavedAgent', async () => {
    const loginSaved = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      savedAgents: [{ symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'X1-HQ', tokenKey: 'k1', ivKey: 'iv1' }],
      loginSavedAgent: loginSaved,
    }));

    render(<LoginScreen />);
    fireEvent.click(screen.getByText('PILOT-A'));
    await waitFor(() => expect(loginSaved).toHaveBeenCalledWith('PILOT-A'));
  });

  it('handles error on saved agent login', async () => {
    const loginSaved = vi.fn().mockRejectedValue(new Error('Token expired'));
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      savedAgents: [{ symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'X1-HQ', tokenKey: 'k1', ivKey: 'iv1' }],
      loginSavedAgent: loginSaved,
    }));

    render(<LoginScreen />);
    fireEvent.click(screen.getByText('PILOT-A'));
    await waitFor(() => expect(screen.getByText('Token expired')).toBeInTheDocument());
  });

  it('handles non-Error on saved agent login', async () => {
    const loginSaved = vi.fn().mockRejectedValue('string err');
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      savedAgents: [{ symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'X1-HQ', tokenKey: 'k1', ivKey: 'iv1' }],
      loginSavedAgent: loginSaved,
    }));

    render(<LoginScreen />);
    fireEvent.click(screen.getByText('PILOT-A'));
    await waitFor(() => expect(screen.getByText('Login failed.')).toBeInTheDocument());
  });

  it('shows delete confirmation and deletes agent', () => {
    const deleteFn = vi.fn();
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      savedAgents: [{ symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'X1-HQ', tokenKey: 'k1', ivKey: 'iv1' }],
      deleteSavedAgent: deleteFn,
    }));

    render(<LoginScreen />);

    // Click the × button
    fireEvent.click(screen.getByTitle('Remove agent'));

    // Confirmation dialog
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    expect(screen.getByText(/Remove saved agent/)).toBeInTheDocument();

    // Click Delete
    fireEvent.click(screen.getByText('Delete'));
    expect(deleteFn).toHaveBeenCalledWith('PILOT-A');
  });

  it('cancels delete confirmation', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      savedAgents: [{ symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'X1-HQ', tokenKey: 'k1', ivKey: 'iv1' }],
    }));

    render(<LoginScreen />);
    fireEvent.click(screen.getByTitle('Remove agent'));
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
  });

  it('closes delete dialog on overlay click', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({
      savedAgents: [{ symbol: 'PILOT-A', faction: 'COSMIC', headquarters: 'X1-HQ', tokenKey: 'k1', ivKey: 'iv1' }],
    }));

    render(<LoginScreen />);
    fireEvent.click(screen.getByTitle('Remove agent'));
    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();

    fireEvent.click(document.querySelector('.login-overlay')!);
    expect(screen.queryByText('Confirm Deletion')).not.toBeInTheDocument();
  });

  it('disables buttons when loading', () => {
    vi.spyOn(AuthModule, 'useAuth').mockReturnValue(mockUseAuth({ loading: true }));
    render(<LoginScreen />);
    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    expect(screen.getByText('Authenticating...').closest('button')).toBeDisabled();
  });
});
