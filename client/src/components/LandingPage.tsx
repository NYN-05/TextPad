import { useCallback, useRef } from "react";
import "../styles/landing.css";

interface LandingPageProps {
  onGetStarted: () => void;
}

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
    ),
    gradient: "linear-gradient(135deg, #3b82f6, #60a5fa)",
    title: "Local-First Storage",
    desc: "Your files live in your browser's IndexedDB — not on someone else's server. You own every byte.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
    ),
    gradient: "linear-gradient(135deg, #22c55e, #34d399)",
    title: "End-to-End Encryption",
    desc: "AES-256-GCM protects every file at rest. Your content stays private — always.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
    ),
    gradient: "linear-gradient(135deg, #f59e0b, #fbbf24)",
    title: "Offline Editing",
    desc: "No internet? No problem. Everything works offline with automatic sync when you reconnect.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
    ),
    gradient: "linear-gradient(135deg, #a78bfa, #c4b5fd)",
    title: "Lightning Performance",
    desc: "Built on React + TypeScript with IndexedDB. Files open instantly with zero server latency.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
    ),
    gradient: "linear-gradient(135deg, #06b6d4, #22d3ee)",
    title: "Optional Cloud Sync",
    desc: "Toggle sync on your terms. Files are encrypted before they leave your device — zero-knowledge.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="14" y2="13" /><line x1="8" y1="17" x2="12" y2="17" /></svg>
    ),
    gradient: "linear-gradient(135deg, #ec4899, #f472b6)",
    title: "Markdown Editing",
    desc: "Full Markdown support with syntax highlighting for code blocks, headings, lists, and more.",
  },
];

const WHY_CHOOSE = [
  {
    title: "Your data stays yours",
    subtitle: "100% local by default",
    desc: "Every file you create in TextPad lives in your browser's IndexedDB. No cloud uploads, no data mining, no third-party access. You are the only person who can read your content — and only if encryption is enabled.",
    visual: "local"
  },
  {
    title: "Works everywhere, even offline",
    subtitle: "Offline-first architecture",
    desc: "TextPad is a Progressive Web App that works without an internet connection. Edit files on a plane, in a coffee shop with spotty Wi-Fi, or deep in a basement. Changes sync automatically when you come back online.",
    visual: "offline"
  },
  {
    title: "Security is not optional",
    subtitle: "AES-256-GCM encryption",
    desc: "Every file is encrypted at rest using the Web Crypto API. Your encryption key never leaves your device unless you explicitly back it up. Cloud sync is end-to-end encrypted — the server stores ciphertext, not plaintext.",
    visual: "security"
  },
  {
    title: "Built for speed",
    subtitle: "Instant startup, zero bloat",
    desc: "No build tools, no servers, no database setup. TextPad launches instantly from your browser or as a standalone PWA. Files load in milliseconds. The entire app is under 300KB gzipped.",
    visual: "speed"
  },
];

const TESTIMONIALS = [
  {
    name: "Alex Chen",
    role: "Software Engineer",
    avatar: "AC",
    text: "I've been using TextPad for all my daily notes. The fact that everything stays on my machine is exactly what I've been looking for.",
  },
  {
    name: "Sarah Mitchell",
    role: "Technical Writer",
    avatar: "SM",
    text: "The offline support is incredible. I can work on documentation during my commute and everything syncs when I'm back online.",
  },
  {
    name: "Marcus Williams",
    role: "Security Engineer",
    avatar: "MW",
    text: "End-to-end encryption in a note-taking app that actually works offline? Finally, someone built it right.",
  },
];

const TECHS = ["React", "TypeScript", "IndexedDB", "PWA", "Web Crypto"];

function BackgroundEffects() {
  return (
    <>
      <div className="land-bg">
        <div className="land-grid" />
        <div className="land-noise" />
        <div className="land-orb land-orb--1" />
        <div className="land-orb land-orb--2" />
        <div className="land-orb land-orb--3" />
      </div>
      <div className="land-glow land-glow--top" />
      <div className="land-glow land-glow--bottom" />
    </>
  );
}

function FloatingBadge({ className, label, icon }: { className: string; label: string; icon: string }) {
  return (
    <div className={`land-floating-badge ${className}`}>
      <span className="land-floating-badge-dot" />
      <span className="land-floating-badge-text">{icon} {label}</span>
    </div>
  );
}

function BrowserMockup() {
  return (
    <div className="land-browser-wrap">
      <div className="land-browser">
        <div className="land-browser-bar">
          <div className="land-browser-dots">
            <span className="land-browser-dot land-browser-dot--red" />
            <span className="land-browser-dot land-browser-dot--yellow" />
            <span className="land-browser-dot land-browser-dot--green" />
          </div>
          <div className="land-browser-url">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
            <span>app.textpad.dev</span>
          </div>
          <div className="land-browser-lock">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
        </div>
        <div className="land-browser-body">
          <div className="land-browser-toolbar">
            <div className="land-browser-tab">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
              <span>untitled.txt</span>
            </div>
            <div className="land-browser-tab-actions">
              <div className="land-browser-tab-action" />
              <div className="land-browser-tab-action" />
              <div className="land-browser-tab-action" />
            </div>
          </div>
          <div className="land-browser-editor">
            <div className="land-browser-line"><span className="land-browser-ln">1</span><span className="land-browser-hl land-browser-hl--k">import</span><span className="land-browser-hl land-browser-hl--s">{' '}</span><span className="land-browser-hl land-browser-hl--s">React</span><span className="land-browser-hl">{' '}</span><span className="land-browser-hl land-browser-hl--k">from</span><span className="land-browser-hl">{' '}</span><span className="land-browser-hl land-browser-hl--s">"react"</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">2</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">3</span><span className="land-browser-hl land-browser-hl--k">function</span><span className="land-browser-hl">{' '}</span><span className="land-browser-hl land-browser-hl--f">App</span>() {'{'}</div>
            <div className="land-browser-line"><span className="land-browser-ln">4</span><span className="land-browser-hl land-browser-hl--k">  const</span><span className="land-browser-hl">{' '}[count, setCount] = </span><span className="land-browser-hl land-browser-hl--f">useState</span>(0)</div>
            <div className="land-browser-line"><span className="land-browser-ln">5</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">6</span><span className="land-browser-hl">  </span><span className="land-browser-hl land-browser-hl--k">return</span><span className="land-browser-hl">{' '}(</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">7</span><span className="land-browser-hl">    {'<'}</span><span className="land-browser-hl land-browser-hl--t">div</span><span className="land-browser-hl">{' '}</span><span className="land-browser-hl land-browser-hl--a">className</span><span className="land-browser-hl">=</span><span className="land-browser-hl land-browser-hl--s">"app"</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">8</span><span className="land-browser-hl">      {'>'}</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">9</span><span className="land-browser-hl">      {'<'}</span><span className="land-browser-hl land-browser-hl--t">h1</span><span className="land-browser-hl">{'>'}Hello, World!</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">10</span><span className="land-browser-hl">      {'<'}/</span><span className="land-browser-hl land-browser-hl--t">h1</span><span className="land-browser-hl">{'>'}</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">11</span><span className="land-browser-hl">{'    '}{'<'}/</span><span className="land-browser-hl land-browser-hl--t">div</span><span className="land-browser-hl">{'>'}</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">12</span><span className="land-browser-hl">  )</span></div>
            <div className="land-browser-line"><span className="land-browser-ln">13</span>{'}'}</div>
            <div className="land-browser-cursor" />
          </div>
          <div className="land-browser-status">
            <span className="land-browser-status-item">
              <span className="land-browser-status-dot land-browser-status-dot--green" />
              Encrypted
            </span>
            <span className="land-browser-status-item">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              Saved
            </span>
            <span className="land-browser-status-item">Ln 13, Col 1</span>
            <span className="land-browser-status-item land-browser-status-item--right">UTF-8</span>
          </div>
        </div>
      </div>

      <FloatingBadge className="land-floating-badge--1" label="AES-256-GCM Encryption" icon="🔒" />
      <FloatingBadge className="land-floating-badge--2" label="100% Local Storage" icon="💾" />
      <FloatingBadge className="land-floating-badge--3" label="Offline Ready" icon="✈️" />
      <FloatingBadge className="land-floating-badge--4" label="Zero Tracking" icon="🛡️" />
      <FloatingBadge className="land-floating-badge--5" label="Ctrl+S to Save" icon="⌨️" />
    </div>
  );
}

function FeatureCard({ icon, gradient, title, desc, index }: {
  icon: React.ReactNode;
  gradient: string;
  title: string;
  desc: string;
  index: number;
}) {
  return (
    <div className="land-feat-card" style={{ animationDelay: `${0.3 + index * 0.08}s` } as React.CSSProperties}>
      <div className="land-feat-card-border" />
      <div className="land-feat-icon" style={{ background: gradient }}>
        {icon}
      </div>
      <h3 className="land-feat-title">{title}</h3>
      <p className="land-feat-desc">{desc}</p>
    </div>
  );
}

function WhySection({ item, index }: { item: typeof WHY_CHOOSE[0]; index: number }) {
  const isReversed = index % 2 === 1;
  return (
    <div className={`land-why ${isReversed ? "land-why--rev" : ""}`}>
      <div className="land-why-content">
        <span className="land-why-subtitle">{item.subtitle}</span>
        <h2 className="land-why-title">{item.title}</h2>
        <p className="land-why-desc">{item.desc}</p>
      </div>
      <div className="land-why-visual">
        <div className="land-why-graphic">
          {item.visual === "local" && (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>
          )}
          {item.visual === "offline" && (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round"><path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
          )}
          {item.visual === "security" && (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>
          )}
          {item.visual === "speed" && (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
          )}
          <div className="land-why-graphic-bg" />
        </div>
      </div>
    </div>
  );
}

function TestimonialCard({ name, role, avatar, text }: {
  name: string;
  role: string;
  avatar: string;
  text: string;
}) {
  return (
    <div className="land-testimonial">
      <div className="land-testimonial-stars">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill="var(--color-warning)" stroke="var(--color-warning)" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
        ))}
      </div>
      <p className="land-testimonial-text">{text}</p>
      <div className="land-testimonial-author">
        <div className="land-testimonial-avatar">{avatar}</div>
        <div>
          <div className="land-testimonial-name">{name}</div>
          <div className="land-testimonial-role">{role}</div>
        </div>
      </div>
    </div>
  );
}

function StatsStrip() {
  const stats = [
    { value: "100%", label: "Local Storage" },
    { value: "AES-256", label: "Encryption" },
    { value: "Offline", label: "Ready" },
    { value: "Zero", label: "Trackers" },
  ];
  return (
    <div className="land-stats">
      {stats.map((s, i) => (
        <div key={s.label} className="land-stat" style={{ animationDelay: `${0.5 + i * 0.1}s` } as React.CSSProperties}>
          <span className="land-stat-value">{s.value}</span>
          <span className="land-stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function TechStrip() {
  return (
    <div className="land-techs">
      <span className="land-techs-label">Built with</span>
      <div className="land-techs-row">
        {TECHS.map((t) => (
          <span key={t} className="land-tech">{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const featuresRef = useRef<HTMLDivElement>(null);

  const handleViewDemo = useCallback(() => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="land">
      <BackgroundEffects />

      <div className="land-container">
        <div className="land-inner">
          <section className="land-hero">
            <div className="land-logo">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>TextPad</span>
            </div>

            <h1 className="land-title">
              A private text editor<br />
              <span className="land-title-accent">that works offline</span>
            </h1>

            <p className="land-subtitle">
              Your files live on your device, encrypted with AES-256-GCM.
              No cloud dependency, no tracking, no compromises.<br />
              Just fast, private, local-first editing.
            </p>

            <div className="land-ctas">
              <button className="land-btn land-btn--primary" onClick={onGetStarted}>
                Get Started Free
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </button>
              <button className="land-btn land-btn--ghost" onClick={handleViewDemo}>
                View Demo
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="7 13 12 18 17 13" /><polyline points="7 6 12 11 17 6" /></svg>
              </button>
            </div>

            <p className="land-hint">
              Press <kbd>Enter</kbd> to get started
            </p>
          </section>

          <section className="land-mockup-section">
            <BrowserMockup />
          </section>

          <StatsStrip />

          <section className="land-feats" ref={featuresRef} id="features">
            <div className="land-section-label">Features</div>
            <h2 className="land-section-title">
              Everything you need.<br />
              Nothing you don&apos;t.
            </h2>
            <p className="land-section-desc">
              TextPad combines the simplicity of a text editor with the security of modern encryption.
            </p>
            <div className="land-feats-grid">
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} {...f} index={i} />
              ))}
            </div>
          </section>

          <section className="land-whys">
            <div className="land-section-label">Why TextPad</div>
            <h2 className="land-section-title">
              Built for privacy.<br />
              Designed for speed.
            </h2>
            {WHY_CHOOSE.map((item, i) => (
              <WhySection key={item.title} item={item} index={i} />
            ))}
          </section>

          <section className="land-testimonials-section">
            <div className="land-section-label">Testimonials</div>
            <h2 className="land-section-title">
              Loved by developers.
            </h2>
            <div className="land-testimonials-grid">
              {TESTIMONIALS.map((t) => (
                <TestimonialCard key={t.name} {...t} />
              ))}
            </div>
          </section>

          <TechStrip />

          <section className="land-footer">
            <div className="land-footer-cta">
              <h2 className="land-section-title">
                Start editing privately.
              </h2>
              <p className="land-section-desc">
                No sign-up. No download. Just private, encrypted editing.
              </p>
              <button className="land-btn land-btn--primary" onClick={onGetStarted}>
                Get Started Free
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </button>
            </div>
            <div className="land-footer-bottom">
              <span className="land-footer-keyboard">
                <kbd>Ctrl+N</kbd> New File · <kbd>Ctrl+F</kbd> Search · <kbd>Ctrl+S</kbd> Save
              </span>
              <span className="land-footer-copy">© TextPad — Local-first, private, encrypted.</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
