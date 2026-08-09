import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SUGGESTED_TREATMENT_TYPES } from '@dental-passport/shared';
import { api } from '../../lib/api';

interface Connection {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  invitedEmail: string;
  patient: { id: string; user: { fullName: string; email: string } } | null;
}

interface TimelineItem {
  id: string;
  date: string;
  type: string;
  status: string;
  clinic: { name: string } | null;
  procedures: { type: string; teeth: number[]; implant: { manufacturer: string | null; model: string | null } | null }[];
}

interface PassportView {
  patient: { id?: string; fullName: string; dateOfBirth: string | null; medicalNotes: string | null };
  overview: { counts: { treatments: number; implants: number; documents: number } };
  timeline: TimelineItem[];
}

/** Workflow I — manual draft treatment entry. Verification is a separate, explicit step. */
function AddTreatmentForm({ clinicId, patientId, onSaved }: { clinicId: string; patientId: string; onSaved: () => void }) {
  const [type, setType] = useState<string>(SUGGESTED_TREATMENT_TYPES[0]);
  const [date, setDate] = useState('');
  const [procedureType, setProcedureType] = useState('');
  const [teeth, setTeeth] = useState('');
  const [withImplant, setWithImplant] = useState(false);
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const teethList = teeth
      .split(',')
      .map((t) => parseInt(t.trim(), 10))
      .filter((n) => !isNaN(n));
    try {
      await api(`/patients/${patientId}/treatments`, {
        method: 'POST',
        clinicId,
        body: {
          type,
          date,
          procedures: procedureType
            ? [
                {
                  type: procedureType,
                  toothScope: teethList.length === 0 ? 'UNKNOWN' : teethList.length === 1 ? 'SINGLE' : 'MULTIPLE',
                  teeth: teethList,
                  implant: withImplant
                    ? { manufacturer: manufacturer || undefined, model: model || undefined, lotNumber: lotNumber || undefined }
                    : undefined,
                },
              ]
            : [],
        },
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={submit} style={{ background: '#f6f8fa', padding: 12, marginTop: 12, fontSize: 14 }}>
      <strong>Add treatment (draft)</strong>
      <div>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {SUGGESTED_TREATMENT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>{' '}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div style={{ marginTop: 4 }}>
        <input placeholder="Procedure (e.g. Implant placement)" value={procedureType} onChange={(e) => setProcedureType(e.target.value)} />{' '}
        <input placeholder="Teeth (FDI, e.g. 14, 15)" value={teeth} onChange={(e) => setTeeth(e.target.value)} style={{ width: 140 }} />{' '}
        <label>
          <input type="checkbox" checked={withImplant} onChange={(e) => setWithImplant(e.target.checked)} /> implant
        </label>
      </div>
      {withImplant && (
        <div style={{ marginTop: 4 }}>
          <input placeholder="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />{' '}
          <input placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />{' '}
          <input placeholder="Lot number" value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
        </div>
      )}
      <button type="submit" style={{ marginTop: 6 }}>Save draft</button>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
    </form>
  );
}

/** /c/patients — connections list, invite form, and inline passport view (Workflows B & E). */
export function PatientsPage({ clinicId }: { clinicId: string }) {
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [email, setEmail] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [selected, setSelected] = useState<PassportView | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
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
      setSelectedPatientId(patientId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function verifyTreatment(treatmentId: string) {
    setError(null);
    try {
      await api(`/treatments/${treatmentId}/verify`, { method: 'POST', clinicId });
      if (selectedPatientId) await openPassport(selectedPatientId);
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
            <div key={t.id} style={{ fontSize: 14, marginBottom: 8 }}>
              <strong>{new Date(t.date).toLocaleDateString()}</strong> — {t.type}{' '}
              <span style={{ color: t.status === 'DRAFT' ? '#b60' : '#2a6' }}>({t.status.toLowerCase()})</span>
              {t.clinic && ` · ${t.clinic.name}`}
              {t.status === 'DRAFT' && (
                <>
                  {' '}
                  <button onClick={() => verifyTreatment(t.id)}>Verify</button>
                </>
              )}
              {t.procedures.map((p, i) => (
                <div key={i} style={{ color: '#555', marginLeft: 12 }}>
                  {p.type}
                  {p.teeth.length > 0 && ` — teeth ${p.teeth.join(', ')}`}
                  {p.implant && ` · implant ${[p.implant.manufacturer, p.implant.model].filter(Boolean).join(' ')}`}
                </div>
              ))}
            </div>
          ))}
          {selectedPatientId && (
            <AddTreatmentForm
              clinicId={clinicId}
              patientId={selectedPatientId}
              onSaved={() => openPassport(selectedPatientId)}
            />
          )}
        </section>
      )}
    </main>
  );
}
