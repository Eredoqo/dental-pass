import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';

interface Overview {
  counts: { treatments: number; implants: number; documents: number; warranties: number };
  lastTreatment: { type: string; date: string } | null;
}

interface TimelineItem {
  id: string;
  date: string;
  type: string;
  notes: string | null;
  clinic: { name: string; city: string } | null;
  verifiedAt: string | null;
  procedures: { type: string; teeth: number[]; implant: unknown | null }[];
}

/** /p/passport — timeline-first personal record (Stage 2 §22 design rule). */
export function PassportPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api<Overview>('/me/passport'), api<TimelineItem[]>('/me/passport/timeline')])
      .then(([o, t]) => {
        setOverview(o);
        setTimeline(t);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Error: {error}</main>;
  if (!overview || !timeline) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 720, margin: '4vh auto', fontFamily: 'system-ui' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link to="/p">Dashboard</Link> · <Link to="/p/clinics">My clinics</Link>
      </nav>
      <h1>My Dental Passport</h1>
      <p>
        {overview.counts.treatments} treatments · {overview.counts.implants} implants ·{' '}
        {overview.counts.documents} documents · {overview.counts.warranties} warranties
      </p>

      <h2>Timeline</h2>
      {timeline.length === 0 && <p>No verified records yet. Records appear here after your clinic adds and verifies them.</p>}
      {timeline.map((item) => (
        <div key={item.id} style={{ borderLeft: '3px solid #2a6', padding: '4px 12px', marginBottom: 16 }}>
          <strong>{new Date(item.date).toLocaleDateString()}</strong> — {item.type}
          <div style={{ color: '#555', fontSize: 14 }}>
            {item.clinic ? `${item.clinic.name}, ${item.clinic.city}` : 'Unknown clinic'}
            {item.verifiedAt && ' · verified'}
          </div>
          {item.procedures.map((p, i) => (
            <div key={i} style={{ fontSize: 14 }}>
              {p.type}
              {p.teeth.length > 0 && ` — teeth ${p.teeth.join(', ')}`}
              {p.implant != null && ' · implant'}
            </div>
          ))}
          {item.notes && <div style={{ fontSize: 14, fontStyle: 'italic' }}>{item.notes}</div>}
        </div>
      ))}
    </main>
  );
}
