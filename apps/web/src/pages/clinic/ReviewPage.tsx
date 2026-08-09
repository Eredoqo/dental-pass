import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LOW_CONFIDENCE_THRESHOLD } from '@dental-passport/shared';
import { api } from '../../lib/api';

interface QueueItem {
  id: string;
  filename: string;
  category: string;
  status: string;
  patientId: string;
  patientName: string;
}

interface ExtractionItem {
  id: string;
  itemType: string;
  fieldPath: string;
  proposedValue: unknown;
  confidence: number | null;
}

interface ExtractionView {
  document: { id: string; filename: string; category: string; status: string; patientId: string };
  extraction: { id: string; status: string; provider: string; model: string; error: string | null; items: ExtractionItem[] };
}

interface TreatmentDraft {
  type: string;
  date: string;
  notes: string;
  procedureType: string;
  teeth: string;
  implant: { manufacturer: string; system: string; model: string; diameterMm: string; lengthMm: string; lotNumber: string } | null;
}

function itemValue(items: ExtractionItem[], path: string): unknown {
  return items.find((i) => i.fieldPath === path)?.proposedValue ?? null;
}

/** Prefill editable drafts from the extraction items (AI proposes, human decides). */
function buildDrafts(view: ExtractionView): TreatmentDraft[] {
  const items = view.extraction.items;
  if (view.document.category === 'IMPLANT_DOCUMENT') {
    const tooth = itemValue(items, 'tooth');
    return [
      {
        type: 'Implant placement',
        date: (itemValue(items, 'placementDate') as string) ?? '',
        notes: '',
        procedureType: 'Implant placement',
        teeth: tooth != null ? String(tooth) : '',
        implant: {
          manufacturer: (itemValue(items, 'manufacturer') as string) ?? '',
          system: (itemValue(items, 'system') as string) ?? '',
          model: (itemValue(items, 'model') as string) ?? '',
          diameterMm: itemValue(items, 'diameterMm') != null ? String(itemValue(items, 'diameterMm')) : '',
          lengthMm: itemValue(items, 'lengthMm') != null ? String(itemValue(items, 'lengthMm')) : '',
          lotNumber: (itemValue(items, 'lotNumber') as string) ?? '',
        },
      },
    ];
  }
  const indices = new Set(
    items
      .map((i) => /^treatments\[(\d+)\]/.exec(i.fieldPath)?.[1])
      .filter((x): x is string => x !== undefined),
  );
  const fallbackDate = (itemValue(items, 'documentDate') as string) ?? '';
  return [...indices].map((i) => ({
    type: (itemValue(items, `treatments[${i}].type`) as string) ?? '',
    date: ((itemValue(items, `treatments[${i}].date`) as string) ?? fallbackDate) || '',
    notes: (itemValue(items, `treatments[${i}].notes`) as string) ?? '',
    procedureType: (itemValue(items, `treatments[${i}].type`) as string) ?? '',
    teeth: ((itemValue(items, `treatments[${i}].teeth`) as number[]) ?? []).join(', '),
    implant: null,
  }));
}

const lowConfidence = (item: ExtractionItem) =>
  item.confidence !== null && item.confidence < LOW_CONFIDENCE_THRESHOLD;

/** Workflow H — clinic-wide AI review queue + side-by-side verification screen. */
export function ReviewPage({ clinicId }: { clinicId: string }) {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [view, setView] = useState<ExtractionView | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<TreatmentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadQueue() {
    api<QueueItem[]>('/ai/review-queue', { clinicId }).then(setQueue).catch((e) => setError(e.message));
  }
  useEffect(loadQueue, [clinicId]);

  async function open(item: QueueItem) {
    setError(null);
    setView(null);
    try {
      const v = await api<ExtractionView>(`/documents/${item.id}/extraction`, { clinicId });
      const dl = await api<{ url: string }>(`/patients/${item.patientId}/documents/${item.id}/download`, { clinicId });
      setView(v);
      setDocUrl(dl.url);
      setDrafts(buildDrafts(v));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function retry(item: QueueItem) {
    try {
      await api(`/documents/${item.id}/retry-extraction`, { method: 'POST', clinicId });
      loadQueue();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submit(reject: boolean) {
    if (!view) return;
    setBusy(true);
    setError(null);
    try {
      const treatments = reject
        ? []
        : drafts.map((d) => {
            const teeth = d.teeth.split(',').map((t) => parseInt(t.trim(), 10)).filter((n) => !isNaN(n));
            return {
              type: d.type,
              date: d.date,
              notes: d.notes || undefined,
              procedures: d.procedureType
                ? [
                    {
                      type: d.procedureType,
                      toothScope: teeth.length === 0 ? 'UNKNOWN' : teeth.length === 1 ? 'SINGLE' : 'MULTIPLE',
                      teeth,
                      implant: d.implant
                        ? {
                            manufacturer: d.implant.manufacturer || undefined,
                            system: d.implant.system || undefined,
                            model: d.implant.model || undefined,
                            diameterMm: d.implant.diameterMm ? parseFloat(d.implant.diameterMm) : undefined,
                            lengthMm: d.implant.lengthMm ? parseFloat(d.implant.lengthMm) : undefined,
                            lotNumber: d.implant.lotNumber || undefined,
                            placementDate: d.date || undefined,
                          }
                        : undefined,
                    },
                  ]
                : [],
            };
          });
      await api(`/extractions/${view.extraction.id}/review`, {
        method: 'POST',
        clinicId,
        body: {
          itemDecisions: view.extraction.items.map((i) => ({ id: undefined, itemId: i.id, decision: reject ? 'REJECTED' : 'ACCEPTED' })),
          treatments,
        },
      });
      setView(null);
      setDocUrl(null);
      loadQueue();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!queue) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 1100, margin: '3vh auto', fontFamily: 'system-ui' }}>
      <nav style={{ marginBottom: 16 }}>
        <Link to="/c">Clinic dashboard</Link> · <Link to="/c/patients">Patients</Link>
      </nav>
      <h1>AI review queue</h1>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {queue.length === 0 && <p>Nothing waiting for review.</p>}
      <table cellPadding={6}>
        <tbody>
          {queue.map((q) => (
            <tr key={q.id} style={{ borderBottom: '1px solid #eee', fontSize: 14 }}>
              <td>{q.patientName}</td>
              <td>{q.filename}</td>
              <td>{q.category.toLowerCase().replace(/_/g, ' ')}</td>
              <td style={{ color: q.status === 'FAILED' ? 'crimson' : q.status === 'REVIEW_REQUIRED' ? '#b60' : '#555' }}>
                {q.status.toLowerCase().replace(/_/g, ' ')}
              </td>
              <td>
                {q.status === 'REVIEW_REQUIRED' && <button onClick={() => open(q)}>Review</button>}
                {q.status === 'FAILED' && <button onClick={() => retry(q)}>Retry</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {view && (
        <section style={{ display: 'flex', gap: 16, marginTop: 24 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3>Original document</h3>
            {docUrl && <iframe src={docUrl} style={{ width: '100%', height: 520, border: '1px solid #ccc' }} title="document" />}
          </div>
          <div style={{ flex: 1 }}>
            <h3>
              AI extracted information{' '}
              <span style={{ fontSize: 13, fontWeight: 'normal', background: '#fff3cd', padding: '2px 6px' }}>
                unverified — from {view.extraction.provider}
              </span>
            </h3>
            <p style={{ fontSize: 13, color: '#555' }}>
              Fields marked ⚠ had low AI confidence. Check everything against the original before confirming.
            </p>
            {view.extraction.items.filter(lowConfidence).length > 0 && (
              <p style={{ fontSize: 13 }}>
                ⚠ low confidence: {view.extraction.items.filter(lowConfidence).map((i) => i.fieldPath).join(', ')}
              </p>
            )}
            {drafts.map((d, di) => (
              <div key={di} style={{ border: '1px solid #ddd', padding: 10, marginBottom: 10, fontSize: 14 }}>
                <input value={d.type} onChange={(e) => setDrafts(drafts.map((x, i) => (i === di ? { ...x, type: e.target.value } : x)))} placeholder="Treatment type" />{' '}
                <input type="date" value={d.date} onChange={(e) => setDrafts(drafts.map((x, i) => (i === di ? { ...x, date: e.target.value } : x)))} />
                <div style={{ marginTop: 4 }}>
                  <input value={d.procedureType} onChange={(e) => setDrafts(drafts.map((x, i) => (i === di ? { ...x, procedureType: e.target.value } : x)))} placeholder="Procedure" />{' '}
                  <input value={d.teeth} onChange={(e) => setDrafts(drafts.map((x, i) => (i === di ? { ...x, teeth: e.target.value } : x)))} placeholder="Teeth (FDI)" style={{ width: 110 }} />
                </div>
                {d.implant && (
                  <div style={{ marginTop: 4 }}>
                    {(['manufacturer', 'system', 'model', 'diameterMm', 'lengthMm', 'lotNumber'] as const).map((f) => (
                      <input
                        key={f}
                        value={d.implant![f]}
                        onChange={(e) =>
                          setDrafts(drafts.map((x, i) => (i === di ? { ...x, implant: { ...x.implant!, [f]: e.target.value } } : x)))
                        }
                        placeholder={f}
                        style={{ width: 100, marginRight: 4, marginBottom: 4 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => submit(false)} disabled={busy || drafts.length === 0}>
              {busy ? 'Saving…' : 'Confirm — add to passport'}
            </button>{' '}
            <button onClick={() => submit(true)} disabled={busy} style={{ color: 'crimson' }}>
              Reject all
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
