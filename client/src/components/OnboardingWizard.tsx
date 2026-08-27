import { useState } from "react";

interface OnboardingWizardProps {
  onComplete: (data: OnboardingData) => void;
  onDismiss: () => void;
}

export interface OnboardingData {
  storage: "local" | "cloud";
  theme: "dark" | "light" | "system";
  font: "JetBrains Mono" | "Inter" | "Fira Code";
  autosave: boolean;
}

const STEPS = [
  { title: "Storage", description: "How would you like to store your files?" },
  { title: "Appearance", description: "Choose your preferred theme." },
  { title: "Font", description: "Select your preferred font." },
  { title: "Autosave", description: "Enable automatic saving?" },
  { title: "Ready", description: "You're all set!" },
];

export default function OnboardingWizard({ onComplete, onDismiss }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    storage: "local",
    theme: "dark",
    font: "JetBrains Mono",
    autosave: true,
  });

  const update = (partial: Partial<OnboardingData>) => setData(prev => ({ ...prev, ...partial }));

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      onComplete(data);
    }
  };

  const skip = () => onDismiss();

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-dialog">
        <div className="onboarding-steps">
          {STEPS.map((s, i) => (
            <div key={i} className={`onboarding-step-dot ${i === step ? "active" : i < step ? "done" : ""}`}>
              {i < step ? "✓" : i + 1}
            </div>
          ))}
        </div>

        <div className="onboarding-content">
          <h2 className="onboarding-title">{STEPS[step].title}</h2>
          <p className="onboarding-description">{STEPS[step].description}</p>

          {step === 0 && (
            <div className="onboarding-options">
              <button className={`onboarding-option ${data.storage === "local" ? "selected" : ""}`} onClick={() => update({ storage: "local" })}>
                <span className="onboarding-option-icon">💻</span>
                <span className="onboarding-option-label">Local Only</span>
                <span className="onboarding-option-desc">All files stored on this device</span>
              </button>
              <button className={`onboarding-option ${data.storage === "cloud" ? "selected" : ""}`} onClick={() => update({ storage: "cloud" })}>
                <span className="onboarding-option-icon">☁️</span>
                <span className="onboarding-option-label">Local + Cloud</span>
                <span className="onboarding-option-desc">Sync across devices</span>
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="onboarding-options">
              {(["dark", "light", "system"] as const).map(t => (
                <button key={t} className={`onboarding-option ${data.theme === t ? "selected" : ""}`} onClick={() => update({ theme: t })}>
                  <span className="onboarding-option-label">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="onboarding-options">
              {(["JetBrains Mono", "Inter", "Fira Code"] as const).map(f => (
                <button key={f} className={`onboarding-option ${data.font === f ? "selected" : ""}`} onClick={() => update({ font: f })}>
                  <span className="onboarding-option-label" style={{ fontFamily: f === "Inter" ? "Inter, sans-serif" : "JetBrains Mono, monospace" }}>{f}</span>
                </button>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="onboarding-options">
              <button className={`onboarding-option ${data.autosave ? "selected" : ""}`} onClick={() => update({ autosave: true })}>
                <span className="onboarding-option-label">Enabled</span>
                <span className="onboarding-option-desc">Files save automatically (500ms debounce)</span>
              </button>
              <button className={`onboarding-option ${!data.autosave ? "selected" : ""}`} onClick={() => update({ autosave: false })}>
                <span className="onboarding-option-label">Disabled</span>
                <span className="onboarding-option-desc">Save manually with Ctrl+S</span>
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="onboarding-done">
              <div className="onboarding-done-icon">🎉</div>
              <p className="onboarding-done-text">
                You're ready to start writing.<br />
                Everything is stored locally and encrypted by default.
              </p>
            </div>
          )}
        </div>

        <div className="onboarding-footer">
          <button className="onboarding-skip" onClick={skip}>Skip</button>
          <button className="onboarding-next" onClick={next}>
            {step === STEPS.length - 1 ? "Get Started" : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
