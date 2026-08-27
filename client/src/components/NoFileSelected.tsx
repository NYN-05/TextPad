import "../styles/dashboard.css";

interface NoFileSelectedProps {
  onCreateFile: () => void;
}

export default function NoFileSelected({ onCreateFile }: NoFileSelectedProps) {
  return (
    <div className="no-file-selected">
      <div className="no-file-selected-content">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <h2 className="no-file-selected-title">No File Selected</h2>
        <p className="no-file-selected-text">
          Choose an existing file from the sidebar<br />
          or create a new one.
        </p>
        <button className="no-file-selected-btn" onClick={onCreateFile}>
          <span>+</span>
          Create New File
        </button>
      </div>
    </div>
  );
}
