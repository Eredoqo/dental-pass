import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface Connection {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  acceptedAt: string | null;
  clinic: { id: string; name: string; city: string; country: string };
}

/** /p/clinics — connected clinics with the revoke action (Workflow O). */
export function ClinicsPage() {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<Connection[]>('/me/connections').then(setConnections).catch((e) => setError(e.message));
  }
  useEffect(load, []);

  async function revoke(connection: Connection) {
    const sure = confirm(
      `Revoke ${connection.clinic.name}'s access to your passport?\n\n` +
        'They will immediately lose access. Your records stay in your passport.',
    );
    if (!sure) return;
    try {
      await api(`/me/connections/${connection.id}/revoke`, { method: 'POST' });
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (error) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Error: {error}</main>;
  if (!connections) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 720, margin: '4vh auto', fontFamily: 'system-ui' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link to="/p">Dashboard</Link> · <Link to="/p/passport">Passport</Link>
      </nav>
      <h1>My clinics</h1>
      {connections.length === 0 && <p>No clinic connections yet.</p>}
      <table cellPadding={8}>
        <tbody>
          {connections.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td>
                <strong>{c.clinic.name}</strong>
                <div style={{ color: '#555', fontSize: 14 }}>
                  {c.clinic.city}, {c.clinic.country}
                </div>
              </td>
              <td>{c.status}</td>
              <td>
                {c.status === 'ACTIVE' && (
                  <button onClick={() => revoke(c)} style={{ color: 'crimson' }}>
                    Revoke access
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
