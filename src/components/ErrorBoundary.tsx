"use client";
import { Component, ReactNode } from "react";

export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-bold text-red-600">Algo salió mal</h2>
          <p className="mt-2 text-sm text-muted">Intenta recargar la página.</p>
          <button onClick={() => location.reload()} className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white">
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
