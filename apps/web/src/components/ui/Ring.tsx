import { CSSProperties } from 'react';

interface Props {
  percent: number; // 0-100
  label: string;
  color?: string; // any CSS color, defaults to --teal per reference
  size?: 'default' | 'sm';
  caption?: string;
}

export function Ring({ percent, label, color, size = 'default', caption }: Props) {
  const style = {
    '--rp': percent,
    ...(color ? { '--rc': color } : {}),
  } as CSSProperties;

  return (
    <div>
      <div className={`ring ${size === 'sm' ? 'ring-sm' : ''}`} style={style}>
        <div className="ring-inner">
          <div className="ring-num">{Math.round(percent)}</div>
          <div className="ring-label">{label}</div>
        </div>
      </div>
      {caption && <div className="ring-cap">{caption}</div>}
    </div>
  );
}
