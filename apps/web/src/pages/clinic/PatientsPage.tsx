import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface Connection {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  invitedEmail: string;
  patient: { id: string; user: { fullName: string; email: string } } | null;
}

interface PassportView {
  patient: { fullName: string; dateOfBirth: string | null; medicalNotes: string | null };
  overview: { counts: { treatments: number; implants: number; documents: number } };
  timeline: { id: string; date: string; type: string; status: string; clinic: { name: string } | null }[];
}

/** /c/patients — connections list, invite form, and inline passport view (Workflows B & E). */
export function PatientsPage({ clinicId }: { clinicId: string }) {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [email, setEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<PassportView | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<Connection[]>('/connections', { clinicId }).then(setConnections).catch((e) => setError(e.message));
  }
  useEffect(load, [clinicId]);

  async function invite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInviteUrl(null);
    try {
      const result = await api<{ invitationUrl: string }>('/connections', {
        method: 'POST',
        body: { email },
        clinicId,
      });
      setInviteUrl(result.invitationUrl);
      setEmail('');
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function openPassport(patientId: string) {
    setError(null);
    try {
      setSelected(await api<PassportView>(`/patients/${patientId}/passport`, { clinicId }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function cancelInvite(id: string) {
    await api(`/connections/${id}`, { method: 'DELETE', clinicId });
    load();
  }

  if (!connections) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 860, margin: '4vh auto', fontFamily: 'system-ui' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link to="/c">Clinic dashboard</Link>
      </nav>
      <h1>Patients</h1>

      <form onSubmit={invite} style={{ marginBottom: 8 }}>
        <input
          type="email"
          placeholder="patient@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />{' '}
        <button type="submit">Invite patient</button>
      </form>
      {inviteUrl && (
        <p style={{ background: '#eefaf0', padding: 8, fontSize: 14 }}>
          Invitation created. Share this link with the patient:
          <br />
          <code>{inviteUrl}</code>{' '}
          <button onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy</button>
        </p>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <table cellPadding={8} style={{ width: '100%' }}>
        <tbody>
          {connections.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td>
                <strong>{c.patient?.user.fullName ?? c.invitedEmail}</strong>
                <div style={{ color: '#555', fontSize: 14 }}>{c.patient?.user.email ?? 'invitation sent'}</div>
              </td>
              <td>{c.status}</td>
              <td>
                {c.status === 'ACTIVE' && c.patient && (
                  <button onClick={() => openPassport(c.patient!.id)}>View passport</button>
                )}
                {c.status === 'PENDING' && <button onClick={() => cancelInvite(c.id)}>Cancel invite</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <section style={{ marginTop: 24, border: '1px solid #ccc', padding: 16 }}>
          <h2>{selected.patient.fullName}</h2>
          {selected.patient.medicalNotes && <p>Notes: {selected.patient.medicalNotes}</p>}
          <p>
            {selected.overview.counts.treatments} treatments · {selected.overview.counts.implants} implants ·{' '}
            {selected.overview.counts.documents} documents
          </p>
          <h3>Timeline</h3>
          {selected.timeline.length === 0 && <p>No records yet.</p>}
          {selected.timeline.map((t) => (
            <div key={t.id} style={{ fontSize: 14, marginBottom: 6 }}>
              {new Date(t.date).toLocaleDateString()} — {t.type} ({t.status.toLowerCase()})
              {t.clinic && ` · ${t.clinic.name}`}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
