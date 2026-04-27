import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../components/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('renders with default message', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingSpinner message="Scanning fleet…" />);
    expect(screen.getByText('Scanning fleet…')).toBeInTheDocument();
  });

  it('contains spinner ring element', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.spinner-ring')).toBeInTheDocument();
  });
});
