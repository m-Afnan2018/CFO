'use client';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

export default function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/login') return <>{children}</>;
  return (
    <div id="app">
      <Sidebar />
      <div className="main">{children}</div>
    </div>
  );
}
