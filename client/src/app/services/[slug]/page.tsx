import ServicePage from '@/components/pages/ServicePage';

export default function Page({ params }: { params: { slug: string } }) {
  return <ServicePage slug={params.slug} />;
}
