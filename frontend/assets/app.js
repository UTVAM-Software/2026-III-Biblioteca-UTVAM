(() => {
'use strict';
// Ruta de la API relativa a frontend/index.html. Requiere que frontend/ y backend/ estén
// uno junto al otro (como en el repositorio).
const API = '../backend/api/index.php';
const $ = (s, root=document) => root.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const debounce = (fn, ms=250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// Escribe HTML en un elemento solo si todavía existe (evita errores si la pantalla ya cambió).
const put = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };

async function api(route,{method='GET',params={},body}={}) {
  const p=new URLSearchParams({r:route,...Object.fromEntries(Object.entries(params).filter(([,v])=>v!==''&&v!=null))});
  const opt={method,credentials:'same-origin',headers:{}};
  if(body instanceof FormData) opt.body=body;
  else if(body!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body);}
  const res=await fetch(`${API}?${p}`,opt);
  const data=await res.json().catch(()=>({error:'Respuesta inválida del servidor.'}));
  if(res.status===401 && route!=='login'){
    auth=null;
    renderLogin('Tu sesión expiró. Inicia sesión de nuevo.');
    throw Object.assign(new Error(data.error||'Sesión expirada.'),{sesion:true});
  }
  if(!res.ok) throw new Error(data.error||'Error desconocido');
  return data;
}

// Cuadro de confirmación accesible (usa <dialog>: foco atrapado, Escape cierra, devuelve el foco).
function confirmar(texto, aceptar='Aceptar'){
  return new Promise(resolve=>{
    const d=document.createElement('dialog');
    d.className='modal-dialog';
    d.setAttribute('aria-labelledby','dlgTxt');
    d.innerHTML=`<p id="dlgTxt">${esc(texto)}</p><div class="modal-actions"><button type="button" class="btn secondary" data-v="0">Cancelar</button><button type="button" class="btn danger" data-v="1">${esc(aceptar)}</button></div>`;
    document.body.appendChild(d);
    const fin=v=>{d.close();d.remove();resolve(v);};
    d.addEventListener('click',e=>{const b=e.target.closest('[data-v]');if(b)fin(b.dataset.v==='1');});
    d.addEventListener('cancel',e=>{e.preventDefault();fin(false);});
    d.showModal();
    d.querySelector('[data-v="0"]').focus();
  });
}
// Aviso de error en una acción puntual (no molesta si el error fue de sesión expirada).
const avisar = e => { if(!e.sesion) alert(e.message); };

let cfg=null, auth=null, tab='dashboard', collapsed=false;
const app=$('#app');
const puede=(codigo)=>!!auth?.permisos?.includes(codigo);
const puedeAlguno=(codigos)=>codigos.some(puede);
const icon=(name)=>({
  stethoscope:'<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M8 3h4M6 3H4m10 0h2"/><path d="M10 12v2a4 4 0 0 0 8 0v-1"/><circle cx="18" cy="11" r="2"/>',
  dashboard:'<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>',
  pacientes:'<path d="M12 20s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.5-8 11-8 11Z"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/>',
  citas:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  historial:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  config:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a7 7 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a7 7 0 0 1 0 1.8Z"/>',
  crud:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3 1.2 0 2.3-.1 3.3-.3"/><path d="M16 17h5m-2.5-2.5v5"/>',
  usuarios:'<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  roles:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  permisos:'<circle cx="8" cy="15" r="4"/><path d="m10.85 12.15 7.3-7.3a2.12 2.12 0 0 1 3 3l-7.3 7.3M15 8l2 2"/><path d="M5 15h.01"/>',
  logout:'<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  left:'<path d="m15 18-6-6 6-6"/>', right:'<path d="m9 18 6-6-6-6"/>'
}[name]||'');
const iconSvg=(name,size=20)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon(name)}</svg>`;
const msg=(text,type='success')=>`<div class="message ${type}" role="${type==='error'?'alert':'status'}">${esc(text)}</div>`;
const field=(label,name,type='text',required=false,value='',extra='')=>`<label>${esc(label)}${type==='textarea'?`<textarea name="${name}" ${required?'required':''} ${extra}>${esc(value)}</textarea>`:`<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${extra}>`}</label>`;
// Lista desplegable. opts = [[valor, texto], ...]. Si no coincide ningún valor, queda el primero.
const sel=(label,name,opts,value='',required=false)=>{const v=String(value??'');return `<label>${esc(label)}<select name="${name}" ${required?'required':''}>${opts.map(([val,txt])=>`<option value="${esc(val)}" ${String(val)===v?'selected':''}>${esc(txt)}</option>`).join('')}</select></label>`;};

function shell(content, logged=true){
 const clinic=cfg?.clinica||{};
 const menu=[['dashboard','Dashboard','dashboard',null],['pacientes','Pacientes','pacientes','pacientes.ver'],['citas','Citas','citas','citas.ver'],['historial','Historial','historial','citas.ver'],['crud','Administrar','crud',['pacientes.ver','citas.ver','registros.ver','especies.ver']],['usuarios','Usuarios','usuarios','usuarios.ver'],['roles','Perfiles','roles','roles.ver'],['permisos','Permisos','permisos','permisos.ver'],['config','Configuración','config','config.ver']].filter(([, , , req])=>!req||(Array.isArray(req)?puedeAlguno(req):puede(req)));
 const who=auth?.usuario;
 app.innerHTML=`<a href="#contenido" class="skip-link">Saltar al contenido</a><div class="app-shell">
 ${logged?`<aside class="sidebar ${collapsed?'collapsed':''}"><div class="sidebar-top"><div class="sidebar-brand">${iconSvg('stethoscope')}<span>${esc(cfg?.nombreCorto||'SISTEMA')}</span></div><button class="sidebar-toggle" id="toggleMenu" aria-label="${collapsed?'Expandir menú':'Colapsar menú'}" aria-expanded="${!collapsed}">${iconSvg(collapsed?'right':'left',18)}</button></div><nav aria-label="Menú principal">${menu.map(([id,n,ic])=>`<button class="sidebar-item ${tab===id?'active':''}" data-tab="${id}" aria-label="${n}" ${tab===id?'aria-current="page"':''}>${iconSvg(ic)}<span class="sidebar-label" aria-hidden="true">${n}</span></button>`).join('')}</nav><div class="sidebar-footer"><button class="sidebar-item salir" id="logout" aria-label="Salir">${iconSvg('logout')}<span class="sidebar-label" aria-hidden="true">Salir</span></button></div></aside>`:''}
 <div class="content"><header class="topbar"><h1>${esc(cfg?.nombreSistema||'Clínica Veterinaria')}</h1>${logged&&who?`<p class="topbar-usuario">${esc(who.rol||'')} · ${esc(who.nombre||who.usuario||'')}</p>`:''}</header><main id="contenido" tabindex="-1">${content}</main>
 <footer class="pie-clinica"><p><strong>${esc(clinic.doctor||'')}</strong> — Céd. Prof. ${esc(clinic.cedula||'')}</p><p>${esc(clinic.direccion||'')} · Tel. ${esc(clinic.telefono||'')}</p></footer></div></div>`;
 $('#toggleMenu')?.addEventListener('click',()=>{collapsed=!collapsed;renderTab();});
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;renderTab();}));
 $('#logout')?.addEventListener('click',async()=>{
   if(await confirmar('¿Estás seguro de salir? Vas a cerrar tu sesión en el sistema.','Salir')){
     await api('logout').catch(()=>{}); auth=null; tab='dashboard'; renderLogin();
   }
 });
}

function renderLogin(aviso=''){
 shell(`<form class="card login" id="loginForm"><h2>Iniciar sesión</h2>${field('Usuario','usuario','text',true)}${field('Contraseña','clave','password',true)}<button class="btn" type="submit">Entrar</button><div id="loginMsg">${aviso?msg(aviso,'error'):''}</div></form>`,false);
 $('#loginForm').addEventListener('submit',async e=>{
   e.preventDefault();
   const f=Object.fromEntries(new FormData(e.currentTarget));
   try{await api('login',{method:'POST',body:f});auth=await api('sesion');tab='dashboard';renderTab();}
   catch(err){put('#loginMsg',msg(err.message,'error'));}
 });
}

async function dashboard(){
 let d={}, cs=[], err='';
 try{[d,cs]=await Promise.all([api('resumen'),api('citas',{params:{desde:today(),hasta:today(),estado:'PROGRAMADA'}})]);}
 catch(e){ if(e.sesion) return; err=e.message; }
 const cajas=[['totalPacientes','Pacientes'],['citasHoy','Citas hoy'],['citasSemana','Citas próx. 7 días'],['citasProgramadas','Programadas']];
 const h=new Date().getHours();
 shell(`${err?msg('No se pudieron cargar los datos: '+err,'error'):''}<section class="card"><p class="saludo">${h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches'} 👋</p><p class="subsaludo">${cs.length?`Tienes ${cs.length} cita(s) programada(s) para hoy.`:'No tienes citas programadas para hoy.'}</p><div class="stats">${cajas.map(([k,t])=>`<div class="stat-box"><div class="num">${esc(d[k]??'-')}</div><div class="label">${t}</div></div>`).join('')}</div></section>${cs.length?`<section class="card"><h2>Citas de hoy</h2>${tableCitas(cs,false)}</section>`:''}`);
}

function tableCitas(rows,actions=false){
 if(!rows.length)return '<p>No hay citas para mostrar.</p>';
 return `<div class="table-scroll"><table><thead><tr><th>Paciente</th><th>Fecha</th><th>Hora</th><th>Motivo</th><th>Lugar</th><th>Estado</th>${actions?'<th>Acciones</th>':''}</tr></thead><tbody>${rows.map(c=>`<tr><td>${esc(c.nombrePaciente)}</td><td>${esc(c.fecha)}</td><td>${esc(c.hora)}</td><td>${esc(c.motivo)}</td><td>${Number(c.domicilio)===1?`<span class="badge domicilio" title="${esc(c.direccionDomicilio)}">A domicilio</span>`:'Consultorio'}</td><td><span class="badge ${esc(c.estado)}">${esc(c.estado)}</span></td>${actions?`<td><select data-status="${c.id}" aria-label="Cambiar estado de la cita de ${esc(c.nombrePaciente)}"><option value="">Cambiar estado...</option><option value="ATENDIDA">Marcar como atendida</option><option value="CANCELADA">Cancelar cita</option><option value="NO_ASISTIO">No asistió</option></select></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}

async function pacientes(){
 let rows=[], species=[], err='';
 let fotoPreviewUrl='';
 try{rows=await api('pacientes');}catch(e){if(e.sesion)return;err=e.message;}
 if(puede('especies.ver'))try{species=await api('especies');}catch(e){if(e.sesion)return;}
 const speciesField=puede('especies.ver')?`<label>Especie<select name="especie"><option value="">Seleccione...</option>${species.map(s=>`<option>${esc(s)}</option>`).join('')}</select></label>`:field('Especie','especie');
 shell(`${err?msg('No se pudieron cargar los pacientes: '+err,'error'):''}${puede('pacientes.crear')?`<section class="card"><h2>Registrar paciente</h2><form id="pacForm">${field('Nombre de la mascota *','nombre','text',true)}${speciesField}${field('Propietario','propietario')}${field('Teléfono','telefono','tel')}${field('Notas','notas','textarea')}<label>Foto<input type="file" name="foto" accept="image/jpeg,image/png,image/webp"></label><div id="fotoPreview"></div><button class="btn" type="submit">Guardar paciente</button><span id="pacMsg"></span></form></section>`:''}<section class="card"><h2>Pacientes</h2><label class="sr-only" for="pacSearch">Buscar paciente</label><input id="pacSearch" placeholder="Buscar por nombre o propietario..."><div id="pacList">${patientRows(rows)}</div></section>`);
 $('#pacForm [name="foto"]')?.addEventListener('change',e=>{
   if(fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl);
   const file=e.currentTarget.files?.[0];
   fotoPreviewUrl=file?URL.createObjectURL(file):'';
   put('#fotoPreview',fotoPreviewUrl?`<img class="foto" src="${fotoPreviewUrl}" alt="Vista previa de ${esc(file.name)}">`:'' );
 });
 $('#pacForm')?.addEventListener('submit',async e=>{
   e.preventDefault();
   const form=e.currentTarget, fd=new FormData(form);
   try{const r=await api('pacientes',{method:'POST',body:fd});put('#pacMsg',msg(r.mensaje));form.reset();if(fotoPreviewUrl)URL.revokeObjectURL(fotoPreviewUrl);fotoPreviewUrl='';put('#fotoPreview','');loadPatients();}
   catch(err){put('#pacMsg',msg(err.message,'error'));}
 });
 $('#pacSearch').addEventListener('input',debounce(()=>loadPatients()));
 wirePatientActions();
}
function patientRows(rows){return rows.length?`<div class="table-scroll"><table><thead><tr><th>Nombre</th><th>Especie</th><th>Propietario</th><th>Teléfono</th><th>Acciones</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${p.foto?`<img src="${API}?r=foto&id=${p.id}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:50%;vertical-align:middle"> `:''}${esc(p.nombre)}</td><td>${esc(p.especie)}</td><td>${esc(p.propietario)}</td><td>${esc(p.telefono)}</td><td>${puede('registros.ver')?`<button class="btn small" data-record="${p.id}">Expediente</button>`:''}${puede('pacientes.eliminar')?`<button class="btn small danger" data-retire="${p.id}" data-name="${esc(p.nombre)}">Dar de baja</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p>No hay pacientes registrados.</p>';}
async function loadPatients(){
 try{put('#pacList',patientRows(await api('pacientes',{params:{q:$('#pacSearch')?.value||''}})));wirePatientActions();}
 catch(e){ if(!e.sesion) put('#pacList',msg(e.message,'error')); }
}
function wirePatientActions(){
 document.querySelectorAll('[data-retire]').forEach(b=>b.onclick=async()=>{
   if(!await confirmar(`¿Dar de baja a ${b.dataset.name}? Sus citas programadas se cancelarán y el historial se conserva.`,'Dar de baja'))return;
   try{await api('paciente_baja',{method:'POST',body:{id:b.dataset.retire}});loadPatients();}catch(e){avisar(e);}
 });
 document.querySelectorAll('[data-record]').forEach(b=>b.onclick=()=>openRecord(b.dataset.record));
}

async function openRecord(id){
 let p,regs=[];
 try{const all=await api('pacientes');p=all.find(x=>String(x.id)===String(id));regs=await api('registros',{params:{idPaciente:id}});}
 catch(e){avisar(e);return;}
 if(!p)return;
 shell(`<section class="card"><h2>Expediente de ${esc(p.nombre)}</h2><p class="subsaludo">${esc(p.especie||'Especie no indicada')} · Propietario: ${esc(p.propietario||'-')}</p><a class="btn" href="${API}?r=carnet&id=${encodeURIComponent(id)}" target="_blank" rel="noopener">Imprimir carnet (PDF)</a><button class="btn secondary" id="backPatients">Cerrar expediente</button>${puede('registros.crear')?`<h3>Agregar registro</h3><form id="regForm">${field('Fecha *','fecha','date',true,today())}${sel('Tipo *','tipo',[['CONSULTA','Consulta'],['VACUNA','Vacuna'],['TRATAMIENTO','Tratamiento'],['CIRUGIA','Cirugía'],['OTRO','Otro']],'CONSULTA',true)}${field('Peso (kg)','peso','number',false,'','step="0.01" min="0"')}${field('Descripción *','descripcion','textarea',true)}<button class="btn" type="submit">Guardar registro</button><div id="regMsg"></div></form>`:''}<h3>Historial clínico</h3>${regs.length?`<div class="table-scroll"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Peso</th></tr></thead><tbody>${regs.map(r=>`<tr><td>${esc(r.fecha)}</td><td>${esc(r.tipo)}</td><td>${esc(r.descripcion)}</td><td>${esc(r.peso||'-')}</td></tr>`).join('')}</tbody></table></div>`:'<p>Sin registros clínicos.</p>'}</section>`);
 $('#backPatients').onclick=()=>{tab='pacientes';renderTab();};
 $('#regForm')?.addEventListener('submit',async e=>{
   e.preventDefault();
   const body=Object.fromEntries(new FormData(e.currentTarget));body.idPaciente=id;
   try{const r=await api('registros',{method:'POST',body});await openRecord(id);put('#regMsg',msg(r.mensaje));}
   catch(err){put('#regMsg',msg(err.message,'error'));}
 });
}

async function citas(){
 let ps=[],rows=[],err='';
 try{[ps,rows]=await Promise.all([api('pacientes'),api('citas',{params:{desde:today(),estado:'PROGRAMADA'}})]);}
 catch(e){ if(e.sesion) return; err=e.message; }
 shell(`${err?msg('No se pudieron cargar las citas: '+err,'error'):''}${puede('citas.crear')?`<section class="card"><h2>Agendar cita</h2><form id="citaForm"><label>Paciente *<select name="idPaciente" required><option value="">Seleccione un paciente...</option>${ps.map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('')}</select></label>${field('Fecha *','fecha','date',true,today())}${field('Hora *','hora','time',true)}${field('Motivo','motivo')}${field('Observaciones','observaciones','textarea')}<label class="checkbox-linea"><input id="citaDomicilio" type="checkbox" name="domicilio" value="1"> Cita a domicilio</label><label id="direccionDomicilioLabel" hidden>Dirección del domicilio *<input name="direccionDomicilio" required disabled></label><button class="btn" type="submit">Agendar cita</button><div id="citaMsg"></div></form></section>`:''}<section class="card"><h2>Próximas citas programadas</h2><div id="citaRows">${tableCitas(rows,puede('citas.editar'))}</div></section>`);
 $('#citaDomicilio')?.addEventListener('change',e=>{const label=$('#direccionDomicilioLabel');label.hidden=!e.currentTarget.checked;label.querySelector('input').disabled=!e.currentTarget.checked;});
 $('#citaForm')?.addEventListener('submit',async e=>{
   e.preventDefault();
   const f=Object.fromEntries(new FormData(e.currentTarget));f.domicilio=f.domicilio?'1':'0';
   try{const r=await api('citas',{method:'POST',body:f});await citas();put('#citaMsg',msg(r.mensaje));}
   catch(err){put('#citaMsg',msg(err.message,'error'));}
 });
 wireStatuses();
}
function wireStatuses(){
 document.querySelectorAll('[data-status]').forEach(s=>s.onchange=async()=>{
   if(!s.value)return;
   try{await api('cita_estado',{method:'POST',body:{id:s.dataset.status,estado:s.value}});citas();}catch(e){avisar(e);}
 });
}

async function historial(){
 shell(`<section class="card"><h2>Historial de citas</h2><form id="histForm"><label>Estado<select name="estado"><option value="">Todos</option><option>PROGRAMADA</option><option>ATENDIDA</option><option>CANCELADA</option><option>NO_ASISTIO</option></select></label><details class="filtros-avanzados"><summary>Filtrar por fecha (opcional)</summary>${field('Desde','desde','date')}${field('Hasta','hasta','date')}</details><button class="btn" type="submit">Buscar</button></form><div id="histRows" aria-live="polite"></div></section>`);
 $('#histForm').onsubmit=async e=>{
   e.preventDefault();
   const params=Object.fromEntries(new FormData(e.currentTarget));
   try{put('#histRows',tableCitas(await api('citas',{params})));}
   catch(err){ if(!err.sesion) put('#histRows',msg(err.message,'error')); }
 };
}

async function configuracion(){
 shell(`<section class="card"><h2>Configuración del sistema</h2><button class="btn" id="diagnostico">Verificar sistema</button><div id="diagResult" aria-live="polite"></div></section>`);
 $('#diagnostico').onclick=async()=>{
   try{const r=await api('diagnostico');put('#diagResult',r.errores.length?msg('Problemas encontrados: '+r.errores.join(' · '),'error'):msg('Todo correcto. El sistema está íntegro.'));}
   catch(e){ if(!e.sesion) put('#diagResult',msg(e.message,'error')); }
 };
}

// ---------- Administración (CRUD) ----------
const SI_NO=[['1','Sí'],['0','No']], NO_SI=[['0','No'],['1','Sí']];
const ESTADOS=['PROGRAMADA','ATENDIDA','CANCELADA','NO_ASISTIO'].map(x=>[x,x]);
const TIPOS=['CONSULTA','VACUNA','TRATAMIENTO','CIRUGIA','OTRO'].map(x=>[x,x]);
// Cada campo: [nombre, etiqueta, tipo, opciones]. Tipo 'pac' = lista de pacientes activos.
const CRUD={
 pacientes:{title:'Pacientes',fields:[['nombre','Nombre','text'],['especie','Especie'],['propietario','Propietario'],['telefono','Teléfono','tel'],['notas','Notas','textarea'],['activo','Activo','select',SI_NO]],cols:['id','nombre','especie','propietario','telefono','activo']},
 citas:{title:'Citas',fields:[['paciente_id','Paciente','pac'],['fecha','Fecha','date'],['hora','Hora','time'],['motivo','Motivo'],['estado','Estado','select',ESTADOS],['observaciones','Observaciones','textarea'],['domicilio','A domicilio','select',NO_SI],['direccion_domicilio','Dirección domicilio']],cols:['id','paciente','fecha','hora','motivo','estado']},
 registros:{title:'Registros clínicos',fields:[['paciente_id','Paciente','pac'],['fecha','Fecha','date'],['tipo','Tipo','select',TIPOS],['descripcion','Descripción','textarea'],['peso','Peso (kg)','number']],cols:['id','paciente','fecha','tipo','descripcion','peso']},
 especies:{title:'Especies',fields:[['nombre','Nombre']],cols:['id','nombre']}
};
async function crud(){
 const entidadesVisibles=Object.entries(CRUD).filter(([k])=>puede(`${k}.ver`));
 let entity=entidadesVisibles[0]?.[0]||'pacientes', rows=[], editing=null, page=0, q='', pacOpts=[];
 shell(`<section class="card" id="crudFormCard"><h2 id="crudTitle">Nuevo · ${esc(CRUD[entity].title)}</h2><form id="crudForm"><div class="crud-fields" id="crudFields"></div><button class="btn" type="submit" id="crudSubmit">Crear registro</button><button type="button" class="btn secondary" id="cancelEdit" hidden>Cancelar edición</button><div id="crudMsg"></div></form></section><section class="card"><div class="crud-toolbar"><h2>Listado</h2><label class="sr-only" for="crudEntity">Tipo de registro</label><select id="crudEntity">${entidadesVisibles.map(([k,v])=>`<option value="${k}" ${k===entity?'selected':''}>${v.title}</option>`).join('')}</select><label class="sr-only" for="crudSearch">Buscar en el listado</label><input id="crudSearch" placeholder="Buscar en el listado..."></div><div id="crudRows"></div><div class="crud-pages"><button class="btn small secondary" id="prev">Anterior</button><span id="pageLabel"></span><button class="btn small secondary" id="next">Siguiente</button></div></section>`);
 try{pacOpts=(await api('pacientes')).map(p=>[p.id,p.nombre]);}catch(e){ if(e.sesion) return; }
 const load=async()=>{
   try{rows=await api('crud',{params:{entidad:entity,q,incluirInactivos:entity==='pacientes'?'1':''}});page=0;draw();}
   catch(e){ if(!e.sesion) put('#crudRows',msg(e.message,'error')); }
 };
 const draw=()=>{
   const def=CRUD[entity], pageRows=rows.slice(page*10,(page+1)*10), pages=Math.max(1,Math.ceil(rows.length/10));
   put('#crudRows',rows.length?`<div class="table-scroll"><table><thead><tr>${def.cols.map(c=>`<th>${esc(c)}</th>`).join('')}<th>Acciones</th></tr></thead><tbody>${pageRows.map(r=>`<tr>${def.cols.map(c=>`<td>${esc(c==='activo'?(Number(r[c])?'Activo':'Inactivo'):r[c])}</td>`).join('')}<td>${puede(`${entity}.editar`)?`<button class="btn small" data-edit="${r.id}">Editar</button>`:''}${puede(`${entity}.eliminar`)?`<button class="btn small danger" data-delete="${r.id}">Eliminar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p>No hay registros para mostrar.</p>');
   $('#pageLabel').textContent=`Página ${page+1} de ${pages} · ${rows.length} registros`;
   $('#prev').disabled=page===0; $('#next').disabled=page+1>=pages;
   document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>edit(rows.find(r=>String(r.id)===b.dataset.edit)));
   document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>remove(rows.find(r=>String(r.id)===b.dataset.delete)));
 };
 const formDraw=()=>{
   if(!puede(`${entity}.crear`)&&!editing){$('#crudFormCard').hidden=true;return;}
   $('#crudFormCard').hidden=false;
   const def=CRUD[entity];
   $('#crudTitle').textContent=`${editing?'Editar':'Nuevo'} · ${def.title}`;
   $('#crudFields').innerHTML=def.fields.map(([k,l,t='text',opts])=>{
     const v=editing?.[k]??'';
     if(t==='select') return sel(l,k,opts,v);
     if(t==='pac'){
       const o=[['','Seleccione un paciente...'],...pacOpts];
       if(v!==''&&!pacOpts.some(([id])=>String(id)===String(v))) o.push([v,`Paciente #${v} (inactivo)`]);
       return sel(l,k,o,v,true);
     }
     return field(l,k,t,false,v,t==='number'?'step="0.01" min="0"':'');
   }).join('');
   $('#crudSubmit').textContent=editing?'Guardar cambios':'Crear registro';
   $('#cancelEdit').hidden=!editing;
 };
 const edit=r=>{editing=r;formDraw();window.scrollTo({top:0,behavior:'smooth'});};
 const remove=async r=>{
   const texto=entity==='pacientes'?'¿Dar de baja a este paciente? Sus citas programadas se cancelarán y el historial se conserva.':'¿Eliminar este registro? Esta acción no se puede deshacer.';
   if(!await confirmar(texto,entity==='pacientes'?'Dar de baja':'Eliminar'))return;
   try{await api('crud',{method:'POST',body:{entidad:entity,accion:'eliminar',id:r.id,nombre:r.nombre}});load();}catch(e){avisar(e);}
 };
 $('#crudEntity').onchange=()=>{entity=$('#crudEntity').value;editing=null;q='';$('#crudSearch').value='';put('#crudMsg','');formDraw();load();};
 $('#crudSearch').oninput=debounce(()=>{q=$('#crudSearch').value;load();});
 $('#prev').onclick=()=>{page--;draw();};
 $('#next').onclick=()=>{page++;draw();};
 $('#cancelEdit').onclick=()=>{editing=null;formDraw();};
 $('#crudForm')?.addEventListener('submit',async e=>{
   e.preventDefault();
   const body=Object.fromEntries(new FormData(e.currentTarget));
   Object.assign(body,{entidad:entity,accion:editing?'actualizar':'crear',id:editing?.id||0});
   try{const r=await api('crud',{method:'POST',body});editing=null;formDraw();put('#crudMsg',msg(r.mensaje));load();}
   catch(err){ if(!err.sesion) put('#crudMsg',msg(err.message,'error')); }
 });
 formDraw();load();
}

const PAGINA_SEGURIDAD=10;
const paginacion=(pagina,total)=>{
 const paginas=Math.max(1,Math.ceil(total/PAGINA_SEGURIDAD));
 return `<div class="crud-pages"><button class="btn small secondary" data-page="-1" ${pagina===0?'disabled':''}>Anterior</button><span>Página ${pagina+1} de ${paginas} · ${total} registros</span><button class="btn small secondary" data-page="1" ${pagina+1>=paginas?'disabled':''}>Siguiente</button></div>`;
};
function enlazarPaginacion(pagina,total,cambiar){
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{const next=pagina+Number(b.dataset.page);if(next>=0&&next<Math.max(1,Math.ceil(total/PAGINA_SEGURIDAD)))cambiar(next);});
}

async function usuarios(){
 let rows=[],roles=[],q='',page=0,editing=null,note='';
 let draft={usuario:'',nombre:'',clave:'',rol_id:'',activo:'1'};
 const load=async()=>{try{rows=await api('usuarios',{params:{q}});note='';}catch(e){if(e.sesion)return;rows=[];note=e.message;}try{roles=await api('roles');}catch(e){if(e.sesion)return;roles=[];}draw();};
 const draw=()=>{
   const visible=rows.slice(page*PAGINA_SEGURIDAD,(page+1)*PAGINA_SEGURIDAD);
   const showForm=puede('usuarios.crear')||editing;
   const form=showForm?`<form class="card crud-form" id="userForm"><h2>${editing?'Editar usuario':'Nuevo usuario'}</h2><div class="crud-fields"><label>Usuario *<input name="usuario" value="${esc(draft.usuario)}" required minlength="3" maxlength="60" autocomplete="off"></label><label>Nombre completo<input name="nombre" value="${esc(draft.nombre)}" maxlength="120"></label><label>${editing?'Nueva contraseña (vacía = no cambiar)':'Contraseña * (mín. 8)'}<input name="clave" type="password" ${editing?'':'required minlength="8"'} autocomplete="new-password"></label><label>Perfil / rol *<select name="rol_id" required><option value="">Selecciona un perfil...</option>${roles.map(r=>`<option value="${r.id}" ${String(r.id)===String(draft.rol_id)?'selected':''}>${esc(r.nombre)}</option>`).join('')}</select></label><label>Estado<select name="activo"><option value="1" ${draft.activo==='1'?'selected':''}>Activo</option><option value="0" ${draft.activo==='0'?'selected':''}>Inactivo</option></select></label></div><button class="btn" type="submit">${editing?'Guardar cambios':'Crear usuario'}</button>${editing?'<button class="btn secondary" type="button" id="cancelUser">Cancelar edición</button>':''}<div id="userMsg">${note?msg(note,'error'):''}</div></form>`:'';
   shell(`${form}<section class="card"><div class="crud-toolbar"><h2>Usuarios</h2><input id="userSearch" aria-label="Buscar usuarios" placeholder="Buscar por usuario, nombre o perfil..." value="${esc(q)}"></div>${!showForm&&note?msg(note,'error'):''}<div class="table-scroll"><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Perfil</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${visible.length?visible.map(u=>`<tr><td>${esc(u.usuario)}${Number(u.id)===Number(auth?.usuario?.id)?' (tú)':''}</td><td>${esc(u.nombre||'-')}</td><td>${esc(u.rol)}</td><td>${Number(u.activo)?'Activo':'Inactivo'}</td><td>${puede('usuarios.editar')?`<button class="btn small" data-user-edit="${u.id}">Editar</button>`:''}${puede('usuarios.eliminar')&&Number(u.id)!==Number(auth?.usuario?.id)?`<button class="btn small danger" data-user-delete="${u.id}">Eliminar</button>`:''}</td></tr>`).join(''):`<tr><td colspan="5">No hay usuarios para mostrar.</td></tr>`}</tbody></table></div>${paginacion(page,rows.length)}</section>`);
   $('#userSearch').oninput=debounce(e=>{q=e.target.value;page=0;load();},250);
   $('#userForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));Object.assign(body,{accion:editing?'actualizar':'crear',id:editing||0});try{const res=await api('usuarios',{method:'POST',body});editing=null;draft={usuario:'',nombre:'',clave:'',rol_id:'',activo:'1'};await load();note=res.mensaje;draw();}catch(err){if(!err.sesion){note=err.message;draw();}}});
   $('#cancelUser')?.addEventListener('click',()=>{editing=null;draft={usuario:'',nombre:'',clave:'',rol_id:'',activo:'1'};draw();});
   document.querySelectorAll('[data-user-edit]').forEach(b=>b.onclick=()=>{const u=rows.find(x=>String(x.id)===b.dataset.userEdit);if(!u)return;editing=u.id;draft={usuario:u.usuario,nombre:u.nombre||'',clave:'',rol_id:String(u.rol_id),activo:String(u.activo)};draw();window.scrollTo({top:0,behavior:'smooth'});});
   document.querySelectorAll('[data-user-delete]').forEach(b=>b.onclick=async()=>{const u=rows.find(x=>String(x.id)===b.dataset.userDelete);if(!u||!confirm(`¿Eliminar al usuario "${u.usuario}"?`))return;try{const res=await api('usuarios',{method:'POST',body:{accion:'eliminar',id:u.id}});await load();note=res.mensaje;draw();}catch(err){if(!err.sesion){note=err.message;draw();}}});
   enlazarPaginacion(page,rows.length,n=>{page=n;draw();});
 };
 await load();
}

async function roles(){
 let rows=[],q='',page=0,editing=null,note='',draft={nombre:'',descripcion:''};
 const load=async()=>{try{rows=await api('roles',{params:{q}});note='';}catch(e){if(e.sesion)return;rows=[];note=e.message;}draw();};
 const draw=()=>{
   const visible=rows.slice(page*PAGINA_SEGURIDAD,(page+1)*PAGINA_SEGURIDAD),showForm=puede('roles.crear')||editing;
   const form=showForm?`<form class="card crud-form" id="roleForm"><h2>${editing?'Editar perfil':'Nuevo perfil / rol'}</h2><div class="crud-fields"><label>Nombre *<input name="nombre" value="${esc(draft.nombre)}" required minlength="3" maxlength="60"></label><label>Descripción<input name="descripcion" value="${esc(draft.descripcion)}" maxlength="200"></label></div><button class="btn" type="submit">${editing?'Guardar cambios':'Crear perfil'}</button>${editing?'<button class="btn secondary" type="button" id="cancelRole">Cancelar edición</button>':''}<div id="roleMsg">${note?msg(note,'error'):''}</div></form>`:'';
   shell(`${form}<section class="card"><div class="crud-toolbar"><h2>Perfiles / roles</h2><input id="roleSearch" aria-label="Buscar perfiles" placeholder="Buscar perfil..." value="${esc(q)}"></div>${!showForm&&note?msg(note,'error'):''}<p class="subsaludo">Los permisos de cada perfil se asignan en la sección <strong>Permisos</strong>.</p><div class="table-scroll"><table><thead><tr><th>Perfil</th><th>Descripción</th><th>Usuarios</th><th>Permisos</th><th>Acciones</th></tr></thead><tbody>${visible.length?visible.map(r=>`<tr><td>${esc(r.nombre)}${Number(r.sistema)?' 🔒':''}</td><td>${esc(r.descripcion||'-')}</td><td>${esc(r.usuarios)}</td><td>${esc(r.permisos)}</td><td>${puede('roles.editar')?`<button class="btn small" data-role-edit="${r.id}">Editar</button>`:''}${puede('roles.eliminar')&&!Number(r.sistema)?`<button class="btn small danger" data-role-delete="${r.id}">Eliminar</button>`:''}</td></tr>`).join(''):`<tr><td colspan="5">No hay perfiles para mostrar.</td></tr>`}</tbody></table></div>${paginacion(page,rows.length)}</section>`);
   $('#roleSearch').oninput=debounce(e=>{q=e.target.value;page=0;load();},250);
   $('#roleForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));Object.assign(body,{accion:editing?'actualizar':'crear',id:editing||0});try{const res=await api('roles',{method:'POST',body});editing=null;draft={nombre:'',descripcion:''};await load();note=res.mensaje;draw();}catch(err){if(!err.sesion){note=err.message;draw();}}});
   $('#cancelRole')?.addEventListener('click',()=>{editing=null;draft={nombre:'',descripcion:''};draw();});
   document.querySelectorAll('[data-role-edit]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>String(x.id)===b.dataset.roleEdit);if(!r)return;editing=r.id;draft={nombre:r.nombre,descripcion:r.descripcion||''};draw();window.scrollTo({top:0,behavior:'smooth'});});
   document.querySelectorAll('[data-role-delete]').forEach(b=>b.onclick=async()=>{const r=rows.find(x=>String(x.id)===b.dataset.roleDelete);if(!r||!confirm(`¿Eliminar el perfil "${r.nombre}"?`))return;try{const res=await api('roles',{method:'POST',body:{accion:'eliminar',id:r.id}});await load();note=res.mensaje;draw();}catch(err){if(!err.sesion){note=err.message;draw();}}});
   enlazarPaginacion(page,rows.length,n=>{page=n;draw();});
 };
 await load();
}

async function permisos(){
 let data={permisos:[],roles:[]},q='',page=0,editing=null,note='',draft={codigo:'',descripcion:''};
 const load=async()=>{try{data=await api('permisos',{params:{q}});note='';}catch(e){if(e.sesion)return;data={permisos:[],roles:[]};note=e.message;}draw();};
 const draw=()=>{
   const rows=data.permisos||[],rolesList=data.roles||[],visible=rows.slice(page*PAGINA_SEGURIDAD,(page+1)*PAGINA_SEGURIDAD),showForm=puede('permisos.crear')||editing;
   const form=showForm?`<form class="card crud-form" id="permissionForm"><h2>${editing?'Editar permiso':'Nuevo permiso'}</h2><div class="crud-fields"><label>Código * (modulo.accion)<input name="codigo" value="${esc(draft.codigo)}" required maxlength="60" placeholder="reportes.ver" ${editing&&Number(editing.sistema)?'disabled':''}></label><label>Descripción<input name="descripcion" value="${esc(draft.descripcion)}" maxlength="200"></label></div><button class="btn" type="submit">${editing?'Guardar cambios':'Crear permiso'}</button>${editing?'<button class="btn secondary" type="button" id="cancelPermission">Cancelar edición</button>':''}<div id="permissionMsg">${note?msg(note,'error'):''}</div></form>`:'';
   shell(`${form}<section class="card"><div class="crud-toolbar"><h2>Permisos por perfil</h2><input id="permissionSearch" aria-label="Buscar permisos" placeholder="Buscar permiso..." value="${esc(q)}"></div>${!showForm&&note?msg(note,'error'):''}<p class="subsaludo">Marca o desmarca una casilla para asignar o revocar el permiso. El perfil <strong>Dueño 🔒</strong> siempre conserva todos los permisos.${!puede('roles.editar')?' (Solo lectura: no tienes permiso para asignar.)':''}</p><div class="table-scroll"><table><thead><tr><th>Permiso</th><th>Descripción</th>${rolesList.map(r=>`<th>${esc(r.nombre)}${Number(r.sistema)?' 🔒':''}</th>`).join('')}<th>Acciones</th></tr></thead><tbody>${visible.length?visible.map(p=>`<tr><td><code>${esc(p.codigo)}</code></td><td>${esc(p.descripcion||'-')}</td>${rolesList.map(r=>{const checked=Number(r.sistema)===1||(p.roles||[]).includes(Number(r.id));return `<td style="text-align:center"><input type="checkbox" style="width:auto" aria-label="${esc(r.nombre)} puede ${esc(p.codigo)}" data-grant="${p.id}" data-role="${r.id}" ${checked?'checked':''} ${Number(r.sistema)===1||!puede('roles.editar')?'disabled':''}></td>`;}).join('')}<td>${puede('permisos.editar')?`<button class="btn small" data-permission-edit="${p.id}">Editar</button>`:''}${puede('permisos.eliminar')&&!Number(p.sistema)?`<button class="btn small danger" data-permission-delete="${p.id}">Eliminar</button>`:''}</td></tr>`).join(''):`<tr><td colspan="${rolesList.length+3}">No hay permisos para mostrar.</td></tr>`}</tbody></table></div>${paginacion(page,rows.length)}</section>`);
   $('#permissionSearch').oninput=debounce(e=>{q=e.target.value;page=0;load();},250);
   $('#permissionForm')?.addEventListener('submit',async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.currentTarget));Object.assign(body,{accion:editing?'actualizar':'crear',id:editing?.id||0});try{const res=await api('permisos',{method:'POST',body});editing=null;draft={codigo:'',descripcion:''};await load();note=res.mensaje;draw();}catch(err){if(!err.sesion){note=err.message;draw();}}});
   $('#cancelPermission')?.addEventListener('click',()=>{editing=null;draft={codigo:'',descripcion:''};draw();});
   document.querySelectorAll('[data-permission-edit]').forEach(b=>b.onclick=()=>{const p=rows.find(x=>String(x.id)===b.dataset.permissionEdit);if(!p)return;editing=p;draft={codigo:p.codigo,descripcion:p.descripcion||''};draw();window.scrollTo({top:0,behavior:'smooth'});});
   document.querySelectorAll('[data-permission-delete]').forEach(b=>b.onclick=async()=>{const p=rows.find(x=>String(x.id)===b.dataset.permissionDelete);if(!p||!confirm(`¿Eliminar el permiso "${p.codigo}"? Se quitará de todos los perfiles.`))return;try{const res=await api('permisos',{method:'POST',body:{accion:'eliminar',id:p.id}});await load();note=res.mensaje;draw();}catch(err){if(!err.sesion){note=err.message;draw();}}});
   document.querySelectorAll('[data-grant]').forEach(c=>c.onchange=async()=>{try{const res=await api('permisos',{method:'POST',body:{accion:'asignar',rol_id:c.dataset.role,permiso_id:c.dataset.grant,concedido:c.checked}});note=res.mensaje;const p=rows.find(x=>String(x.id)===c.dataset.grant),rid=Number(c.dataset.role);if(c.checked&&!p.roles.includes(rid))p.roles.push(rid);if(!c.checked)p.roles=p.roles.filter(x=>x!==rid);draw();}catch(err){c.checked=!c.checked;if(!err.sesion){note=err.message;draw();}}});
   enlazarPaginacion(page,rows.length,n=>{page=n;draw();});
 };
 await load();
}

async function renderTab(){
 if(tab==='dashboard')return dashboard();
 if(tab==='pacientes')return pacientes();
 if(tab==='citas')return citas();
 if(tab==='historial')return historial();
 if(tab==='crud')return crud();
 if(tab==='usuarios')return usuarios();
 if(tab==='roles')return roles();
 if(tab==='permisos')return permisos();
 return configuracion();
}

async function init(){
 try{
  cfg=await api('config');
  document.title=cfg.nombreSistema;
  Object.entries(cfg.colores||{}).forEach(([k,v])=>document.documentElement.style.setProperty(`--${k}`,v));
  const s=await api('sesion');
  if(s.autenticado){auth=s;renderTab();}else{auth=null;renderLogin();}
 }catch(e){
  shell(`<section class="card"><h2>No se pudo conectar con el servidor</h2><p>${esc(e.message)}</p><p>Verifica que PHP y MySQL estén activos y que exista backend/api/config.php.</p></section>`,false);
 }
}
init();
})();

