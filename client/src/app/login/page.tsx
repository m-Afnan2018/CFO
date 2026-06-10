'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.replace('/');
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || 'Invalid credentials');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--indigo)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 800, margin: '0 auto 14px',
          }}>G</div>
          <div style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text)' }}>Ganesyx CFO</div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '5px' }}>
            Sign in to access the dashboard
          </div>
        </div>

        {/* Form card */}
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '28px 24px',
        }}>
          <form onSubmit={handleSubmit} autoComplete="on">
            <div className="form-field">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="form-field" style={{ marginBottom: error ? '14px' : '20px' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', padding: '4px',
                  }}
                  tabIndex={-1}
                >
                  <i className={`ti ${showPw ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: '15px' }} />
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                fontSize: '12px', color: 'var(--red)', marginBottom: '16px',
                padding: '8px 12px', background: 'var(--red-dim)', borderRadius: '8px',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <i className="ti ti-alert-circle" style={{ fontSize: '13px', flexShrink: 0 }} />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-p"
              style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '14px' }}
              disabled={loading || !username.trim() || !password}
            >
              {loading
                ? <><i className="ti ti-loader-2" style={{ fontSize: '14px' }} />Signing in…</>
                : <><i className="ti ti-login" style={{ fontSize: '14px' }} />Sign In</>}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: 'var(--text3)' }}>
          Ganesyx Pvt Ltd — Internal CFO Dashboard
        </div>
      </div>
    </div>
  );
}
