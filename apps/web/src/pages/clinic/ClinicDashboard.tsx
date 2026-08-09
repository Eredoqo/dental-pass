import { FormEvent, useEffect, useState } from 'react';
import { api } from '../../lib/api';

interface Me {
  memberships: { clinic: { id: string; name: string }; roles: string[] }[];
}

export function ClinicDashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [country, setCountry] = useState('AL');
  const [city, setCity] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Me>('/me').then(setMe).catch((e) => setError(e.message));
  }, []);

  async function createClinic(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/clinics', { method: 'POST', body: { name: clinicName, country, city } });
      const refreshed = await api<Me>('/me');
      setMe(refreshed);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!me) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;

  if (me.memberships.length === 0) {
    return (
      <main style={{ maxWidth: 480, margin: '5vh auto', fontFamily: 'system-ui' }}>
        <h1>Create your clinic</h1>
        <form onSubmit={createClinic}>
          <label>
            Clinic name
            <input value={clinicName} onChange={(e) => setClinicName(e.target.value)} required style={{ width: '100%' }} />
          </label>
          <label>
            Country (ISO code)
            <input value={country} onChange={(e) => setCountry(e.target.value)} required maxLength={2} style={{ width: '100%' }} />
          </label>
          <label>
            City
            <input value={city} onChange={(e) => setCity(e.target.value)} required style={{ width: '100%' }} />
          </label>
          {error && <p style={{ color: 'crimson' }}>{error}</p>}
          <button type="submit">Create clinic</button>
        </form>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '5vh auto', fontFamily: 'system-ui' }}>
      <h1>{me.memberships[0].clinic.name}</h1>
      <p>Roles: {me.memberships[0].roles.join(', ')}</p>
      <p>
        <a href="/c/patients">Patients</a> · <a href="/c/review">AI review queue</a>
      </p>
    </main>
  );
}
