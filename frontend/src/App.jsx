import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, PawPrint, CalendarDays, History, Settings,
  LogOut, ChevronLeft, ChevronRight, Stethoscope, Database,
} from 'lucide-react';
import { api, urlFoto, urlCarnet } from './api.js';

const hoyLocal = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en tu zona horaria

function saludoDelDia() {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// Mensajes de éxito/error se anuncian a lectores de pantalla (aria-live),
// no solo se muestran en color.
function Msg({ msg }) {
  if (!msg) return null;
  const esError = msg.tipo === 'error';
  return (
    <div className={`message ${msg.tipo}`} role={esError ? 'alert' : 'status'} aria-live={esError ? 'assertive' : 'polite'}>
      {msg.texto}
    </div>
  );
}

function PieClinica({ clinica }) {
  if (!clinica) return null;
  return (
    <footer className="pie-clinica">
      <p><strong>{clinica.doctor}</strong> — Céd. Prof. {clinica.cedula}</p>
      <p>{clinica.direccion} · Tel. {clinica.telefono}</p>
    </footer>
  );
}

// ---------------- SKELETONS DE CARGA ----------------
// Placeholder visual mientras llega la respuesta del servidor, en vez de
// dejar la pantalla vacía o solo un "Cargando...". aria-hidden porque no
// aporta información real; el contenido real sí se anuncia al llegar.
function Skeleton({ width = '100%', height = '14px', style }) {
  return <span className="skeleton" style={{ width, height, ...style }} aria-hidden="true" />;
}
function FilaSkeleton({ cols }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => <td key={i}><Skeleton /></td>)}
    </tr>
  );
}

// ---------------- MODAL DE CONFIRMACIÓN ----------------
function ModalConfirmar({ titulo, texto, onCancelar, onConfirmar }) {
  const cancelarRef = useRef(null);

  useEffect(() => {
    cancelarRef.current?.focus(); // el foco entra al modal; "Cancelar" es la acción segura por defecto
    const onKey = (e) => { if (e.key === 'Escape') onCancelar(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancelar]);

  return (
    <div className="modal-overlay" onClick={onCancelar}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" onClick={(e) => e.stopPropagation()}>
        <h2 id="modal-titulo">{titulo}</h2>
        <p>{texto}</p>
        <div className="modal-actions">
          <button ref={cancelarRef} className="btn secondary" onClick={onCancelar}>Cancelar</button>
          <button className="btn danger" onClick={onConfirmar}>Salir</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- LOGIN ----------------
function Login({ onOk }) {
  const [f, setF] = useState({ usuario: '', clave: '' });
  const [msg, setMsg] = useState(null);
  const enviar = async (e) => {
    e.preventDefault();
    try { await api('login', { method: 'POST', body: f }); onOk(); }
    catch (err) { setMsg({ tipo: 'error', texto: err.message }); }
  };
  return (
    <form className="card login" onSubmit={enviar}>
      <h2>Iniciar sesión</h2>
      <label htmlFor="login-usuario">Usuario</label>
      <input id="login-usuario" value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })} required />
      <label htmlFor="login-clave">Contraseña</label>
      <input id="login-clave" type="password" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} required />
      <button className="btn" type="submit">Entrar</button>
      <Msg msg={msg} />
    </form>
  );
}

// ---------------- DASHBOARD ----------------
function Dashboard() {
  const [d, setD] = useState(null);         // null = cargando
  const [citasHoy, setCitasHoy] = useState(null);

  useEffect(() => {
    api('resumen').then(setD).catch(() => setD({}));
    const hoy = hoyLocal();
    api('citas', { params: { desde: hoy, hasta: hoy, estado: 'PROGRAMADA' } })
      .then(setCitasHoy).catch(() => setCitasHoy([]));
  }, []);

  const cargando = d === null || citasHoy === null;
  const cajas = [
    ['totalPacientes', 'Pacientes'], ['citasHoy', 'Citas hoy'],
    ['citasSemana', 'Citas próx. 7 días'], ['citasProgramadas', 'Programadas'],
  ];

  return (
    <>
      <div className="card">
        {cargando ? (
          <>
            <Skeleton width="200px" height="22px" style={{ marginBottom: 8 }} />
            <Skeleton width="260px" height="14px" style={{ marginBottom: 16 }} />
          </>
        ) : (
          <>
            <p className="saludo">{saludoDelDia()} 👋</p>
            <p className="subsaludo">
              {citasHoy.length === 0 ? 'No tienes citas programadas para hoy.'
                : `Tienes ${citasHoy.length} cita${citasHoy.length === 1 ? '' : 's'} programada${citasHoy.length === 1 ? '' : 's'} para hoy.`}
            </p>
          </>
        )}
        <div className="stats">
          {cajas.map(([k, t]) => (
            <div className="stat-box" key={k}>
              {cargando ? <Skeleton width="40px" height="28px" style={{ margin: '0 auto 6px' }} /> : <div className="num">{d[k] ?? '-'}</div>}
              <div className="label">{t}</div>
            </div>
          ))}
        </div>
      </div>

      {!cargando && citasHoy.length > 0 && (
        <div className="card">
          <h2>Citas de hoy</h2>
          <TablaCitas citas={citasHoy} />
        </div>
      )}
    </>
  );
}

// ---------------- PACIENTES ----------------
const vacioPac = { nombre: '', especie: '', propietario: '', telefono: '', notas: '' };

const TIPOS_REGISTRO = [
  ['CONSULTA', 'Consulta'],
  ['VACUNA', 'Vacuna'],
  ['TRATAMIENTO', 'Tratamiento'],
  ['CIRUGIA', 'Cirugía'],
  ['OTRO', 'Otro'],
];

function Expediente({ paciente, onCerrar }) {
  const vacioReg = () => ({ fecha: hoyLocal(), tipo: 'CONSULTA', peso: '', descripcion: '' });
  const [registros, setRegistros] = useState(null); // null = cargando
  const [msg, setMsg] = useState(null);
  const [f, setF] = useState(vacioReg());
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const cargar = () => {
    setRegistros(null);
    api('registros', { params: { idPaciente: paciente.id } }).then(setRegistros).catch(() => setRegistros([]));
  };
  useEffect(cargar, [paciente.id]);

  const guardar = async (e) => {
    e.preventDefault();
    try {
      const r = await api('registros', { method: 'POST', body: { ...f, idPaciente: paciente.id } });
      setMsg({ tipo: 'success', texto: r.mensaje });
      setF(vacioReg());
      cargar();
    } catch (err) { setMsg({ tipo: 'error', texto: err.message }); }
  };

  return (
    <div className="card">
      <h2>Expediente de {paciente.nombre}</h2>
      <p className="subsaludo">{paciente.especie || 'Especie no indicada'} · Propietario: {paciente.propietario || '-'}</p>

      <a className="btn" href={urlCarnet(paciente.id)} target="_blank" rel="noopener noreferrer">
        Imprimir carnet (PDF)
      </a>
      <button className="btn secondary" onClick={onCerrar}>Cerrar expediente</button>

      <h3>Agregar registro</h3>
      <form onSubmit={guardar}>
        <label htmlFor="reg-fecha">Fecha *</label>
        <input id="reg-fecha" type="date" value={f.fecha} onChange={cambiar('fecha')} required />
        <label htmlFor="reg-tipo">Tipo *</label>
        <select id="reg-tipo" value={f.tipo} onChange={cambiar('tipo')} required>
          {TIPOS_REGISTRO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <label htmlFor="reg-peso">Peso en kg (opcional)</label>
        <input id="reg-peso" type="number" step="0.01" min="0" value={f.peso} onChange={cambiar('peso')} />
        <label htmlFor="reg-descripcion">Descripción *</label>
        <textarea id="reg-descripcion" rows="3" value={f.descripcion} onChange={cambiar('descripcion')}
          placeholder="Lo que quede anotado en el expediente y en el carnet impreso..." required />
        <button className="btn" type="submit">Guardar registro</button>
        <Msg msg={msg} />
      </form>

      <h3>Historial</h3>
      {registros === null ? (
        <table><tbody>{[1, 2, 3].map((i) => <FilaSkeleton key={i} cols={4} />)}</tbody></table>
      ) : registros.length === 0 ? (
        <p>Sin registros todavía.</p>
      ) : (
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Peso</th><th>Descripción</th></tr></thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id}>
                <td>{r.fecha}</td><td>{r.tipo}</td><td>{r.peso != null ? `${r.peso} kg` : '-'}</td><td>{r.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Pacientes() {
  const [f, setF] = useState(vacioPac);
  const [foto, setFoto] = useState(null);
  const [especies, setEspecies] = useState([]);
  const [msg, setMsg] = useState(null);
  const [q, setQ] = useState('');
  const [lista, setLista] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [pidiendoBaja, setPidiendoBaja] = useState(null); // { id, nombre } | null
  const [expediente, setExpediente] = useState(null); // paciente | null
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const buscar = () => {
    if (!q.trim()) { setLista([]); setBuscando(false); return; }
    setBuscando(true);
    api('pacientes', { params: { q } }).then(setLista).catch(() => setLista([])).finally(() => setBuscando(false));
  };

  useEffect(() => { api('especies').then(setEspecies).catch(() => {}); }, []);
  useEffect(() => {
    if (!q.trim()) { setLista([]); setBuscando(false); return; }
    setBuscando(true);
    const t = setTimeout(buscar, 250);
    return () => clearTimeout(t);
  }, [q]);

  const guardar = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    if (foto) fd.append('foto', foto);
    try {
      const r = await api('pacientes', { method: 'POST', body: fd });
      setMsg({ tipo: 'success', texto: r.mensaje });
      setF(vacioPac); setFoto(null);
    } catch (err) { setMsg({ tipo: 'error', texto: err.message }); }
  };

  const confirmarBaja = async () => {
    const { id } = pidiendoBaja;
    setPidiendoBaja(null);
    try {
      await api('paciente_baja', { method: 'POST', body: { id } });
      setLista((prev) => prev.filter((p) => p.id !== id)); // desaparece de la lista al instante
    } catch (err) { setMsg({ tipo: 'error', texto: err.message }); }
  };

  if (expediente) {
    return <Expediente paciente={expediente} onCerrar={() => setExpediente(null)} />;
  }

  return (
    <>
      <form className="card" onSubmit={guardar}>
        <h2>Agregar paciente</h2>
        <label htmlFor="pac-nombre">Nombre *</label>
        <input id="pac-nombre" value={f.nombre} onChange={cambiar('nombre')} required />
        <label htmlFor="pac-especie">Especie</label>
        <select id="pac-especie" value={f.especie} onChange={cambiar('especie')}>
          <option value="">Seleccione...</option>
          {especies.map((g) => <option key={g}>{g}</option>)}
        </select>
        <label htmlFor="pac-propietario">Propietario</label>
        <input id="pac-propietario" value={f.propietario} onChange={cambiar('propietario')} placeholder="Nombre del dueño o tutor" />
        <label htmlFor="pac-telefono">Teléfono</label>
        <input id="pac-telefono" value={f.telefono} onChange={cambiar('telefono')} />
        <label htmlFor="pac-notas">Notas</label>
        <textarea id="pac-notas" rows="2" value={f.notas} onChange={cambiar('notas')} placeholder="Alergias, observaciones..." />
        <label htmlFor="pac-foto">Foto</label>
        <input id="pac-foto" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files[0] || null)} />
        {foto && <img className="foto" src={URL.createObjectURL(foto)} alt={`Vista previa de la foto de ${f.nombre || 'la mascota'}`} />}
        <button className="btn" type="submit">Guardar paciente</button>
        <button className="btn secondary" type="button" onClick={() => { setF(vacioPac); setFoto(null); }}>Limpiar</button>
        <Msg msg={msg} />
      </form>

      <div className="card">
        <h2>Buscar pacientes</h2>
        <label htmlFor="pac-buscar" className="sr-only">Buscar por nombre o propietario</label>
        <input id="pac-buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre o propietario..." />
        {(buscando || lista.length > 0) && (
          <table>
            <thead><tr><th>Foto</th><th>Nombre</th><th>Especie</th><th>Propietario</th><th>Teléfono</th><th>Acciones</th></tr></thead>
            <tbody>
              {buscando
                ? [1, 2, 3].map((i) => <FilaSkeleton key={i} cols={6} />)
                : lista.map((p) => (
                    <tr key={p.id}>
                      <td>{p.foto ? <img className="foto mini" src={urlFoto(p.id)} alt={`Foto de ${p.nombre}`} /> : '-'}</td>
                      <td>{p.nombre}</td><td>{p.especie}</td><td>{p.propietario}</td><td>{p.telefono}</td>
                      <td>
                        <button className="btn small" onClick={() => setExpediente(p)}>Expediente</button>
                        <button className="btn small danger" onClick={() => setPidiendoBaja({ id: p.id, nombre: p.nombre })}>
                          Dar de baja
                        </button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        )}
      </div>

      {pidiendoBaja && (
        <ModalConfirmar
          titulo={`¿Dar de baja a ${pidiendoBaja.nombre}?`}
          texto="Ya no aparecerá en búsquedas ni se le podrán agendar citas nuevas. Su historial de citas pasadas se conserva."
          onCancelar={() => setPidiendoBaja(null)}
          onConfirmar={confirmarBaja}
        />
      )}
    </>
  );
}

// ---------------- TABLA DE CITAS (compartida) ----------------
// Ley de Hick: en vez de dos botones sueltos (Atendida / Cancelar), un
// solo control con las opciones agrupadas — una decisión, no dos.
function TablaCitas({ citas, acciones, onEstado }) {
  if (!citas.length) return <p>No hay citas para mostrar.</p>;
  return (
    <table>
      <thead>
        <tr><th>Paciente</th><th>Fecha</th><th>Hora</th><th>Motivo</th><th>Lugar</th><th>Estado</th>{acciones && <th>Acciones</th>}</tr>
      </thead>
      <tbody>
        {citas.map((c) => (
          <tr key={c.id}>
            <td>{c.nombrePaciente}</td><td>{c.fecha}</td><td>{c.hora}</td><td>{c.motivo}</td>
            <td>
              {Number(c.domicilio) === 1
                ? <span className="badge domicilio" title={c.direccionDomicilio || ''}>A domicilio</span>
                : 'Consultorio'}
            </td>
            <td><span className={`badge ${c.estado}`}>{c.estado}</span></td>
            {acciones && (
              <td>
                <label className="sr-only" htmlFor={`estado-${c.id}`}>Cambiar estado de la cita de {c.nombrePaciente}</label>
                <select
                  id={`estado-${c.id}`}
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) onEstado(c.id, e.target.value); }}
                >
                  <option value="" disabled>Cambiar estado...</option>
                  <option value="ATENDIDA">Marcar como atendida</option>
                  <option value="CANCELADA">Cancelar cita</option>
                </select>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------- CITAS ----------------
const vacioCita = () => ({ idPaciente: '', fecha: hoyLocal(), hora: '', motivo: '', observaciones: '', domicilio: false, direccionDomicilio: '' });

function Citas() {
  const [f, setF] = useState(vacioCita());
  const [pacientes, setPacientes] = useState([]);
  const [proximas, setProximas] = useState(null); // null = cargando
  const [msg, setMsg] = useState(null);
  const cambiar = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const cargar = () => {
    setProximas(null);
    api('citas', { params: { desde: hoyLocal(), estado: 'PROGRAMADA' } }).then(setProximas).catch(() => setProximas([]));
  };
  useEffect(() => { api('pacientes').then(setPacientes).catch(() => {}); cargar(); }, []);

  const agendar = async (e) => {
    e.preventDefault();
    try {
      const r = await api('citas', { method: 'POST', body: f });
      setMsg({ tipo: 'success', texto: r.mensaje });
      setF(vacioCita()); cargar();
    } catch (err) { setMsg({ tipo: 'error', texto: err.message }); }
  };
  const cambiarEstado = async (id, estado) => {
    await api('cita_estado', { method: 'POST', body: { id, estado } }).catch(() => {});
    cargar();
  };

  return (
    <>
      <form className="card" onSubmit={agendar}>
        <h2>Agendar cita</h2>
        <label htmlFor="cita-paciente">Paciente *</label>
        <select id="cita-paciente" value={f.idPaciente} onChange={cambiar('idPaciente')} required>
          <option value="">Seleccione un paciente...</option>
          {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <label htmlFor="cita-fecha">Fecha *</label>
        <input id="cita-fecha" type="date" value={f.fecha} onChange={cambiar('fecha')} required />
        <label htmlFor="cita-hora">Hora *</label>
        <input id="cita-hora" type="time" value={f.hora} onChange={cambiar('hora')} required />
        <label htmlFor="cita-motivo">Motivo</label>
        <input id="cita-motivo" value={f.motivo} onChange={cambiar('motivo')} placeholder="Consulta general, vacunación, cirugía..." />

        <label className="checkbox-linea" htmlFor="cita-domicilio">
          <input
            id="cita-domicilio"
            type="checkbox"
            checked={f.domicilio}
            onChange={(e) => setF({ ...f, domicilio: e.target.checked })}
          />
          Es cita a domicilio
        </label>
        {f.domicilio && (
          <>
            <label htmlFor="cita-direccion">Dirección del domicilio *</label>
            <input
              id="cita-direccion"
              value={f.direccionDomicilio}
              onChange={cambiar('direccionDomicilio')}
              placeholder="Calle, número, colonia..."
              required
            />
          </>
        )}

        <label htmlFor="cita-observaciones">Observaciones</label>
        <textarea id="cita-observaciones" rows="2" value={f.observaciones} onChange={cambiar('observaciones')} />
        <button className="btn" type="submit">Agendar cita</button>
        <button className="btn secondary" type="button" onClick={() => setF(vacioCita())}>Limpiar</button>
        <Msg msg={msg} />
      </form>
      <div className="card">
        <h2>Próximas citas</h2>
        <button className="btn secondary" onClick={cargar}>Actualizar</button>
        {proximas === null ? (
          <table><tbody>{[1, 2, 3].map((i) => <FilaSkeleton key={i} cols={7} />)}</tbody></table>
        ) : (
          <TablaCitas citas={proximas} acciones onEstado={cambiarEstado} />
        )}
      </div>
    </>
  );
}

// ---------------- HISTORIAL ----------------
// Ley de Hick: por defecto solo se ve un filtro (Estado). El rango de
// fechas queda oculto detrás de un <details> opcional, para no mostrar
// tres decisiones a la vez cuando la mayoría de las veces solo hace falta una.
function Historial() {
  const [fl, setFl] = useState({ desde: '', hasta: '', estado: '' });
  const [citas, setCitas] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const cambiar = (k) => (e) => setFl({ ...fl, [k]: e.target.value });

  const buscar = async () => {
    setBuscando(true);
    try { setCitas(await api('citas', { params: fl })); }
    catch { setCitas([]); }
    setBuscando(false);
  };

  return (
    <div className="card">
      <h2>Historial de citas</h2>
      <label htmlFor="hist-estado">Estado</label>
      <select id="hist-estado" value={fl.estado} onChange={cambiar('estado')}>
        <option value="">Todos</option>
        <option value="PROGRAMADA">Programada</option>
        <option value="ATENDIDA">Atendida</option>
        <option value="CANCELADA">Cancelada</option>
        <option value="NO_ASISTIO">No asistió</option>
      </select>

      <details className="filtros-avanzados">
        <summary>Filtrar por fecha (opcional)</summary>
        <label htmlFor="hist-desde">Desde</label>
        <input id="hist-desde" type="date" value={fl.desde} onChange={cambiar('desde')} />
        <label htmlFor="hist-hasta">Hasta</label>
        <input id="hist-hasta" type="date" value={fl.hasta} onChange={cambiar('hasta')} />
      </details>

      <button className="btn" onClick={buscar}>Buscar</button>

      {buscando && <table><tbody>{[1, 2, 3].map((i) => <FilaSkeleton key={i} cols={6} />)}</tbody></table>}
      {!buscando && citas && <TablaCitas citas={citas} />}
    </div>
  );
}

// ---------------- CONFIGURACIÓN ----------------
function Configuracion() {
  const [errores, setErrores] = useState(null);
  return (
    <div className="card">
      <h2>Configuración del sistema</h2>
      <button className="btn" onClick={() => api('diagnostico').then((r) => setErrores(r.errores)).catch((e) => setErrores([e.message]))}>
        Verificar sistema
      </button>
      {errores && (errores.length === 0
        ? <div className="message success" role="status">Todo correcto. El sistema está íntegro.</div>
        : <><div className="message error" role="alert"><strong>Problemas encontrados:</strong></div><ul>{errores.map((e) => <li key={e}>{e}</li>)}</ul></>)}
    </div>
  );
}

// ---------------- CRUD GENERAL ----------------
const CRUD_ENTIDADES = {
  pacientes: { titulo: 'Pacientes', campos: [['nombre','Nombre','text',true],['especie','Especie','text'],['propietario','Propietario','text'],['telefono','Teléfono','tel'],['notas','Notas','textarea'],['activo','Estado','select',true,[['1','Activo'],['0','Inactivo']]]], columnas: ['nombre','especie','propietario','telefono','activo'] },
  citas: { titulo: 'Citas', campos: [['paciente_id','Paciente','paciente',true],['fecha','Fecha','date',true],['hora','Hora','time',true],['motivo','Motivo','text'],['estado','Estado','select',true,[['PROGRAMADA','Programada'],['ATENDIDA','Atendida'],['CANCELADA','Cancelada'],['NO_ASISTIO','No asistió']]],['observaciones','Observaciones','textarea'],['domicilio','A domicilio','select',true,[['0','No'],['1','Sí']]],['direccion_domicilio','Dirección a domicilio','text']], columnas: ['paciente','fecha','hora','motivo','estado'] },
  registros: { titulo: 'Registros clínicos', campos: [['paciente_id','Paciente','paciente',true],['fecha','Fecha','date',true],['tipo','Tipo','select',true,[['CONSULTA','Consulta'],['VACUNA','Vacuna'],['TRATAMIENTO','Tratamiento'],['CIRUGIA','Cirugía'],['OTRO','Otro']]],['descripcion','Descripción','textarea',true],['peso','Peso (kg)','number']], columnas: ['paciente','fecha','tipo','descripcion','peso'] },
  especies: { titulo: 'Especies', campos: [['nombre','Nombre','text',true]], columnas: ['nombre'] },
};
function GestionCRUD() {
  const [entidad,setEntidad]=useState('pacientes'), [filas,setFilas]=useState([]), [pacientes,setPacientes]=useState([]), [form,setForm]=useState({}), [editando,setEditando]=useState(null), [q,setQ]=useState(''), [msg,setMsg]=useState(null), [pagina,setPagina]=useState(0);
  const def=CRUD_ENTIDADES[entidad];
  const cargar=async()=>{try{setFilas(await api('crud',{params:{entidad,q,incluirInactivos:entidad==='pacientes'?'1':''}}));}catch(e){setMsg({tipo:'error',texto:e.message});}};
  useEffect(()=>{cargar();api('crud',{params:{entidad:'pacientes'}}).then(setPacientes).catch(()=>{});},[entidad]);
  useEffect(()=>{setPagina(0);const t=setTimeout(cargar,180);return()=>clearTimeout(t);},[q]);
  const reset=()=>{setForm({});setEditando(null);};
  const iniciarEdicion=(fila)=>{setEditando(fila.id);const f={...fila};if(f.hora)f.hora=String(f.hora).slice(0,5);for(const [k] of def.campos)f[k]=f[k]??'';setForm(f);window.scrollTo({top:0,behavior:'smooth'});};
  const guardar=async(e)=>{e.preventDefault();try{const r=await api('crud',{method:'POST',body:{...form,entidad,accion:editando?'actualizar':'crear',id:editando}});setMsg({tipo:'success',texto:r.mensaje});reset();await cargar();}catch(err){setMsg({tipo:'error',texto:err.message});}};
  const borrar=async(fila)=>{if(!window.confirm(`¿${entidad==='pacientes'?'Dar de baja':'Eliminar'} este registro?`))return;try{const r=await api('crud',{method:'POST',body:{entidad,accion:'eliminar',id:fila.id,nombre:fila.nombre}});setMsg({tipo:'success',texto:r.mensaje});await cargar();}catch(e){setMsg({tipo:'error',texto:e.message});}};
  const campo=(key,label,type,required,options)=> <label key={key}>{label}{type==='textarea'?<textarea rows="3" required={!!required} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})}/>:type==='paciente'?<select required value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})}><option value="">Selecciona paciente</option>{pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre} — {p.propietario}</option>)}</select>:type==='select'?<select required={!!required} value={form[key]??(key==='activo'?'1':'')} onChange={e=>setForm({...form,[key]:e.target.value})}>{(options??[]).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>:<input type={type} required={!!required} min={type==='number'?'0':undefined} step={type==='number'?'0.01':undefined} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})}/>}</label>;
  const paginaFilas=filas.slice(pagina*10,(pagina+1)*10), paginas=Math.max(1,Math.ceil(filas.length/10));
  return <><form className="card crud-form" onSubmit={guardar}><h2>{editando?'Editar':'Nuevo'} · {def.titulo}</h2><div className="crud-fields">{def.campos.map(c=>campo(...c))}</div><button className="btn" type="submit">{editando?'Guardar cambios':'Crear registro'}</button>{editando&&<button className="btn secondary" type="button" onClick={reset}>Cancelar edición</button>}<Msg msg={msg}/></form>
  <section className="card"><div className="crud-toolbar"><h2>Listado · {def.titulo}</h2><select aria-label="Entidad" value={entidad} onChange={e=>{setEntidad(e.target.value);setQ('');reset();setPagina(0);setMsg(null);}}>{Object.entries(CRUD_ENTIDADES).map(([k,v])=><option key={k} value={k}>{v.titulo}</option>)}</select><input aria-label="Buscar" placeholder="Buscar en el listado..." value={q} onChange={e=>setQ(e.target.value)}/></div><div className="table-scroll"><table><thead><tr>{def.columnas.map(c=><th key={c}>{c==='activo'?'Estado':c==='paciente'?'Paciente':c==='descripcion'?'Descripción':c[0].toUpperCase()+c.slice(1)}</th>)}<th>Acciones</th></tr></thead><tbody>{paginaFilas.map(f=><tr key={f.id}>{def.columnas.map(c=><td key={c}>{c==='activo'?(Number(f[c])?'Activo':'Inactivo'):f[c]}</td>)}<td><button className="btn small" onClick={()=>iniciarEdicion(f)}>Editar</button><button className="btn small danger" onClick={()=>borrar(f)}>{entidad==='pacientes'?'Dar de baja':'Eliminar'}</button></td></tr>)}{!filas.length&&<tr><td colSpan={def.columnas.length+1}>No hay registros para mostrar.</td></tr>}</tbody></table></div><div className="crud-pages"><button className="btn small secondary" disabled={pagina===0} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>Página {pagina+1} de {paginas} · {filas.length} registros</span><button className="btn small secondary" disabled={pagina+1>=paginas} onClick={()=>setPagina(p=>p+1)}>Siguiente</button></div></section></>;
}

// ---------------- SIDEBAR ----------------
// Ley de Hick: 5 opciones visibles a la vez, sin submenús — mientras el
// menú no crezca de forma significativa, cada clic sigue siendo una
// decisión rápida. Si en el futuro agregas más secciones, agrúpalas en
// vez de sumarlas todas al mismo nivel.
const ITEMS = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['pacientes', 'Pacientes', PawPrint],
  ['citas', 'Citas', CalendarDays],
  ['historial', 'Historial', History],
  ['crud', 'Administrar', Database],
  ['config', 'Configuración', Settings],
];
const VISTAS = { dashboard: Dashboard, pacientes: Pacientes, citas: Citas, historial: Historial, crud: GestionCRUD, config: Configuracion };

function Sidebar({ tab, setTab, colapsado, setColapsado, nombreCorto, onPedirSalir }) {
  return (
    <aside className={`sidebar${colapsado ? ' collapsed' : ''}`}>
      <div className="sidebar-top">
        <div className="sidebar-brand"><Stethoscope size={20} aria-hidden="true" /><span>{nombreCorto || 'SISTEMA'}</span></div>
        <button
          className="sidebar-toggle"
          onClick={() => setColapsado(!colapsado)}
          aria-label={colapsado ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!colapsado}
        >
          {colapsado ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
        </button>
      </div>
      <nav aria-label="Menú principal">
        {ITEMS.map(([id, nombre, Icono]) => (
          <button
            key={id}
            className={`sidebar-item${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
            aria-label={nombre}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icono size={20} aria-hidden="true" />
            <span className="sidebar-label" aria-hidden="true">{nombre}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-item salir" onClick={onPedirSalir} aria-label="Salir">
          <LogOut size={20} aria-hidden="true" />
          <span className="sidebar-label" aria-hidden="true">Salir</span>
        </button>
      </div>
    </aside>
  );
}

// ---------------- APP ----------------
export default function App() {
  const [cfg, setCfg] = useState(null);
  const [auth, setAuth] = useState(null); // null = cargando
  const [tab, setTab] = useState('dashboard');
  const [colapsado, setColapsado] = useState(false);
  const [pidiendoSalir, setPidiendoSalir] = useState(false);

  useEffect(() => {
    api('config').then((c) => {
      setCfg(c);
      document.title = c.nombreSistema;
      Object.entries(c.colores).forEach(([k, v]) => document.documentElement.style.setProperty(`--${k}`, v));
    }).catch(() => {});
    api('sesion').then((r) => setAuth(r.autenticado)).catch(() => setAuth(false));
    const expirar = () => setAuth(false);
    window.addEventListener('sesion-expirada', expirar);
    return () => window.removeEventListener('sesion-expirada', expirar);
  }, []);

  const salir = async () => {
    setPidiendoSalir(false);
    await api('logout').catch(() => {});
    setAuth(false);
  };

  const Vista = VISTAS[tab];

  return (
    <>
      <a href="#contenido" className="skip-link">Saltar al contenido</a>

      {auth === null && (
        <div className="app-shell"><div className="content"><main id="contenido"><p>Cargando...</p></main></div></div>
      )}

      {auth === false && (
        <div className="app-shell">
          <div className="content">
            <header className="topbar"><h1>{cfg?.nombreSistema || 'Cargando...'}</h1></header>
            <main id="contenido" tabIndex={-1}><Login onOk={() => setAuth(true)} /></main>
            <PieClinica clinica={cfg?.clinica} />
          </div>
        </div>
      )}

      {auth && (
        <div className="app-shell">
          <Sidebar
            tab={tab} setTab={setTab}
            colapsado={colapsado} setColapsado={setColapsado}
            nombreCorto={cfg?.nombreCorto}
            onPedirSalir={() => setPidiendoSalir(true)}
          />
          <div className="content">
            <header className="topbar"><h1>{cfg?.nombreSistema}</h1></header>
            <main id="contenido" tabIndex={-1}><Vista /></main>
            <PieClinica clinica={cfg?.clinica} />
          </div>
        </div>
      )}

      {pidiendoSalir && (
        <ModalConfirmar
          titulo="¿Estás seguro de salir?"
          texto="Vas a cerrar tu sesión en el sistema."
          onCancelar={() => setPidiendoSalir(false)}
          onConfirmar={salir}
        />
      )}
    </>
  );
}
