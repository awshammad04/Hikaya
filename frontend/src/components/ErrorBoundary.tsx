import React from "react";

interface ErrorBoundaryProps {
  isArabic: boolean;
  /** Changing this (the route) clears a caught error, so navigating away recovers. */
  resetKey: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Keeps one broken page from blanking the whole app: the header and navigation
 * stay usable and the visitor gets a way forward instead of a white screen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // React's types are inferred from its JavaScript here (no @types/react), and
  // that inference does not see the members a class component inherits.
  declare props: Readonly<ErrorBoundaryProps>;
  declare setState: (state: ErrorBoundaryState) => void;
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Hikaya] page failed to render", error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { isArabic } = this.props;
    return (
      <section role="alert" className="mx-auto max-w-xl py-16 text-center space-y-5">
        <h1 className="font-serif text-2xl font-black text-brand-olive">
          {isArabic ? "تعثّرت هذه الصفحة" : "This page ran into a problem"}
        </h1>
        <p className="text-brand-muted">
          {isArabic
            ? "رحلتك وأختامك محفوظة. أعد تحميل الصفحة، أو عد إلى الرئيسية وتابع من هناك."
            : "Your journey and stamps are safe. Reload the page, or go back home and continue from there."}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-brand-olive px-5 py-2.5 text-sm font-bold text-white"
          >
            {isArabic ? "إعادة التحميل" : "Reload"}
          </button>
          <a href="/" className="rounded-full border border-brand-border px-5 py-2.5 text-sm font-bold text-brand-olive">
            {isArabic ? "الرئيسية" : "Home"}
          </a>
        </div>
      </section>
    );
  }
}
