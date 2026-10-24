import React from 'react';
import { useModalStyle } from '../useModalStyle';
import { useThemeExtras } from '../useThemeExtras';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';

export interface ThemedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: React.ReactNode;
}

const SIZE: Record<ButtonVariant, string> = {
  primary: 'px-4 py-2 text-sm font-black uppercase tracking-wide',
  secondary: 'px-3 py-1.5 text-xs font-black uppercase',
  danger: 'px-4 py-2 text-sm font-black uppercase tracking-wide',
  ghost: 'px-3 py-1.5 text-xs font-black uppercase underline-offset-4 hover:underline',
  icon: 'p-2',
};

/** One button family for the whole game: the variant says what it does, the theme says how it looks. */
export const ThemedButton: React.FC<ThemedButtonProps> = ({
  variant = 'primary',
  icon,
  className = '',
  children,
  type = 'button',
  ...rest
}) => {
  const { style } = useModalStyle();
  const extras = useThemeExtras();
  const look: Record<ButtonVariant, string> = {
    primary: style.btnGo,
    secondary: style.btnMove,
    danger: extras.danger,
    ghost: `${style.text} opacity-80 hover:opacity-100`,
    icon: style.btnMove,
  };
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-50 ${SIZE[variant]} ${look[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
};

export interface BadgeProps {
  children: React.ReactNode;
  tone?: 'chip' | 'quiet';
  className?: string;
}

/** Counter or status label (exhausted, stunned, round 3). */
export const Badge: React.FC<BadgeProps> = ({ children, tone = 'chip', className = '' }) => {
  const { style } = useModalStyle();
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-mini font-black uppercase ${
        tone === 'chip' ? style.chip : `${style.inset} ${style.text}`
      } ${className}`}
    >
      {children}
    </span>
  );
};

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** On/off setting. The track uses the theme's primary colour when on. */
export const ThemedSwitch: React.FC<SwitchProps> = ({ checked, onChange, label }) => {
  const { style } = useModalStyle();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 shrink-0 cursor-pointer transition-colors ${
        checked ? style.tileSelected : style.inset
      } !scale-100`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 w-4 h-4 transition-all ${style.chip} ${
          checked ? 'left-[26px]' : 'left-0.5'
        }`}
      />
    </button>
  );
};

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export const ThemedTextField: React.FC<FieldProps> = ({ label, className = '', ...rest }) => {
  const { style } = useModalStyle();
  const extras = useThemeExtras();
  return (
    <label className={`flex flex-col gap-1 text-mini font-black uppercase ${style.muted}`}>
      {label}
      <input className={`${extras.field} ${className}`} {...rest} />
    </label>
  );
};

export interface SelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: readonly { value: string; label: string }[];
}

export const ThemedSelect: React.FC<SelectFieldProps> = ({
  label,
  options,
  className = '',
  ...rest
}) => {
  const { style } = useModalStyle();
  const extras = useThemeExtras();
  return (
    <label className={`flex flex-col gap-1 text-mini font-black uppercase ${style.muted}`}>
      {label}
      <select className={`${extras.field} ${className}`} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
};
