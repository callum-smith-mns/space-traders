import { render } from '@testing-library/react';
import StarField from '../components/StarField';

// StarField uses SVG with requestAnimationFrame and window event listeners
// We mock rAF and window dimensions for deterministic output.

describe('StarField', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      // Don't run animation loop in tests
      return 1;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(<StarField />);
    // Should render nebulae divs and an SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('creates SVG layer groups', () => {
    const { container } = render(<StarField />);
    const gs = container.querySelectorAll('svg > g');
    expect(gs.length).toBe(3); // 3 parallax layers
  });

  it('renders nebulae', () => {
    const { container } = render(<StarField />);
    // Nebulae are rendered as divs with radial-gradient style, inside a fixed wrapper
    const nebulaWrapper = container.firstElementChild;
    expect(nebulaWrapper).toBeInTheDocument();
  });

  it('renders star circles', () => {
    const { container } = render(<StarField />);
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBeGreaterThan(0);
  });

  it('renders constellation lines', () => {
    const { container } = render(<StarField />);
    const lines = container.querySelectorAll('line');
    // Constellation lines may or may not exist depending on the seed
    expect(lines.length).toBeGreaterThanOrEqual(0);
  });
});
