import { CSSProperties, ReactNode } from 'react';

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`card ${className}`} style={style}>{children}</div>;
}

export function CardPad({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="card-pad" style={style}>{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <div className="card-title">{children}</div>;
}
