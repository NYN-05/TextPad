import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100vh", fontFamily: "system-ui, sans-serif",
          color: "#e0e0e0", background: "#1a1a2e", padding: 24, textAlign: "center"
        }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#999", marginBottom: 16, maxWidth: 480 }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: "10px 24px", border: "none", borderRadius: 8,
              background: "#7c5cfc", color: "#fff", cursor: "pointer", fontSize: 14
            }}
          >
            Reload Editor
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
