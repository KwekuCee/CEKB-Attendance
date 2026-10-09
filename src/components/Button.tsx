import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'inverse';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={`cekb-button cekb-button--${variant} ${className}`} {...props} />
  ),
);
Button.displayName = 'Button';