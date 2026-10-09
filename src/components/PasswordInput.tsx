import React, { useState } from 'react';

/** Password box with a show/hide ("peek") toggle. Accepts every normal input prop. */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
  ({ className = '', ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="password-field">
        <input ref={ref} type={visible ? 'text' : 'password'} className={className} {...props} />
        <button
          type="button"
          className="password-peek"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          tabIndex={props.tabIndex}
        >
          <span className="material-symbols-outlined">{visible ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';
