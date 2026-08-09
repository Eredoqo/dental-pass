import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface Me {
  user: { fullName: string; email: string };
  patient: unknown | null;
  memberships: { clinic: { id: string; name: string }; roles: string[] }[];
}

export function PatientDashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Me>('/me').then(setMe).catch((e) => setError(e.message));
  }, []);

  if (error) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Error: {error}</main>;
  if (!me) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 720, margin: '5vh auto', fontFamily: 'system-ui' }}>
      <h1>Welcome, {me.user.fullName}</h1>
      <p>
        <Link to="/p/passport">My Dental Passport</Link> · <Link to="/p/clinics">My clinics</Link>
      </p>
      {me.memberships.length > 0 && (
        <p>
          You are also a member of {me.memberships.map((m) => m.clinic.name).join(', ')} —{' '}
          <Link to="/c">switch to clinic portal</Link>
        </p>
      )}
    </main>
  );
}
