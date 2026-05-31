import { useState, useEffect } from 'react';
import { Settings, Key, User, Save, Check, Eye, EyeOff, LogOut } from 'lucide-react';
import { api, auth } from '../api';

export default function Configuracion({ user, onLogout }) {
  const [config, setConfig] = useState({});
  const [pjnUsuario, setPjnUsuario] = useState('');
  const [pjnPassword, setPjnPassword] = useState('');
  const [showPjnPass, setShowPjnPass] = useState(false);
  const [savedPjn, setSavedPjn] = useState(false);
  const [savingPjn, setSavingPjn] = useState(false);

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState('');
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    api.getConfig().then(c => {
      setConfig(c);
      setPjnUsuario(c.pjn_usuario || '');
    });
  }, []);

  async function savePjn(e) {
    e.preventDefault();
    if (!pjnUsuario.trim()) return;
    setSavingPjn(true);
    await api.setPjnCredentials(pjnUsuario.trim(), pjnPassword || undefined);
    setSavedPjn(true);
    setSavingPjn(false);
    setPjnPassword('');
    setTimeout(() => setSavedPjn(false), 3000);
  }

  async function changePassword(e) {
    e.preventDefault();
    if (!newPass || newPass.length < 4) { setPassMsg('Minimo 4 caracteres'); return; }
    setSavingPass(true);
    setPassMsg('');
    const result = await auth.changePassword({ current_password: currentPass, new_password: newPass });
    if (result.error) setPassMsg(result.error);
    else { setPassMsg('Password actualizada'); setCurrentPass(''); setNewPass(''); }
    setSavingPass(false);
  }

  async function handleLogout() {
    await auth.logout();
    auth.setToken(null);
    onLogout();
  }

  return (
    <div className="fade-in" style={{ maxWidth: 640 }}>
      <h2 className="page-title"><Settings size={22} /> Configuracion</h2>

      {/* PJN Credentials */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <h3><Key size={16} /> Credenciales PJN</h3>
        </div>
        <div className="panel-body">
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
            Tu CUIL y password del Portal PJN. Se usan para sincronizar expedientes automaticamente.
          </p>
          <form onSubmit={savePjn}>
            <div className="form-field">
              <label>CUIL (usuario PJN)</label>
              <input
                value={pjnUsuario}
                onChange={e => setPjnUsuario(e.target.value)}
                placeholder="20123456789"
                autoComplete="username"
              />
            </div>
            <div className="form-field">
              <label>Password PJN</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPjnPass ? 'text' : 'password'}
                  value={pjnPassword}
                  onChange={e => setPjnPassword(e.target.value)}
                  placeholder={config.pjn_password ? '••••••••  (ya configurada)' : 'Ingresa tu password PJN'}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPjnPass(!showPjnPass)}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}
                >
                  {showPjnPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={savingPjn || !pjnUsuario.trim()}>
              {savedPjn ? <><Check size={14} /> Guardado</> : <><Save size={14} /> {savingPjn ? 'Guardando...' : 'Guardar credenciales'}</>}
            </button>
          </form>
        </div>
      </div>

      {/* Account */}
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <h3><User size={16} /> Cuenta</h3>
        </div>
        <div className="panel-body">
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
            <div><strong>Email:</strong> {user?.email}</div>
            <div><strong>Nombre:</strong> {user?.nombre}</div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>Cambiar password de Betti</p>
          <form onSubmit={changePassword}>
            <div className="form-row">
              <div className="form-field">
                <label>Password actual</label>
                <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} autoComplete="current-password" />
              </div>
              <div className="form-field">
                <label>Nueva password</label>
                <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} minLength={4} autoComplete="new-password" />
              </div>
            </div>
            {passMsg && <div style={{ fontSize: 12, color: passMsg.includes('actualizada') ? 'var(--green)' : 'var(--red)', marginBottom: 8 }}>{passMsg}</div>}
            <button type="submit" className="btn-ghost" disabled={savingPass || !currentPass || !newPass}>
              <Save size={14} /> Cambiar password
            </button>
          </form>
        </div>
      </div>

      {/* Logout */}
      <button className="btn-ghost" onClick={handleLogout} style={{ color: 'var(--red)' }}>
        <LogOut size={14} /> Cerrar sesion
      </button>
    </div>
  );
}
