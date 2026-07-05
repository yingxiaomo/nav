'use client';

import dynamic from 'next/dynamic';

const AdminPanel = dynamic(() => import('@/components/admin/AdminPanel'), {
  ssr: false,
});

export default function AdminPage() {
  return <AdminPanel />;
}
