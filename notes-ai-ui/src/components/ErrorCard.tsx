interface ErrorCardProps {
  message: string;
  onRetry: () => void;
}

export function ErrorCard({ message, onRetry }: ErrorCardProps) {
  return (
    <div className="card error-card">
      <div className="error-ico">!</div>
      <div style={{ minWidth: 0 }}>
        <h2>Something went wrong</h2>
        <p>{message}</p>
      </div>
      <button className="btn btn-primary" onClick={onRetry}>Try again</button>
    </div>
  );
}