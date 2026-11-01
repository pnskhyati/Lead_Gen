import React from 'react';

/** Soft visual bridge so legacy feature UIs sit cleanly inside the new shell. */
export default function LiveFeatureFrame({
  title,
  subtitle,
  children,
  flush = false,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <div className={flush ? 'space-y-4' : 'space-y-5'}>
      {(title || subtitle) && (
        <div>
          {title && <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{title}</h1>}
          {subtitle && <p className="text-sm text-[var(--text-muted)] mt-1 max-w-3xl">{subtitle}</p>}
        </div>
      )}
      <div className="legacy-feature-surface rounded-2xl border border-[rgba(148,163,184,0.18)] bg-[rgba(248,250,252,0.97)] text-slate-900 p-4 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        {children}
      </div>
    </div>
  );
}
