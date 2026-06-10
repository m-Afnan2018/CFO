'use client';

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  subCls?: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  valueColor?: string;
}

export default function KpiCard({
  label, value, sub, subCls = '', icon, iconBg, iconColor, valueColor,
}: KpiCardProps) {
  return (
    <div className="kpi">
      <div className="kpi-label">
        {label}
        {icon && (
          <div className="kpi-ico" style={iconBg ? { background: iconBg } : {}}>
            <i className={`ti ${icon}`} style={iconColor ? { color: iconColor } : {}} />
          </div>
        )}
      </div>
      <div className="kpi-value" style={valueColor ? { color: valueColor } : {}}>
        {value}
      </div>
      {sub !== undefined && (
        <div className={`kpi-change ${subCls}`} style={!subCls ? { color: 'var(--text2)' } : {}}>
          {sub}
        </div>
      )}
    </div>
  );
}
