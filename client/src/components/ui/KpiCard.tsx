'use client';
import styles from './KpiCard.module.css';

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
          <div
            className={`kpi-ico ${styles.kpiIco}`}
            style={{ '--kpi-icon-bg': iconBg } as React.CSSProperties}
          >
            <i
              className={`ti ${icon} ${styles.kpiIcoIcon}`}
              style={{ '--kpi-icon-color': iconColor } as React.CSSProperties}
            />
          </div>
        )}
      </div>
      <div
        className={`kpi-value ${styles.kpiValue}`}
        style={{ '--kpi-value-color': valueColor } as React.CSSProperties}
      >
        {value}
      </div>
      {sub !== undefined && (
        <div className={`kpi-change ${subCls}${!subCls ? ` ${styles.subDefault}` : ''}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
