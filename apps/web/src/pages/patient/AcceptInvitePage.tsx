import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';

/**
 * /invite/:token — the landing page of the invitation email link (Workflow B).
 * If the visitor is signed in, accept directly; otherwise let them register or
 * sign in first, then accept.
 */
export function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
  }, []);

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ clinic: { name: string } }>(`/invitations/${token}/accept`, { method: 'POST' });
      alert(`Connected with ${result.clinic.name}!`);
      navigate('/p');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const result =
      mode === 'register'
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
        : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await accept();
  }

  if (session === null) return <main style={{ fontFamily: 'system-ui', padding: 24 }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 400, margin: '8vh auto', fontFamily: 'system-ui' }}>
      <h1>Clinic invitation</h1>
      <p>A clinic invited you to connect on Dental Passport.</p>

      {session ? (
        <button onClick={accept} disabled={busy}>
          {busy ? 'Connecting…' : 'Accept invitation'}
        </button>
      ) : (
        <>
          <form onSubmit={onSubmit}>
            {mode === 'register' && (
              <label>
                Full name
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ width: '100%' }} />
              </label>
            )}
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%' }} />
            </label>
            <label>
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ width: '100%' }} />
            </label>
            <button type="submit" disabled={busy}>
              {mode === 'register' ? 'Create account & accept' : 'Sign in & accept'}
            </button>
          </form>
          <p>
            {mode === 'register' ? (
              <>Already have an account? <a href="#" onClick={() => setMode('login')}>Sign in</a></>
            ) : (
              <>New here? <a href="#" onClick={() => setMode('register')}>Create an account</a></>
            )}
          </p>
        </>
      )}
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      <p>
        <Link to="/login">Back to login</Link>
      </p>
    </main>
  );
}
