'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import InvoiceDesigner from '@/components/pages/InvoiceDesigner';
import type { Invoice } from '@/types';
import { api } from '@/lib/api';

export default function EditInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getInvoice(params.id as string)
      .then(d => { setInvoice(d as Invoice); setLoading(false); })
      .catch(() => router.replace('/invoices'));
  }, [params.id, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: '13px' }}>
        Loading invoice…
      </div>
    );
  }
  if (!invoice) return null;

  return (
    <InvoiceDesigner
      invoice={invoice}
      onSave={(_inv: Invoice) => router.push('/invoices')}
      onClose={() => router.push('/invoices')}
    />
  );
}
