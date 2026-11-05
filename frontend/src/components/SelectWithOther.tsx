import { useState } from 'react';

interface Option {
  value: string;
  label: string;
}
interface SelectWithOtherProps {
  id: string;
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

/** “Other” is a UI choice only; send the custom text as the actual field value. */
export function SelectWithOther({
  id,
  label,
  options,
  value,
  onChange,
  error,
}: SelectWithOtherProps) {
  const [choice, setChoice] = useState(() => {
    if (options.some((option) => option.value === value)) return value;
    return value ? 'other' : '';
  });
  const isOther = choice === 'other';
  const errorId = error ? `${id}-error` : undefined;

  function select(value: string) {
    setChoice(value);
    // Clear custom text when changing choices so a hidden input is never submitted.
    onChange(value === 'other' ? '' : value);
  }

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name={`${id}-choice`}
        value={choice}
        onChange={(event) => select(event.target.value)}
        required
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        <option value="other">Other</option>
      </select>
      {isOther && (
        <div className="other-field">
          <label htmlFor={`${id}-other`}>Other {label.toLowerCase()}</label>
          <input
            id={`${id}-other`}
            name={id}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={100}
            required
            autoFocus
            aria-invalid={Boolean(error)}
            aria-describedby={errorId}
          />
        </div>
      )}
      {error && (
        <span id={`${id}-error`} className="error field-error">
          {error}
        </span>
      )}
    </div>
  );
}
