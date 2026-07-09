export default function AdminLoading() {
  return (
    <div
      className="mx-auto my-20 rounded-xl border border-border bg-card p-8 text-center shadow-xl"
      style={{ width: 420, maxWidth: '94vw', color: 'var(--muted-foreground)' }}
    >
      <div
        style={{
          display: 'inline-block',
          width: '1.25rem',
          height: '1.25rem',
          border: '2px solid color-mix(in srgb, var(--muted-foreground) 25%, transparent)',
          borderTopColor: 'var(--foreground)',
          borderRadius: '50%',
          animation: 'spin 0.5s linear infinite',
        }}
      />
      <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>加载管理后台...</p>
    </div>
  );
}
