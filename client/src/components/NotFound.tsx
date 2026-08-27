import "../styles/notfound.css";

interface NotFoundProps {
  onGoHome: () => void;
}

export default function NotFound({ onGoHome }: NotFoundProps) {
  return (
    <div className="nf-container">
      <div className="nf-card">
        <svg className="nf-face" viewBox="0 0 320 380">
          <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="25">
            <g className="nf-eyes" transform="translate(0,112.5)">
              <g transform="translate(15,0)">
                <polyline className="nf-eye-lid" points="37,0 0,120 75,120" />
                <polyline className="nf-pupil" points="55,120 55,155" strokeDasharray="35 35" />
              </g>
              <g transform="translate(230,0)">
                <polyline className="nf-eye-lid" points="37,0 0,120 75,120" />
                <polyline className="nf-pupil" points="55,120 55,155" strokeDasharray="35 35" />
              </g>
            </g>
            <rect className="nf-nose" x="132.5" y="112.5" width="55" height="155" rx="4" ry="4" />
            <g transform="translate(65,334)" strokeDasharray="102 102">
              <path className="nf-mouth-left" d="M 0 30 C 0 30 40 0 95 0" />
              <path className="nf-mouth-right" d="M 95 0 C 150 0 190 30 190 30" />
            </g>
          </g>
        </svg>
        <h1 className="nf-title">404</h1>
        <p className="nf-desc">This page doesn't exist. It may have been moved or deleted.</p>
        <button className="nf-btn" onClick={onGoHome}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Back to Home
        </button>
      </div>
    </div>
  );
}
