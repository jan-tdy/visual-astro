import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="w-full max-w-xs rounded-lg border bg-background shadow-lg">
            <div className="border-b px-4 py-2 text-sm font-semibold">Error</div>
            <div className="space-y-4 px-4 py-6 text-center">
              <p className="text-lg">The application was</p>
              <a
                href="/"
                className="inline-block rounded border px-6 py-1.5 text-sm font-medium hover:bg-muted"
              >
                OK
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
