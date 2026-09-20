/* =========================================================
   screens/PasswordToggle.jsx — password field with eye toggle
   ========================================================= */
import { useState } from 'react';

export default function PasswordField(props) {
  const [show, setShow] = useState(false);
  const { value, onChange, placeholder, ariaLabel, autocomplete, autoFocus } = props;
  return (
    <div className="pw-field">
      <input
        type={show ? 'text' : 'password'}
        className="pw-input"
        value={value}
        placeholder={placeholder || 'At least 6 characters'}
        autocomplete={autocomplete || 'off'}
        aria-label={ariaLabel || 'Password'}
        autoFocus={autoFocus}
        onChange={onChange}
      />
      <button
        type="button"
        className="pw-toggle"
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        onClick={function () { setShow(!show); }}
      >
        {show ? '\uD83D\uDE48' : '\uD83D\uDC41'}
      </button>
    </div>
  );
}
