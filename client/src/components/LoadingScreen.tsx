import "../styles/dashboard.css";

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h1 className="loading-title">TextPad</h1>
        <p className="loading-subtitle">Secure Local-First Text Editor</p>
        <div className="spinner">
          <div /><div /><div /><div /><div />
          <div /><div /><div /><div /><div />
        </div>
      </div>
    </div>
  );
}
