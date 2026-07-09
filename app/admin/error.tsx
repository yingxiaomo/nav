'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="mx-auto my-20 rounded-xl border border-border bg-card p-8 text-center shadow-xl"
      style={{ width: 420, maxWidth: '94vw' }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '3.5rem',
          height: '3.5rem',
          borderRadius: '1rem',
          background: 'color-mix(in srgb, var(--destructive) 15%, transparent)',
          color: 'var(--destructive)',
          marginBottom: '1rem',
        }}
      >
        <AlertTriangle style={{ width: '1.5rem', height: '1.5rem' }} />
      </div>
      <h1
        style={{
          fontSize: '1.375rem',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          color: 'var(--card-foreground)',
          margin: '0 0 0.35rem',
        }}
      >
        页面渲染错误
      </h1>
      <p
        style={{
          color: 'var(--muted-foreground)',
          fontSize: '0.875rem',
          margin: '0 0 1.25rem',
          lineHeight: 1.5,
        }}
      >
        {error.message || '管理后台遇到了一个意外错误'}
      </p>
      <button
        onClick={reset}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.375rem',
          padding: '0.5rem 1rem',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.875rem',
          fontWeight: 500,
          cursor: 'pointer',
          border: '1px solid transparent',
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          lineHeight: 1.4,
        }}
      >
        <RefreshCw style={{ width: '1rem', height: '1rem' }} />
        重试
      </button>
    </div>
  );
}
