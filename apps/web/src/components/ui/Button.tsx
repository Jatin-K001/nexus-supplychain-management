import { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'outline' | 'ghost' | 'success' | 'danger' | 'teal';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'default' | 'sm';
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  success: 'btn-success',
  danger: 'btn-danger',
  teal: 'btn-teal',
};

export function Button({ variant = 'primary', size = 'default', loading = false, className = '', children, disabled, ...rest }: Props) {
  const cls = ['btn', variantClass[variant], size === 'sm' ? 'btn-sm' : '', className].filter(Boolean).join(' ');
  return (
    <button
      className={cls}
      disabled={disabled || loading}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, opacity: loading ? 0.75 : 1, transition: 'opacity 0.15s, transform 0.08s', ...rest.style }}
      onMouseDown={(e) => { if (!loading && !disabled) e.currentTarget.style.transform = 'scale(0.97)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {loading && (
        <span
          style={{
            width: 13, height: 13, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'currentColor',
            display: 'inline-block', animation: 'nexus-spin 0.7s linear infinite', flexShrink: 0,
          }}
        />
      )}
      {children}
    </button>
  );
}
