import { render, screen } from '@testing-library/react';
import SystemMap from '../components/SystemMap';
import { mockWaypoint } from './mocks';

// Mock canvas getContext to avoid canvas errors in jsdom
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
    createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
    roundRect: vi.fn(),
    setLineDash: vi.fn(),
    scale: vi.fn(),
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set lineWidth(_v: number) {},
    set font(_v: string) {},
    set textAlign(_v: string) {},
    set globalAlpha(_v: number) {},
    set shadowBlur(_v: number) {},
    set shadowColor(_v: string) {},
  } as any);
});

describe('SystemMap', () => {
  it('renders canvas element', () => {
    const waypoints = [mockWaypoint()];
    const { container } = render(<SystemMap waypoints={waypoints} />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('renders zoom controls', () => {
    const waypoints = [mockWaypoint()];
    render(<SystemMap waypoints={waypoints} />);
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('−')).toBeInTheDocument();
    expect(screen.getByText('⊙')).toBeInTheDocument();
  });

  it('renders legend', () => {
    const waypoints = [
      mockWaypoint({ type: 'PLANET' }),
      mockWaypoint({ symbol: 'X1-TEST-B1', type: 'MOON', x: 20, y: 30 }),
    ];
    const { container } = render(<SystemMap waypoints={waypoints} />);
    expect(container.querySelector('.sysmap-legend')).toBeInTheDocument();
  });

  it('renders empty message when no waypoints', () => {
    const { container } = render(<SystemMap waypoints={[]} />);
    expect(container.querySelector('canvas')).not.toBeInTheDocument();
  });

  it('accepts currentWaypoint prop', () => {
    const waypoints = [
      mockWaypoint({ symbol: 'X1-TEST-A1' }),
      mockWaypoint({ symbol: 'X1-TEST-B1', x: 50, y: 60 }),
    ];
    // Should not crash when currentWaypoint is provided
    const { container } = render(<SystemMap waypoints={waypoints} currentWaypoint="X1-TEST-A1" />);
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });
});
