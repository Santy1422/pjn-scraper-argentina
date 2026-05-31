import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Save, Download, FileText, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignJustify, List, ListOrdered, Type, Trash2 } from 'lucide-react';

// Plantillas: solo el cuerpo del escrito.
// La caratula (datos abogada + expediente) y firma se inyectan automaticamente en el PDF.
const PLANTILLAS = [
  {
    id: 'alego_bien_probado',
    tipo: 'alegato',
    nombre: 'Alego bien probado',
    cat: 'principales',
    html: (exp) => `
<h1>ALEGO BIEN PROBADO</h1>
<p>Sr. Juez:</p>
<p>I.- Que vengo oportunamente en plazo legal a ofrecer la prueba que a mi parte corresponde.</p>
<h2>II.- <u>OBJETO</u>:</h2>
<p>Que atento al Estado de autos y conforme lo dispuesto por el art 94 L.O, vengo en legal tiempo y forma acreditar los extremos invocados en el Recurso de Apelación incoado, ante el Dictamen médico Jurisdiccional, ya que el mismo causo un Gravamen Irreparable, a mi patrocinado lo Dictaminado por la SRT CM Jurisdiccional, VULNERANDO EL BAREMO LEY 24557, solicitando se haga lugar al mismo, teniendo en consideración los Agravios manifestados por esta parte, la misma con expresa imposición de costas al demandado.</p>
<h2>III.- <u>DE LA DEMANDA</u></h2>
<p>[Desarrollar los hechos de la demanda: fecha del accidente, circunstancias, diagnóstico, alta médica, incapacidad]</p>
<h2>IV.- <u>DE LA CONTESTACION DE LA DEMANDA</u></h2>
<p>[Desarrollar la contestación: reconocimiento del accidente, impugnaciones, etc.]</p>
<h2>V.- <u>DE LA PRUEBA</u></h2>
<p>DOCUMENTAL: Se adjuntó al expediente, la que se acompaña en el mismo.</p>
<p>[Desarrollar prueba pericial médica, conclusiones del perito, grado de incapacidad]</p>
<h2>VI.- RESERVA DEL CASO FEDERAL.</h2>
<p>Para el improbable caso de que se dictara un fallo a favor de la demandada, formulo reserva desde este momento de plantear el caso Federal por ante la Corte Suprema de Justicia de la Nación, por conculcar los derechos de propiedad, debido proceso, arbitrariedad de sentencia y demás normas de dicho pronunciamiento contrarié.</p>
<h2>VII.- PETITORIO.</h2>
<p>Por lo expuesto, de V.S solicito:</p>
<p>Se me tenga presentado en tiempo y forma el alegato.</p>
<p>Se condene al pago de capital más Intereses solicitados en el acápite pertinente. Oportunamente de haga lugar a la demanda impetrada, con expresa imposición de costas al demandado.</p>
`,
  },
  {
    id: 'pronto_despacho',
    tipo: 'pronto_despacho',
    nombre: 'Pedido de pronto despacho',
    cat: 'tramite',
    html: () => `
<h1>SOLICITA PRONTO DESPACHO</h1>
<p>Sr. Juez:</p>
<p>I.- Que habiendo transcurrido un plazo razonable sin que se haya dictado resolución, vengo por el presente a solicitar se provea el pronto despacho de las actuaciones pendientes, conforme lo dispuesto por el art. 167 del CPCCN.</p>
`,
  },
  {
    id: 'apelacion',
    tipo: 'recurso',
    nombre: 'Recurso de apelación',
    cat: 'recursos',
    html: () => `
<h1>INTERPONE RECURSO DE APELACION</h1>
<p>Sr. Juez:</p>
<h2>I. OBJETO</h2>
<p>Que vengo en legal tiempo y forma a interponer recurso de apelación contra la resolución de fecha [FECHA], por considerar que la misma causa un agravio irreparable a los derechos de mi mandante, conforme lo dispuesto por los arts. 242 y 244 del CPCCN.</p>
<h2>II. FUNDAMENTOS</h2>
<p>[Desarrollar los agravios que causa la resolución apelada]</p>
<h2>III. PETITORIO</h2>
<p>Por todo lo expuesto, solicito a V.S.:</p>
<p>1. Se tenga por interpuesto el recurso de apelación en legal tiempo y forma.</p>
<p>2. Se conceda el recurso con efecto [suspensivo/devolutivo].</p>
<p>3. Se eleven los autos al Superior para su resolución.</p>
`,
  },
  {
    id: 'contestacion',
    tipo: 'contestacion',
    nombre: 'Contestación de demanda',
    cat: 'principales',
    html: () => `
<h1>CONTESTA DEMANDA</h1>
<p>Sr. Juez:</p>
<h2>I. OBJETO</h2>
<p>Que vengo en legal tiempo y forma a contestar la demanda incoada, por los fundamentos de hecho y de derecho que a continuación se exponen.</p>
<h2>II. NEGATIVA</h2>
<p>Niego todos y cada uno de los hechos expuestos en el escrito de demanda que no sean objeto de expreso reconocimiento en el presente responde, en los términos del art. 356 inc. 1° del CPCCN.</p>
<h2>III. HECHOS</h2>
<p>[Exponer la versión de los hechos]</p>
<h2>IV. DERECHO</h2>
<p>[Fundamentación jurídica]</p>
<h2>V. PRUEBA</h2>
<p>[Ofrecimiento de prueba]</p>
<h2>VI. PETITORIO</h2>
<p>Por todo lo expuesto, solicito a V.S.:</p>
<p>1. Se tenga por contestada la demanda en legal tiempo y forma.</p>
<p>2. Se rechace la demanda en todas sus partes, con costas.</p>
`,
  },
  {
    id: 'revocatoria',
    tipo: 'revocatoria',
    nombre: 'Recurso de revocatoria',
    cat: 'recursos',
    html: () => `
<h1>INTERPONE RECURSO DE REVOCATORIA</h1>
<p>Sr. Juez:</p>
<h2>I. OBJETO</h2>
<p>Que vengo a interponer recurso de revocatoria (reposición) contra la providencia de fecha [FECHA], conforme lo dispuesto por el art. 238 del CPCCN.</p>
<h2>II. FUNDAMENTOS</h2>
<p>[Explicar por qué la providencia es errónea o injusta]</p>
<h2>III. PETITORIO</h2>
<p>Por lo expuesto, solicito se revoque la providencia recurrida y se provea conforme a derecho.</p>
`,
  },
  {
    id: 'revocatoria_apelacion',
    tipo: 'recurso',
    nombre: 'Revocatoria con apelación en subsidio',
    cat: 'recursos',
    html: () => `
<h1><u>INTERPONE RECURSO DE REVOCATORIA CON APELACION EN SUBSIDIO</u></h1>
<p>Señor Juez:</p>
<p>I.- Que vengo en legal tiempo y forma a interponer recurso de revocatoria contra la sentencia interlocutoria notificada el [FECHA] a esta parte, de los presentes actuados y a brindar las razones con sustento jurisdiccional y doctrinario que avalan tal petición. Ello a fin de que el Sr Juez revoque por contrario imperium, el dictamen efectuado, ya que en su dictamen es falaz, los dichos, donde considera que los agravios de esta parte no superan los presupuestos que alude el art 116 de la L.O.</p>
<p>[Desarrollar los fundamentos del recurso: por qué el dictamen es erróneo, qué incapacidad se determinó vs. la real, jurisprudencia aplicable]</p>
<h2><u>Apela en subsidio:</u></h2>
<p>Para el hipotético y poco probable supuesto que V.S. determinara no hacer lugar a lo solicitado en el presente, dejo interpuesta la apelación en subsidio.</p>
<p>Atento a lo ut supra expresado, y a los fines y efectos; solicito a VS conceda el recurso interpuesto y se ordene la elevación del expediente a la Excelentísima Cámara del Fuero.</p>
<h2>II.- RESERVA DEL CASO FEDERAL</h2>
<p>Para el supuesto que no se hiciera lugar a lo arriba manifestado, dejo formalmente planteado el CASO FEDERAL del art. 14 de la ley 48, para ocurrir por ante la Corte Suprema de Justicia de la Nación por la vía del Recurso Extraordinario Federal y por vía de sentencia arbitraria, por encontrarse en juego en estas actuaciones garantías y derechos amparados por la Constitución Nacional.</p>
<h2><u>III. PETITORIO</u></h2>
<p>Por todo lo hasta aquí expuesto, de VS solicito:</p>
<p>a. Tenga por interpuesto el recurso de revocación en tiempo y forma y revoque por contrario imperio lo citado precedentemente.</p>
<p>b. Tenga presente el recurso de Revocatoria en subsidio.</p>
<p>c. Tenga por interpuesto el recurso de Revocatoria con apelación en Subsidio y en su oportunidad, se eleven los autos al superior para que entienda en la apelación interpuesta.</p>
<p>d. Déjese sin efecto el defectuoso decisorio, revoque por contraium imperio. Continúen los autos conforme ley 27348, téngase presente el Recurso interpuesto.</p>
`,
  },
  {
    id: 'agravios',
    tipo: 'recurso',
    nombre: 'Expresión de agravios',
    cat: 'recursos',
    html: () => `
<h1>EXPRESA AGRAVIOS</h1>
<p>Excma. Cámara:</p>
<h2>I. OBJETO</h2>
<p>Que vengo en legal tiempo y forma a expresar agravios contra la sentencia de primera instancia de fecha [FECHA], conforme lo dispuesto por el art. 259 del CPCCN.</p>
<h2>II. PRIMER AGRAVIO</h2>
<p>[Desarrollar]</p>
<h2>III. SEGUNDO AGRAVIO</h2>
<p>[Desarrollar]</p>
<h2>IV. PETITORIO</h2>
<p>Por lo expuesto, solicito se revoque la sentencia apelada y se haga lugar a [lo solicitado], con costas.</p>
`,
  },
  {
    id: 'prueba',
    tipo: 'prueba',
    nombre: 'Ofrecimiento de prueba',
    cat: 'principales',
    html: () => `
<h1>OFRECE PRUEBA</h1>
<p>Sr. Juez:</p>
<h2>I. DOCUMENTAL</h2>
<p>Se tengan por presentados los documentos acompañados con el escrito de demanda/contestación.</p>
<h2>II. INFORMATIVA</h2>
<p>Se libre oficio a [ENTIDAD] a fin de que informe [OBJETO].</p>
<h2>III. TESTIMONIAL</h2>
<p>Se cite a declarar a los siguientes testigos:</p>
<p>1. [NOMBRE], DNI [N°], domicilio [DOMICILIO]</p>
<p>2. [NOMBRE], DNI [N°], domicilio [DOMICILIO]</p>
<h2>IV. PERICIAL</h2>
<p>Se designe perito [médico/contador/calígrafo] de oficio a fin de que dictamine sobre [PUNTOS DE PERICIA].</p>
`,
  },
  {
    id: 'acredita_personeria',
    tipo: 'tramite',
    nombre: 'Acredita personería',
    cat: 'tramite',
    html: () => `
<h1>ACREDITA PERSONERIA</h1>
<p>Sr. Juez:</p>
<p>I.- Que vengo a acreditar personería en el carácter de letrada apoderada/patrocinante de la parte actora, conforme poder que en original se acompaña.</p>
<p>II.- Que constituyo domicilio procesal en Capital Federal y domicilio electrónico 27218616521-1.</p>
<h2>PETITORIO</h2>
<p>Por lo expuesto, solicito a V.S.:</p>
<p>1. Se me tenga por presentada, por parte y por constituido el domicilio procesal indicado.</p>
<p>2. Se tenga por acreditada la personería invocada.</p>
`,
  },
  {
    id: 'generico',
    tipo: 'generico',
    nombre: 'Escrito genérico',
    cat: 'tramite',
    html: () => `
<h1>[TITULO DEL ESCRITO]</h1>
<p>Sr. Juez:</p>
<h2>I. OBJETO</h2>
<p>[Desarrollar el objeto del escrito]</p>
<h2>II. FUNDAMENTOS</h2>
<p>[Desarrollar]</p>
<h2>III. PETITORIO</h2>
<p>Por lo expuesto, solicito a V.S. [lo que se solicita].</p>
`,
  },
];

export default function GeneradorEscrito({ expediente, borrador, onBack, onSaved }) {
  const editorRef = useRef(null);
  const [titulo, setTitulo] = useState(borrador?.titulo || '');
  const [tipo, setTipo] = useState(borrador?.tipo || 'escrito');
  const [saving, setSaving] = useState(false);
  const [showPlantillas, setShowPlantillas] = useState(!borrador);
  const [downloading, setDownloading] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [pendingHtml, setPendingHtml] = useState(null);

  useEffect(() => {
    if (borrador?.contenido_html && editorRef.current) {
      editorRef.current.innerHTML = borrador.contenido_html;
    }
  }, [borrador]);

  // Apply pending HTML when editor mounts after plantilla selection
  useEffect(() => {
    if (pendingHtml && editorRef.current) {
      editorRef.current.innerHTML = pendingHtml;
      setPendingHtml(null);
    }
  }, [pendingHtml, showPlantillas]);

  function usarPlantilla(plantilla) {
    const html = plantilla.html(expediente);
    setPendingHtml(html);
    setTitulo(plantilla.nombre + ' — ' + expediente.clave);
    setTipo(plantilla.tipo);
    setShowPlantillas(false);
  }

  function execCmd(cmd, value = null) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  }

  const guardar = useCallback(async () => {
    if (!titulo.trim()) return;
    setSaving(true);
    const contenido_html = editorRef.current?.innerHTML || '';
    const token = localStorage.getItem('betti_token');
    try {
      if (borrador?.id) {
        await fetch(`/api/borradores/${borrador.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ titulo, tipo, contenido_html }),
        });
      } else {
        const res = await fetch(`/api/expedientes/${expediente.id}/borradores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ titulo, tipo, contenido_html }),
        });
        const saved = await res.json();
        if (saved.id && onSaved) onSaved(saved);
      }
      setLastSaved(new Date().toLocaleTimeString('es-AR'));
    } catch (e) {
      console.error('Error guardando:', e);
    }
    setSaving(false);
  }, [titulo, tipo, borrador, expediente.id, onSaved]);

  // Auto-save every 30s
  useEffect(() => {
    if (!titulo.trim()) return;
    const interval = setInterval(guardar, 30000);
    return () => clearInterval(interval);
  }, [guardar, titulo]);

  async function descargarPdf() {
    if (!editorRef.current) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem('betti_token');
      const res = await fetch('/api/generar-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          html: editorRef.current.innerHTML,
          titulo: titulo || 'escrito',
          expediente: { clave: expediente.clave, caratula: expediente.caratula, dependencia: expediente.dependencia },
        }),
      });
      if (!res.ok) throw new Error('Error generando PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (titulo || 'escrito').replace(/\s+/g, '_') + '.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Error generando PDF: ' + e.message);
    }
    setDownloading(false);
  }

  // Plantilla selector
  if (showPlantillas && !borrador) {
    const categorias = {
      'Escritos principales': PLANTILLAS.filter(p => p.cat === 'principales'),
      'Recursos': PLANTILLAS.filter(p => p.cat === 'recursos'),
      'Trámite': PLANTILLAS.filter(p => p.cat === 'tramite'),
    };
    return (
      <div className="fade-in gen-selector">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Volver al expediente
        </button>
        <div className="gen-header">
          <FileText size={28} className="gen-header-icon" />
          <div>
            <h2>Redactar escrito judicial</h2>
            <p className="gen-exp-info">{expediente.clave} — {expediente.caratula?.substring(0, 80)}</p>
            <p className="gen-exp-dep">{expediente.dependencia}</p>
          </div>
        </div>
        <p className="gen-subtitle">Elegi una plantilla. Los datos del expediente se completan automaticamente.</p>
        {Object.entries(categorias).map(([cat, items]) => (
          <div key={cat} className="gen-cat">
            <h3 className="gen-cat-title">{cat}</h3>
            <div className="plantillas-grid">
              {items.map(p => (
                <div key={p.id} className="plantilla-card" onClick={() => usarPlantilla(p)}>
                  <FileText size={22} />
                  <span className="plantilla-nombre">{p.nombre}</span>
                  <span className="plantilla-tipo">{p.tipo}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="fade-in editor-container">
      <div className="editor-topbar">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={14} /> Volver
        </button>
        <div className="editor-title-row">
          <input
            className="editor-title-input"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Título del escrito..."
          />
          <select className="editor-tipo-select" value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="escrito">Escrito</option>
            <option value="demanda">Demanda</option>
            <option value="contestacion">Contestación</option>
            <option value="recurso">Recurso</option>
            <option value="apelacion">Apelación</option>
            <option value="alegato">Alegato</option>
            <option value="prueba">Prueba</option>
            <option value="pronto_despacho">Pronto despacho</option>
            <option value="revocatoria">Revocatoria</option>
            <option value="generico">Genérico</option>
          </select>
        </div>
        <div className="editor-actions">
          {lastSaved && <span style={{ fontSize: 11, color: 'var(--text3)' }}>Guardado {lastSaved}</span>}
          <button className="btn-ghost" onClick={guardar} disabled={saving || !titulo.trim()}>
            <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button className="btn-primary" onClick={descargarPdf} disabled={downloading}>
            <Download size={14} /> {downloading ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="editor-toolbar">
        <button className="tb-btn" onClick={() => execCmd('bold')} title="Negrita"><Bold size={15} /></button>
        <button className="tb-btn" onClick={() => execCmd('italic')} title="Cursiva"><Italic size={15} /></button>
        <button className="tb-btn" onClick={() => execCmd('underline')} title="Subrayado"><Underline size={15} /></button>
        <div className="tb-sep" />
        <button className="tb-btn" onClick={() => execCmd('justifyLeft')} title="Izquierda"><AlignLeft size={15} /></button>
        <button className="tb-btn" onClick={() => execCmd('justifyCenter')} title="Centro"><AlignCenter size={15} /></button>
        <button className="tb-btn" onClick={() => execCmd('justifyFull')} title="Justificar"><AlignJustify size={15} /></button>
        <div className="tb-sep" />
        <button className="tb-btn" onClick={() => execCmd('insertUnorderedList')} title="Lista"><List size={15} /></button>
        <button className="tb-btn" onClick={() => execCmd('insertOrderedList')} title="Lista numerada"><ListOrdered size={15} /></button>
        <div className="tb-sep" />
        <select className="tb-select" onChange={e => { execCmd('formatBlock', e.target.value); e.target.value = ''; }}>
          <option value="">Formato</option>
          <option value="p">Párrafo</option>
          <option value="h1">Título</option>
          <option value="h2">Subtítulo</option>
        </select>
        <select className="tb-select" onChange={e => { if (e.target.value) execCmd('fontSize', e.target.value); e.target.value = ''; }}>
          <option value="">Tamaño</option>
          <option value="2">Chico</option>
          <option value="3">Normal</option>
          <option value="4">Grande</option>
          <option value="5">Muy grande</option>
        </select>
      </div>

      {/* Editor area - styled like a page */}
      <div className="editor-page-wrapper">
        <div
          ref={editorRef}
          className="editor-page"
          contentEditable
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}

export { PLANTILLAS };
