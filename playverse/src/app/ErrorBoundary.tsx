import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  fallback: (reset: () => void, error: Error) => ReactNode;
  children: ReactNode;
  /** Changing this value resets the boundary (e.g. on navigation). */
  resetKey?: string;
}

interface State {
  error: Error | null;
  key: string | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.key) return { error: null, key: props.resetKey };
    return null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[PlayVerse] UI error', error, info.componentStack);
  }

  override render() {
    if (this.state.error) return this.props.fallback(() => this.setState({ error: null }), this.state.error);
    return this.props.children;
  }
}
