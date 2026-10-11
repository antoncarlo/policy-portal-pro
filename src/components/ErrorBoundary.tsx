import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { getMessages } from "@/i18n";
import { errorMessages } from "@/i18n/messages/errors";
import { reportError } from "@/lib/errorReporting";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Changes when the person moves to another page: the screen then tries again. */
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
  reference: string;
}

const newReference = () => Math.random().toString(36).slice(2, 8).toUpperCase();

/**
 * An error while drawing a page used to leave a white screen. Here it becomes a clear page with a way out,
 * and the error is reported (console, and Sentry when configured).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, reference: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, reference: newReference() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, "react", { componentStack: info.componentStack?.slice(0, 2000), reference: this.state.reference });
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error, reference } = this.state;
    if (!error) return this.props.children;

    const m = getMessages(errorMessages);
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6" role="alert" data-testid="error-boundary">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
          <h1 className="text-xl font-semibold text-foreground">{m.title}</h1>
          <p className="text-sm text-muted-foreground">{m.text}</p>
          <p className="text-xs text-muted-foreground">{m.reference(reference)}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              onClick={() => this.setState({ error: null })}
              data-testid="error-retry"
            >
              {m.retry}
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              onClick={() => window.location.assign("/dashboard")}
            >
              {m.home}
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              onClick={() => window.location.reload()}
            >
              {m.reload}
            </button>
          </div>
          <details className="text-left text-xs text-muted-foreground">
            <summary className="cursor-pointer">{m.detail}</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">{error.message}</pre>
          </details>
        </div>
      </div>
    );
  }
}
