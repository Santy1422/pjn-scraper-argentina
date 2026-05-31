# PJN Scraper Argentina

**Tu estudio juridico en piloto automatico.** Sincroniza expedientes del Poder Judicial de la Nacion (PJN), recibe alertas de movimientos y genera escritos judiciales desde plantillas profesionales.

---

## Que hace?

- **Sincronizacion automatica** con el Portal PJN (expedientes, actuaciones, cedulas, despachos)
- **Dashboard** con ultimos movimientos agrupados por expediente
- **Generador de escritos** con 8+ plantillas judiciales (apelacion, revocatoria, contestacion, prueba, etc.) y auto-fill de datos del expediente
- **Descarga de PDFs** de cedulas y despachos
- **Busqueda rapida** por caratula, clave o dependencia (Cmd+K)
- **Notas y tareas** por expediente
- **Export a PDF** con formato judicial (margenes A4, Times New Roman)
- **Multi-usuario** con credenciales PJN por cuenta

## Stack

| Componente | Tecnologia |
|---|---|
| Backend | Node.js + Express |
| Scraping | Playwright (headless Chromium) |
| Base de datos | SQLite (better-sqlite3, WAL mode) |
| Frontend | React 19 + Vite |
| PDF | Playwright PDF rendering |
| Deploy | Docker / Railway |

## Setup local

```bash
# Clonar
git clone https://github.com/tu-usuario/pjn-scraper-argentina.git
cd pjn-scraper-argentina

# Instalar dependencias
npm install
cd dashboard && npm install && npx vite build && cd ..

# Instalar Chromium para Playwright
npx playwright install chromium

# Iniciar
npm start
# -> http://localhost:3000
```

Al abrir por primera vez, crea tu cuenta. Despues ve a **Configuracion** e ingresa tu CUIL y password del Portal PJN.

## Deploy en Railway

1. Crea un proyecto en [Railway](https://railway.app)
2. Conecta tu repo de GitHub
3. Agrega un **Volume** montado en `/data`
4. Railway detecta el `Dockerfile` automaticamente
5. Listo - la DB y PDFs persisten en el volumen

**Variables de entorno** (se configuran automaticamente):
- `PORT` - Railway lo asigna
- `DATA_DIR=/data` - ya esta en el Dockerfile

## Deploy frontend en Vercel (opcional)

Si queres el frontend separado:

```bash
cd dashboard
```

1. Conecta la carpeta `dashboard/` a Vercel
2. Agrega la variable `VITE_API_URL=https://tu-backend.railway.app`
3. Deploy

## Plantillas de escritos incluidas

| Plantilla | Uso |
|---|---|
| Pedido de pronto despacho | Art. 167 CPCCN |
| Recurso de apelacion | Arts. 242/244 CPCCN |
| Contestacion de demanda | Art. 356 CPCCN |
| Recurso de revocatoria | Art. 238 CPCCN |
| Expresion de agravios | Art. 259 CPCCN |
| Ofrecimiento de prueba | Art. 367 CPCCN |
| Alegato | Art. 482 CPCCN |
| Escrito generico | Formato libre |

## Licencia

MIT

---

Hecho con cafe y mate en Argentina.
