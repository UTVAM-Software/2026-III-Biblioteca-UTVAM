// Ruta relativa: funciona en la raíz del dominio o dentro de una subcarpeta.
const BASE = 'api/index.php';

export async function api(ruta, { method = 'GET', params = {}, body } = {}) {
  const limpio = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  const qs = new URLSearchParams({ r: ruta, ...limpio }).toString();
  const opts = { method, credentials: 'same-origin', headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}?${qs}`, opts);
  const data = await res.json().catch(() => ({ error: 'Respuesta inválida del servidor.' }));
  if (res.status === 401 && ruta !== 'login') window.dispatchEvent(new Event('sesion-expirada'));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Error desconocido'), { status: res.status });
  return data;
}

export const urlFoto = (id) => `${BASE}?r=foto&id=${id}`;
export const urlCarnet = (id) => `${BASE}?r=carnet&id=${id}`;
