import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

const isSk = () => {
  try {
    return (localStorage.getItem("lang") ?? "sk") === "sk";
  } catch {
    return true;
  }
};

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
      const sk = isSk();
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-xl font-semibold">
              {sk ? "Niečo sa pokazilo" : "Something went wrong"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {sk
                ? "Stránka narazila na neočakávanú chybu. Skús ju znovu načítať."
                : "The page hit an unexpected error. Try reloading it."}
            </p>
            <pre className="text-xs text-left text-muted-foreground bg-secondary/50 rounded-lg p-3 overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
            <Button onClick={() => window.location.reload()}>
              {sk ? "Znovu načítať" : "Reload"}
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
