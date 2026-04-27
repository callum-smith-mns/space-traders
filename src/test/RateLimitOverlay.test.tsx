import { render, screen, act } from '@testing-library/react';
import RateLimitOverlay from '../components/RateLimitOverlay';
import { api } from '../services/api';

describe('RateLimitOverlay', () => {
  let changeCallback: ((resetAt: number | null) => void) | null = null;

  beforeEach(() => {
    changeCallback = null;
    vi.spyOn(api, 'onRateLimitChange').mockImplementation((cb) => {
      changeCallback = cb;
      return () => { changeCallback = null; };
    });
    Object.defineProperty(api, 'rateLimitResetAt', { value: null, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when no rate limit active', () => {
    const { container } = render(<RateLimitOverlay />);
    expect(container.querySelector('.ratelimit-overlay')).not.toBeInTheDocument();
  });

  it('shows overlay when rate limit exceeds threshold', () => {
    vi.useFakeTimers();
    // Set rate limit 10 seconds in the future (> 3 second threshold)
    const futureReset = Date.now() + 10_000;
    Object.defineProperty(api, 'rateLimitResetAt', { value: futureReset, writable: true, configurable: true });

    render(<RateLimitOverlay />);

    act(() => {
      changeCallback?.(futureReset);
    });

    // Advance to let the tick run
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText('Rate Limit Reached')).toBeInTheDocument();
    expect(screen.getByText(/The SpaceTraders API rate limit has been hit/)).toBeInTheDocument();
    // Countdown should show "10s"
    expect(screen.getByText('10s')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('does not show overlay when wait is below threshold', () => {
    // Set rate limit 2 seconds in the future (< 3 second threshold)
    const futureReset = Date.now() + 2_000;
    Object.defineProperty(api, 'rateLimitResetAt', { value: futureReset, writable: true, configurable: true });

    render(<RateLimitOverlay />);

    act(() => {
      changeCallback?.(futureReset);
    });

    expect(screen.queryByText('Rate Limit Reached')).not.toBeInTheDocument();
  });

  it('hides overlay when countdown reaches zero', () => {
    vi.useFakeTimers();
    const futureReset = Date.now() + 4_000;
    Object.defineProperty(api, 'rateLimitResetAt', { value: futureReset, writable: true, configurable: true });

    render(<RateLimitOverlay />);

    act(() => {
      changeCallback?.(futureReset);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText('Rate Limit Reached')).toBeInTheDocument();

    // Advance past the reset time
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText('Rate Limit Reached')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('hides overlay when rate limit is cleared', () => {
    vi.useFakeTimers();
    const futureReset = Date.now() + 10_000;
    Object.defineProperty(api, 'rateLimitResetAt', { value: futureReset, writable: true, configurable: true });

    render(<RateLimitOverlay />);

    act(() => {
      changeCallback?.(futureReset);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText('Rate Limit Reached')).toBeInTheDocument();

    act(() => {
      changeCallback?.(null);
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.queryByText('Rate Limit Reached')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
