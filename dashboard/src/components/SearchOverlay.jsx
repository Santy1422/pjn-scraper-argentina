import { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { Search, FolderOpen } from 'lucide-react';
import { badgeClass } from '../utils';

export default function SearchOverlay({ onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef();
  const timerRef = useRef();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const data = await api.busquedaGlobal(query);
      setResults(data);
      setSelected(0);
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  function onKeyDown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) { onSelect(results[selected].id); }
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        <div className="search-input-wrap">
          <Search size={18} />
          <input
            ref={inputRef}
            placeholder="Buscar expediente por carátula, clave o dependencia..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <kbd>ESC</kbd>
        </div>
        {results.length > 0 && (
          <div className="search-results">
            {results.map((r, i) => (
              <div
                key={r.id}
                className={`search-result ${i === selected ? 'selected' : ''}`}
                onClick={() => onSelect(r.id)}
                onMouseEnter={() => setSelected(i)}
              >
                <FolderOpen size={14} />
                <div className="sr-info">
                  <div className="sr-clave">{r.clave} <span className={badgeClass(r.situacion)}>{r.situacion}</span></div>
                  <div className="sr-caratula">{r.caratula}</div>
                </div>
                <span className="sr-jur">{r.jurisdiccion_codigo}</span>
              </div>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="search-empty">Sin resultados para "{query}"</div>
        )}
      </div>
    </div>
  );
}
