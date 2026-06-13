import React from 'react';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      {children && <div className="topbar-right">{children}</div>}
    </div>
  );
}
