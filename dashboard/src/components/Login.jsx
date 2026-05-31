import { useState } from 'react';
import { Scale, LogIn } from 'lucide-react';
import { auth } from '../api';

export default function Login({ onAuth }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await auth.login({ email, password });
      if (result.error) {
        setError(result.error);
      } else if (result.token) {
        auth.setToken(result.token);
        onAuth(result.user);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon"><Scale size={22} /></div>
          <div>
            <div className="brand-name" style={{ fontSize: 22 }}>Betti</div>
            <div className="brand-sub">PJN Scraper Argentina</div>
          </div>
        </div>

        <h2 className="login-title">Iniciar sesion</h2>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="form-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={4}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Cargando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
