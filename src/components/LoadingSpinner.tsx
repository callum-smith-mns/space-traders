import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message = 'Loading…' }: LoadingSpinnerProps) {
  return (
    <div className="spinner-container">
      <div className="spinner-ring" />
      <span className="spinner-message">{message}</span>
    </div>
  );
}
