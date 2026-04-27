import { render, screen } from '@testing-library/react';
import LoadingScreen from '../components/LoadingScreen';

describe('LoadingScreen', () => {
  it('renders the SpaceTraders logo and loading bar', () => {
    render(<LoadingScreen />);
    expect(screen.getByText('SpaceTraders')).toBeInTheDocument();
    expect(document.querySelector('.loading-bar')).toBeInTheDocument();
  });

  it('has the correct class name', () => {
    const { container } = render(<LoadingScreen />);
    expect(container.querySelector('.loading-screen')).toBeInTheDocument();
  });
});
