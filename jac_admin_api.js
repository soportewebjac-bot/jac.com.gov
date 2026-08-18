/* JAC Santa Bárbara — API administrativa sin persistencia local. */
const JAC_ADMIN_API_URL = 'https://script.google.com/macros/s/AKfycbxGvEI8vHOU6PJZ6HdIt-JsahutDe7HJzTYyE7fQsIwPq5DMbZ-XHjLhFzlvc1fi5tf/exec';

function jacJsonp(params = {}) {
  return new Promise((resolve, reject) => {
    if (!JAC_ADMIN_API_URL || JAC_ADMIN_API_URL.includes('PEGA_AQUI')) {
      reject(new Error('Falta configurar la URL del backend administrativo.'));
      return;
    }
    const callback = '__jac_admin_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const query = new URLSearchParams({ ...params, callback });
    let done = false;
    const cleanup = () => { if (done) return; done = true; clearTimeout(timer); try { delete window[callback]; } catch (_) {} script.remove(); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Tiempo de espera del servidor.')); }, 20000);
    window[callback] = data => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('No fue posible conectar con el backend administrativo.')); };
    script.src = JAC_ADMIN_API_URL + '?' + query.toString();
    document.head.appendChild(script);
  });
}

async function jacSha256(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function jacLogin(usuario, password) {
  const passwordHash = await jacSha256(password);
  return jacJsonp({ action:'login', usuario, passwordHash });
}

function jacRequest(action, token, data = {}) {
  return jacJsonp({ action, token, ...data });
}
