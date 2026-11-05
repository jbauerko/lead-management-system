import { SelectWithOther } from '../components/SelectWithOther';
import { useRef, useState, type FormEvent, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useApi } from '../api/useApi';
import { type Lead, type LeadCreate } from '../api/work';

export function NewLead() {
  const { user } = useAuth();
  const api = useApi();
  const navigate = useNavigate();
  const [values, setValues] = useState<LeadCreate>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    region: '',
    category: '',
    description: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LeadCreate, string>>>({});
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  // Keep input values, error IDs, and accessibility attributes together.
  function field(key: keyof LeadCreate) {
    return {
      id: key,
      name: key,
      value: values[key],
      'aria-invalid': Boolean(errors[key]),
      'aria-describedby': errors[key] ? `${key}-error` : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValues((v) => ({ ...v, [key]: event.target.value })),
    };
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) {
      return;
    }
    // Validate before sending; the API still validates every submitted field.
    const next: typeof errors = {};
    for (const key of Object.keys(values) as (keyof LeadCreate)[])
      if (!values[key].trim()) {
        next[key] = 'Please fill in this field.';
      }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      next.email = 'Enter a valid email address.';
    }
    setErrors(next);
    setFailure('');
    if (Object.keys(next).length) {
      const firstField = Object.keys(next)[0];
      const input =
        document.getElementById(`${firstField}-other`) ?? document.getElementById(firstField);
      input?.focus();
      return;
    }
    // Keep the form intact on failure and prevent duplicate POSTs while saving.
    submitting.current = true;
    setBusy(true);
    try {
      const lead = await api<Lead>('/leads', { method: 'POST', body: JSON.stringify(values) });
      navigate(`/plaintiff/leads/${lead.id}`, { replace: true, state: { submitted: true } });
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Unable to submit your inquiry.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const error = (key: keyof LeadCreate) =>
    errors[key] && (
      <span className="error field-error" id={`${key}-error`}>
        {errors[key]}
      </span>
    );
  return (
    <section className="new-lead-page">
      <Link className="back-link" to="/plaintiff/leads">
        ← All leads
      </Link>
      <h1>Submit a lead</h1>
      <form className="card intake-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          <div>
            <label htmlFor="name">Full name</label>
            <input {...field('name')} autoComplete="name" maxLength={200} required />
            {error('name')}
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input {...field('email')} type="email" autoComplete="email" maxLength={320} required />
            {error('email')}
          </div>
          <SelectWithOther
            id="region"
            label="Region"
            value={values.region}
            onChange={(region) => setValues((current) => ({ ...current, region }))}
            error={errors.region}
            options={[
              { value: 'NY', label: 'New York' },
              { value: 'CA', label: 'California' },
            ]}
          />
          <SelectWithOther
            id="category"
            label="Category"
            value={values.category}
            onChange={(category) => setValues((current) => ({ ...current, category }))}
            error={errors.category}
            options={[
              { value: 'personal_injury', label: 'Personal injury' },
              { value: 'employment', label: 'Employment' },
            ]}
          />
        </div>
        <label htmlFor="description">Describe your situation</label>
        <textarea {...field('description')} rows={7} maxLength={20000} required />
        {error('description')}
        {failure && (
          <p role="alert" className="error">
            {failure}
          </p>
        )}
        <div className="actions form-actions">
          <button className="button button-primary" disabled={busy}>
            {busy ? 'Submitting…' : 'Submit lead'}
          </button>
          <Link className="button button-quiet" to="/plaintiff/leads">
            Cancel
          </Link>
        </div>
      </form>
    </section>
  );
}
