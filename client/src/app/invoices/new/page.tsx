'use client';
import { useRouter } from 'next/navigation';
import InvoiceDesigner from '@/components/pages/InvoiceDesigner';
import type { Invoice } from '@/types';

export default function NewInvoicePage() {
  const router = useRouter();
  return (
    <InvoiceDesigner
      onSave={(_inv: Invoice) => router.push('/invoices')}
      onClose={() => router.push('/invoices')}
    />
  );
}
