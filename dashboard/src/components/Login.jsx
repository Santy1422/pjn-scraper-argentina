import { useState } from 'react';
import { Scale, LogIn, UserPlus } from 'lucide-react';
import { auth } from '../api';

export default function Login({ needsSetup, onAuth }) {
  const [mode, setMode] = useState(needsSetup ? 'setup' : 'login');
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let result;
      if (mode === 'setup') {
        result = await auth.setup({ email, nombre, password });
      } else {
        result = await auth.login({ email, password });
      }
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

        <h2 className="login-title">
          {mode === 'setup' ? 'Crear cuenta' : 'Iniciar sesion'}
        </h2>
        {mode === 'setup' && (
          <p className="login-subtitle">Primera vez? Crea tu usuario para empezar.</p>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          {mode === 'setup' && (
            <div className="form-field">
              <label>Nombre</label>
              <input
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Tu nombre"
                autoComplete="name"
              />
            </div>
          )}
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
              autoComplete={mode === 'setup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {mode === 'setup' ? <UserPlus size={16} /> : <LogIn size={16} />}
            {loading ? 'Cargando...' : mode === 'setup' ? 'Crear cuenta' : 'Ingresar'}
          </button>
        </form>

        {!needsSetup && mode === 'setup' && (
          <button className="login-switch" onClick={() => setMode('login')}>
            Ya tengo cuenta
          </button>
        )}
      </div>
    </div>
  );
}
