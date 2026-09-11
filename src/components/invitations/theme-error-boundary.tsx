"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui";
import { captureSanitizedError } from "@/modules/errors";

interface ThemeErrorBoundaryProps {
  readonly children: ReactNode;
  readonly themeName: string;
}
interface ThemeErrorBoundaryState {
  readonly hasError: boolean;
}

export class ThemeErrorBoundary extends Component<
  ThemeErrorBoundaryProps,
  ThemeErrorBoundaryState
> {
  state: ThemeErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ThemeErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    void captureSanitizedError(error, { operation: "invitation.theme_render" });
  }

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="invitation-renderer-fallback" role="alert">
          <span aria-hidden="true" className="invitation-renderer-fallback-mark">!</span>
          <h2>Undangan belum dapat ditampilkan</h2>
          <p>Tampilan tema {this.props.themeName} mengalami kendala. Data undangan tetap aman.</p>
          <Button onClick={this.retry} size="sm" variant="secondary">Coba lagi</Button>
        </div>
      );
    }

    return this.props.children;
  }
}
