import type { Metadata } from 'next';
import './globals.css';
import SidebarWrapper from '@/components/layout/SidebarWrapper';
import { ThemeProvider } from '@/context/ThemeContext';

export const metadata: Metadata = {
  title: 'Ganesyx Pvt Ltd — CFO Finance Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css"
        />
        {/* Prevent flash of wrong theme on load */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('cfo-theme');if(t)document.documentElement.setAttribute('data-theme',t);})();` }} />
      </head>
      <body>
        <ThemeProvider>
          <SidebarWrapper>{children}</SidebarWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
