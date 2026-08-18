/* =========================================================
   CONFIGURACIÓN
   ========================================================= */
const API_URL =
  "https://script.google.com/macros/s/AKfycby_s71nWYP7kswOuTHPZfQ8uHUIV5HASbOAP9qLHjTXet09c833gCD32uBNyZAY8gdN/exec";

const TIMEOUT_MS = 30000;
let afiliados = [];
let filtrados = [];
let seleccionado = null;
let filtroActual = "TODOS";
let claveCifrado = sessionStorage.getItem("jac_afiliados_clave") || "";

/* =========================================================
   JSONP
   ========================================================= */
function jsonp(params){
  return new Promise((resolve,reject)=>{
    const callback =
      "certificacionJsonp_" +
      Date.now() +
      "_" +
      Math.random().toString(36).slice(2);

    const script = document.createElement("script");
    let terminado = false;

    function limpiar(){
      try{ delete window[callback]; }catch(e){}
      try{ script.remove(); }catch(e){}
    }

    const timer = setTimeout(()=>{
      if(terminado) return;
      terminado = true;
      limpiar();
      reject(new Error("Tiempo de espera agotado al contactar Apps Script."));
    }, TIMEOUT_MS);

    window[callback] = data=>{
      if(terminado) return;
      terminado = true;
      clearTimeout(timer);
      limpiar();

      if(data && data.ok !== false){
        resolve(data);
      }else{
        reject(new Error((data && data.error) || "Apps Script rechazó la operación."));
      }
    };

    script.onerror = ()=>{
      if(terminado) return;
      terminado = true;
      clearTimeout(timer);
      limpiar();
      reject(new Error("No fue posible comunicarse con Google Apps Script."));
    };

    params.callback = callback;

    const query = new URLSearchParams();
    Object.keys(params).forEach(key=>{
      if(params[key] !== undefined && params[key] !== null){
        query.set(key,String(params[key]));
      }
    });

    script.src = API_URL + "?" + query.toString();
    document.head.appendChild(script);
  });
}

/* =========================================================
   CIFRADO: MISMA LÓGICA DE ADMIN.AFILIADOS.HTML
   ========================================================= */
function b64ToBytes(str){
  const binary = atob(str);
  const out = new Uint8Array(binary.length);

  for(let i=0;i<binary.length;i++){
    out[i] = binary.charCodeAt(i);
  }

  return out;
}

async function deriveKey(password,salt){
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name:"PBKDF2",
      salt,
      iterations:250000,
      hash:"SHA-256"
    },
    material,
    {
      name:"AES-GCM",
      length:256
    },
    false,
    ["encrypt","decrypt"]
  );
}

async function descifrarObjeto(encrypted){
  if(!claveCifrado){
    throw new Error("Debe establecer la clave de cifrado.");
  }

  const pack =
    typeof encrypted === "string"
      ? JSON.parse(encrypted)
      : encrypted;

  const salt = b64ToBytes(pack.salt);
  const iv = b64ToBytes(pack.iv);
  const ciphertext = b64ToBytes(pack.ciphertext);

  const key = await deriveKey(claveCifrado,salt);

  const plain = await crypto.subtle.decrypt(
    {
      name:"AES-GCM",
      iv
    },
    key,
    ciphertext
  );

  return JSON.parse(
    new TextDecoder().decode(plain)
  );
}

/* =========================================================
   FOTOGRAFÍA
   ========================================================= */
async function obtenerFotoAfiliado(afiliado){
  if(!afiliado || !afiliado.fotoId){
    return "";
  }

  try{
    const response = await jsonp({
      action:"photoGet",
      fileId:afiliado.fotoId
    });

    if(!response || response.ok === false){
      return "";
    }

    const value =
      response.dataUrl ||
      response.data ||
      response.photo ||
      response.foto ||
      response.url ||
      "";

    if(String(value).startsWith("data:")){
      return String(value);
    }

    if(response.base64){
      return (
        "data:" +
        (response.mime || response.contentType || "image/jpeg") +
        ";base64," +
        response.base64
      );
    }

    if(
      /^[A-Za-z0-9+/=\s]+$/.test(String(value)) &&
      String(value).length > 100
    ){
      return (
        "data:" +
        (response.mime || response.contentType || "image/jpeg") +
        ";base64," +
        String(value).replace(/\s/g,"")
      );
    }

    return String(value);

  }catch(error){
    console.warn("No se pudo cargar fotografía:",afiliado.id,error);
    return "";
  }
}

async function hidratarFotografias(){
  const pendientes =
    afiliados.filter(a=>a.fotoId && !a.foto);

  if(!pendientes.length){
    return;
  }

  for(let i=0;i<pendientes.length;i+=4){

    const grupo = pendientes.slice(i,i+4);

    await Promise.all(
      grupo.map(async afiliado=>{
        const foto = await obtenerFotoAfiliado(afiliado);

        if(foto){
          afiliado.foto = foto;
        }
      })
    );

    renderAfiliados();

    if(
      seleccionado &&
      grupo.some(x=>x.id === seleccionado.id)
    ){
      actualizarFichaSeleccionada();
    }
  }
}

/* =========================================================
   CONSULTA PRINCIPAL
   ========================================================= */
async function cargarAfiliados(){

  setSync("Consultando...", "wait");

  document.getElementById("listaAfiliados").innerHTML = `
    <div class="empty">
      <div class="spinner-ring"></div>
      <h5 class="mt-3">Sincronizando afiliados</h5>
      <p>Consultando Google Sheets y descifrando los registros.</p>
    </div>
  `;

  if(!claveCifrado){
    setSync("Clave requerida","wait");
    abrirClave();

    document.getElementById("listaAfiliados").innerHTML = `
      <div class="empty">
        <i class="bi bi-shield-lock"></i>
        <h5 class="mt-3">Base protegida</h5>
        <p>Ingrese la misma clave utilizada en la Base de Afiliados.</p>
      </div>
    `;

    return;
  }

  try{

    const response = await jsonp({
      action:"list"
    });

    const raw =
      Array.isArray(response.afiliados)
        ? response.afiliados
        : [];

    if(raw.length === 0){
      afiliados = [];
      actualizarKpis();
      renderAfiliados();
      setSync("Base vacía","wait");
      return;
    }

    const decoded = [];
    let errores = 0;

    for(const row of raw){

      try{

        if(!row.encrypted){
          errores++;
          continue;
        }

        const data =
          await descifrarObjeto(row.encrypted);

        decoded.push({
          ...data,
          id:row.id,
          estado:
            row.estado ||
            data.estado ||
            "ACTIVO",
          fechaRegistro:row.fechaRegistro,
          ultimaActualizacion:row.ultimaActualizacion,
          usuario:row.usuario
        });

      }catch(error){

        errores++;

        console.warn(
          "No se pudo descifrar afiliado",
          row.id,
          error
        );
      }
    }

    afiliados = decoded;

    actualizarKpis();
    renderAfiliados();

    if(decoded.length){
      setSync("Base sincronizada","on");
      document.getElementById("kSeguridad").textContent =
        errores ? "Revisar" : "Protegida";
    }else{

      // La clave se guarda por pestaña con sessionStorage.
      // Si la pestaña conserva una clave anterior/incorrecta, la limpiamos
      // para obligar a introducir nuevamente la MISMA clave usada por
      // admin.afiliados.html. Esto evita quedar atrapado en un estado de
      // "clave incorrecta" después de cambiar de pestaña o de versión.
      claveCifrado = "";
      sessionStorage.removeItem("jac_afiliados_clave");

      setSync("Clave requerida","wait");

      document.getElementById("listaAfiliados").innerHTML = `
        <div class="empty">
          <i class="bi bi-shield-exclamation"></i>
          <h5 class="mt-3">Clave de cifrado requerida</h5>
          <p>
            Apps Script está conectado. Introduce nuevamente la misma clave
            utilizada para cifrar la Base de Afiliados.
          </p>
          <button class="btn-jac btn-light-jac mt-2" onclick="abrirClave()">
            <i class="bi bi-key"></i> Introducir clave
          </button>
        </div>
      `;

      abrirClave();
    }

    hidratarFotografias();

  }catch(error){

    console.error(error);

    setSync("Error de conexión","off");

    document.getElementById("listaAfiliados").innerHTML = `
      <div class="empty">
        <i class="bi bi-cloud-slash"></i>
        <h5 class="mt-3">No se pudo conectar</h5>
        <p>${escapeHtml(error.message || "Revisa Apps Script.")}</p>
        <button class="btn-jac btn-light-jac mt-2" onclick="cargarAfiliados()">
          <i class="bi bi-arrow-clockwise"></i> Reintentar
        </button>
      </div>
    `;
  }
}

/* =========================================================
   RENDER DE AFILIADOS
   ========================================================= */
function setFiltro(filtro,button){

  filtroActual = filtro;

  document.querySelectorAll(".filter")
    .forEach(x=>x.classList.remove("active"));

  button.classList.add("active");

  renderAfiliados();
}

function renderAfiliados(){

  const query =
    (document.getElementById("buscarAfiliado").value || "")
      .toLowerCase()
      .trim();

  let lista = afiliados.slice();

  if(filtroActual === "ACTIVOS"){
    lista = lista.filter(
      a=>String(a.estado || "ACTIVO").toUpperCase() === "ACTIVO"
    );
  }

  if(filtroActual === "INACTIVOS"){
    lista = lista.filter(
      a=>String(a.estado || "").toUpperCase() !== "ACTIVO"
    );
  }

  lista = lista.filter(a=>{

    const texto = [
      a.id,
      a.nombres,
      a.apellidos,
      a.numeroDocumento,
      a.documento,
      a.tipoDocumento,
      a.numeroAfiliacion,
      a.telefono,
      a.correo,
      a.cargo,
      a.calidadAfiliado,
      a.comite
    ].join(" ").toLowerCase();

    return texto.includes(query);
  });

  filtrados = lista;

  document.getElementById("contador").textContent =
    lista.length;

  const container =
    document.getElementById("listaAfiliados");

  if(!lista.length){

    container.innerHTML = `
      <div class="empty">
        <i class="bi bi-person-x"></i>
        <h5 class="mt-3">No hay afiliados para mostrar</h5>
        <p>
          ${afiliados.length
            ? "Pruebe otra búsqueda o cambie el filtro."
            : "No se encontraron registros descifrados en la base."
          }
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML =
    lista.map(a=>{

      const nombre =
        `${a.nombres || ""} ${a.apellidos || ""}`.trim()
        || `Afiliado ${a.id}`;

      const documento =
        `${a.tipoDocumento || "Documento"}: ${
          a.numeroDocumento || a.documento || "No registrado"
        }`;

      const foto =
        a.foto
          ? `<img src="${escapeAttr(a.foto)}" alt="Foto">`
          : `<span>${iniciales(a)}</span>`;

      const activo =
        String(a.estado || "ACTIVO").toUpperCase() === "ACTIVO";

      return `
        <div
          class="person ${seleccionado && seleccionado.id === a.id ? "active" : ""}"
          onclick="seleccionarAfiliado('${escapeJs(a.id)}')"
        >

          <div class="person-photo">
            ${foto}
          </div>

          <div style="min-width:0;flex:1">
            <div class="person-name">
              ${escapeHtml(nombre)}
            </div>

            <div class="person-meta">
              ${escapeHtml(documento)}
              · ${escapeHtml(a.numeroAfiliacion || a.id)}
            </div>
          </div>

          <span class="person-state"
            style="${
              activo
                ? ""
                : "background:#f1f3f5;color:#667085"
            }">
            ${activo ? "ACTIVO" : "INACTIVO"}
          </span>

        </div>
      `;
    }).join("");
}

function seleccionarAfiliado(id){

  seleccionado =
    afiliados.find(a=>String(a.id) === String(id));

  if(!seleccionado){
    return;
  }

  document.getElementById("sinSeleccion").style.display = "none";
  document.getElementById("editorCert").style.display = "block";

  actualizarFichaSeleccionada();
  prepararTexto();
  actualizarPreview();
  renderAfiliados();

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}

function actualizarFichaSeleccionada(){

  if(!seleccionado){
    return;
  }

  const nombre =
    `${seleccionado.nombres || ""} ${seleccionado.apellidos || ""}`.trim()
    || `Afiliado ${seleccionado.id}`;

  const documento =
    `${seleccionado.tipoDocumento || "Documento"}: ${
      seleccionado.numeroDocumento ||
      seleccionado.documento ||
      "No registrado"
    }`;

  document.getElementById("nombreSeleccionado").textContent =
    nombre;

  document.getElementById("documentoSeleccionado").textContent =
    documento;

  document.getElementById("afiliacionSeleccionada").textContent =
    "Afiliación: " +
    (seleccionado.numeroAfiliacion || seleccionado.id);

  document.getElementById("dFechaAfiliacion").textContent =
    formatearFecha(seleccionado.fechaAfiliacion);

  document.getElementById("dCalidad").textContent =
    seleccionado.calidadAfiliado || "Afiliado(a)";

  document.getElementById("dCargo").textContent =
    seleccionado.cargo || "Sin cargo registrado";

  const activo =
    String(seleccionado.estado || "ACTIVO").toUpperCase() === "ACTIVO";

  const badge =
    document.getElementById("estadoSeleccionado");

  badge.innerHTML =
    activo
      ? '<i class="bi bi-check-circle me-1"></i> ACTIVO'
      : '<i class="bi bi-dash-circle me-1"></i> INACTIVO';

  badge.style.color =
    activo ? "var(--verde)" : "#667085";

  badge.style.background =
    activo ? "#fff" : "#f5f5f5";

  const photo =
    document.getElementById("fotoSeleccionada");

  if(seleccionado.foto){

    photo.innerHTML =
      `<img src="${escapeAttr(seleccionado.foto)}" alt="Foto del afiliado">`;

  }else{

    photo.innerHTML =
      `<span>${iniciales(seleccionado)}</span>`;
  }

  const pFoto =
    document.getElementById("pFoto");

  if(seleccionado.foto){

    pFoto.innerHTML =
      `<img src="${escapeAttr(seleccionado.foto)}" alt="Foto">`;

  }else{

    pFoto.innerHTML =
      `<span>${iniciales(seleccionado)}</span>`;
  }
}

/* =========================================================
   TEXTO INSTITUCIONAL
   ========================================================= */
function prepararTexto(){

  if(!seleccionado){
    return;
  }

  const nombre =
    `${seleccionado.nombres || ""} ${seleccionado.apellidos || ""}`.trim()
    || "el(la) afiliado(a)";

  const tipoDoc =
    seleccionado.tipoDocumento ||
    "documento de identidad";

  const numeroDoc =
    seleccionado.numeroDocumento ||
    seleccionado.documento ||
    "________";

  const numeroAf =
    seleccionado.numeroAfiliacion ||
    seleccionado.id ||
    "________";

  const tipo =
    document.getElementById("tipoCertificacion").value;

  let texto = "";

  switch(tipo){

    case "VIGENCIA":

      texto =
        `Que el(la) señor(a) ${nombre.toUpperCase()}, ` +
        `identificado(a) con ${tipoDoc} No. ${numeroDoc}, ` +
        `se encuentra registrado(a) como afiliado(a) activo(a) ` +
        `de la Junta de Acción Comunal Vereda Santa Bárbara, ` +
        `con número de afiliación ${numeroAf}.`;

      break;

    case "PERTENENCIA":

      texto =
        `Que el(la) señor(a) ${nombre.toUpperCase()}, ` +
        `identificado(a) con ${tipoDoc} No. ${numeroDoc}, ` +
        `pertenece a la Base de Afiliados de la Junta de Acción ` +
        `Comunal Vereda Santa Bárbara, Municipio de El Bagre, Antioquia, ` +
        `bajo el número de afiliación ${numeroAf}.`;

      break;

    case "DIRECTIVA":

      texto =
        `Que el(la) señor(a) ${nombre.toUpperCase()}, ` +
        `identificado(a) con ${tipoDoc} No. ${numeroDoc}, ` +
        `se encuentra registrado(a) en la Base de Afiliados ` +
        `de la Junta de Acción Comunal Vereda Santa Bárbara ` +
        `y figura con el cargo de ${seleccionado.cargo || "—"}.`;

      break;

    case "PERSONALIZADA":

      texto =
        `Que el(la) señor(a) ${nombre.toUpperCase()}, ` +
        `identificado(a) con ${tipoDoc} No. ${numeroDoc}, ` +
        `se encuentra registrado(a) en los archivos institucionales ` +
        `de la Junta de Acción Comunal Vereda Santa Bárbara.`;

      break;

    default:

      texto =
        `Que el(la) señor(a) ${nombre.toUpperCase()}, ` +
        `identificado(a) con ${tipoDoc} No. ${numeroDoc}, ` +
        `se encuentra registrado(a) como afiliado(a) de la Junta ` +
        `de Acción Comunal Vereda Santa Bárbara, Municipio de ` +
        `El Bagre, Antioquia, con número de afiliación ${numeroAf}.`;

      break;
  }

  document.getElementById("textoCertificacion").value =
    texto;
}

/* =========================================================
   PREVIEW
   ========================================================= */
function actualizarPreview(){

  const tipo =
    document.getElementById("tipoCertificacion").value;

  const titulos = {
    AFILIACION:"CERTIFICACIÓN DE AFILIACIÓN",
    VIGENCIA:"CONSTANCIA DE VIGENCIA",
    PERTENENCIA:"CONSTANCIA DE PERTENENCIA",
    DIRECTIVA:"CONSTANCIA DE CARGO / DIRECTIVA",
    PERSONALIZADA:"CERTIFICACIÓN"
  };

  document.getElementById("pTitulo").textContent =
    titulos[tipo] || "CERTIFICACIÓN";

  const fecha =
    document.getElementById("fechaCertificacion").value;

  document.getElementById("pMunicipio").textContent =
    document.getElementById("municipioExpedicion").value ||
    "El Bagre · Antioquia";

  const numero =
    document.getElementById("numeroManual").value.trim()
    || generarNumero();

  document.getElementById("numeroCertificado").textContent =
    numero;

  document.getElementById("pNumero").textContent =
    numero;

  if(seleccionado){

    const nombre =
      `${seleccionado.nombres || ""} ${seleccionado.apellidos || ""}`.trim()
      || `Afiliado ${seleccionado.id}`;

    const documento =
      `${seleccionado.tipoDocumento || "Documento"} No. ${
        seleccionado.numeroDocumento ||
        seleccionado.documento ||
        "—"
      }`;

    document.getElementById("pNombre").textContent =
      nombre.toUpperCase();

    document.getElementById("pDocumento").textContent =
      documento;

    document.getElementById("pTexto").textContent =
      document.getElementById("textoCertificacion").value ||
      "";

  }else{

    document.getElementById("pNombre").textContent =
      "SELECCIONE UN AFILIADO";

    document.getElementById("pDocumento").textContent =
      "Documento: —";

    document.getElementById("pTexto").textContent =
      "Seleccione un afiliado para visualizar la certificación.";
  }

  const observacion =
    document.getElementById("observacionesCertificacion").value.trim();

  const pObs =
    document.getElementById("pObservacion");

  if(observacion){

    pObs.style.display = "block";
    pObs.textContent = "Observaciones: " + observacion;

  }else{

    pObs.style.display = "none";
    pObs.textContent = "";
  }

  const responsable =
    document.getElementById("responsableCertificacion").value.trim();

  const cargo =
    document.getElementById("cargoResponsable").value.trim();

  document.getElementById("pResponsable").textContent =
    responsable || "Presidente(a) de la Junta de Acción Comunal";

  document.getElementById("pCargo").textContent =
    cargo || "Junta de Acción Comunal Vereda Santa Bárbara";
}

/* =========================================================
   NUEVA CERTIFICACIÓN
   ========================================================= */
function nuevaCertificacion(){

  seleccionado = null;

  document.getElementById("editorCert").style.display = "none";
  document.getElementById("sinSeleccion").style.display = "block";

  document.getElementById("numeroCertificado").textContent =
    "CERT-—";

  document.getElementById("numeroManual").value = "";

  document.getElementById("observacionesCertificacion").value = "";

  document.getElementById("responsableCertificacion").value = "";

  document.getElementById("cargoResponsable").value =
    "Presidente(a) de la Junta de Acción Comunal";

  renderAfiliados();
}

/* =========================================================
   CLAVE
   ========================================================= */
function abrirClave(){

  document.getElementById("claveError").style.display =
    "none";

  document.getElementById("inputClave").value =
    claveCifrado || "";

  document.getElementById("modalClave").classList.add("show");

  setTimeout(()=>{
    document.getElementById("inputClave").focus();
  },100);
}

function cerrarClave(){
  document.getElementById("modalClave").classList.remove("show");
}

async function guardarClaveYConsultar(){

  const input =
    document.getElementById("inputClave");

  const clave =
    input.value.trim();

  if(!clave){

    mostrarErrorClave(
      "Debe ingresar la clave de cifrado."
    );

    return;
  }

  claveCifrado = clave;

  sessionStorage.setItem(
    "jac_afiliados_clave",
    claveCifrado
  );

  cerrarClave();

  await cargarAfiliados();
}

function mostrarErrorClave(texto){

  const box =
    document.getElementById("claveError");

  box.textContent = texto;
  box.style.display = "block";
}

/* =========================================================
   NÚMERO DE CERTIFICADO
   ========================================================= */
function generarNumero(){

  const fecha = new Date();

  const y =
    fecha.getFullYear();

  const m =
    String(fecha.getMonth()+1).padStart(2,"0");

  const d =
    String(fecha.getDate()).padStart(2,"0");

  const sufijo =
    seleccionado
      ? String(seleccionado.id).replace(/^AF-/,"")
      : "0000";

  return `CERT-${y}${m}${d}-${sufijo}`;
}

/* =========================================================
   PDF INSTITUCIONAL
   ========================================================= */
async function generarPDF(){

  if(!seleccionado){

    alert("Seleccione un afiliado antes de generar la certificación.");

    return;
  }

  const btn =
    document.getElementById("btnGenerarPDF");

  const original =
    btn.innerHTML;

  btn.disabled = true;
  btn.innerHTML =
    '<span class="spinner-ring"></span> Generando...';

  try{

    const jsPDF =
      window.jspdf.jsPDF;

    const doc =
      new jsPDF({
        unit:"mm",
        format:"letter",
        orientation:"portrait"
      });

    const W = 216;
    const H = 279;
    const M = 18;

    const C = {
      verde:[8,116,66],
      verdeClaro:[234,247,240],
      dorado:[179,138,62],
      tinta:[31,41,55],
      gris:[100,116,139],
      grisClaro:[225,231,235],
      blanco:[255,255,255]
    };

    const nombre =
      `${seleccionado.nombres || ""} ${seleccionado.apellidos || ""}`.trim()
      || `Afiliado ${seleccionado.id}`;

    const tipoDoc =
      seleccionado.tipoDocumento ||
      "Documento";

    const numeroDoc =
      seleccionado.numeroDocumento ||
      seleccionado.documento ||
      "—";

    const numeroAf =
      seleccionado.numeroAfiliacion ||
      seleccionado.id ||
      "—";

    const titulo =
      document.getElementById("pTitulo").textContent;

    const numero =
      document.getElementById("numeroManual").value.trim()
      || generarNumero();

    const fecha =
      document.getElementById("fechaCertificacion").value;

    const municipio =
      document.getElementById("municipioExpedicion").value ||
      "El Bagre, Antioquia";

    const texto =
      document.getElementById("textoCertificacion").value;

    const observaciones =
      document.getElementById("observacionesCertificacion").value.trim();

    const responsable =
      document.getElementById("responsableCertificacion").value.trim()
      || "Presidente(a) de la Junta de Acción Comunal";

    const cargo =
      document.getElementById("cargoResponsable").value.trim()
      || "Junta de Acción Comunal Vereda Santa Bárbara";

    /* Encabezado */
    doc.setFillColor(...C.verde);
    doc.rect(0,0,W,7,"F");

    doc.setFillColor(...C.dorado);
    doc.rect(0,7,W,1.4,"F");

    /* Logo */
    try{

      const logo =
        await cargarImagenPDF(
          "assets/logo.png"
        );

      if(logo){

        doc.addImage(
          logo,
          "PNG",
          M,
          16,
          23,
          23
        );
      }

    }catch(e){}

    doc.setFont("helvetica","bold");
    doc.setFontSize(12);
    doc.setTextColor(...C.verde);
    doc.text(
      "JUNTA DE ACCIÓN COMUNAL",
      M+31,
      21
    );

    doc.setFontSize(10);
    doc.text(
      "VEREDA SANTA BÁRBARA",
      M+31,
      27
    );

    doc.setFont("helvetica","normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gris);
    doc.text(
      "El Bagre · Antioquia",
      M+31,
      32
    );

    doc.setFillColor(...C.verdeClaro);
    doc.roundedRect(
      151,
      15,
      47,
      24,
      3,
      3,
      "F"
    );

    doc.setFont("helvetica","bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...C.verde);
    doc.text(
      "CERTIFICADO",
      155,
      22
    );

    doc.setFont("helvetica","normal");
    doc.setFontSize(6.7);
    doc.setTextColor(...C.gris);
    doc.text(
      "Registro institucional",
      155,
      27
    );

    doc.setFont("helvetica","bold");
    doc.setFontSize(7.2);
    doc.setTextColor(...C.tinta);
    doc.text(
      numero,
      155,
      33
    );

    doc.setDrawColor(...C.dorado);
    doc.setLineWidth(.5);
    doc.line(
      M,
      45,
      W-M,
      45
    );

    /* Título */
    doc.setFont("helvetica","bold");
    doc.setFontSize(17);
    doc.setTextColor(...C.dorado);

    doc.text(
      titulo,
      W/2,
      62,
      {align:"center"}
    );

    doc.setFont("helvetica","normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gris);

    doc.text(
      `${municipio} · ${formatearFechaLarga(fecha)}`,
      W/2,
      69,
      {align:"center"}
    );

    /* Tarjeta del afiliado */
    doc.setFillColor(249,251,250);
    doc.setDrawColor(...C.grisClaro);
    doc.roundedRect(
      M,
      80,
      W-(M*2),
      40,
      4,
      4,
      "FD"
    );

    if(seleccionado.foto){

      try{

        const formato =
          String(seleccionado.foto)
            .startsWith("data:image/png")
            ? "PNG"
            : "JPEG";

        doc.addImage(
          seleccionado.foto,
          formato,
          M+5,
          86,
          28,
          28
        );

      }catch(e){

        doc.setFillColor(...C.verdeClaro);
        doc.circle(
          M+19,
          100,
          14,
          "F"
        );
      }

    }else{

      doc.setFillColor(...C.verdeClaro);
      doc.circle(
        M+19,
        100,
        14,
        "F"
      );

      doc.setFont("helvetica","bold");
      doc.setFontSize(11);
      doc.setTextColor(...C.verde);

      doc.text(
        iniciales(seleccionado),
        M+19,
        103,
        {align:"center"}
      );
    }

    doc.setFont("helvetica","bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.verde);

    doc.text(
      "AFILIADO",
      M+40,
      91
    );

    doc.setFontSize(12);
    doc.setTextColor(...C.tinta);

    doc.text(
      nombre,
      M+40,
      99
    );

    doc.setFont("helvetica","normal");
    doc.setFontSize(8.2);
    doc.setTextColor(...C.gris);

    doc.text(
      `${tipoDoc}: ${numeroDoc}`,
      M+40,
      106
    );

    doc.text(
      `Número de afiliación: ${numeroAf}`,
      M+40,
      112
    );

    /* Cuerpo */
    let y = 134;

    doc.setFont("times","normal");
    doc.setFontSize(12);
    doc.setTextColor(...C.tinta);

    const body =
      doc.splitTextToSize(
        texto,
        W-(M*2)
      );

    doc.text(
      body,
      M,
      y,
      {lineHeightFactor:1.75}
    );

    y +=
      body.length * 6.2 +
      13;

    if(observaciones){

      doc.setFillColor(...C.verdeClaro);

      const obsLines =
        doc.splitTextToSize(
          observaciones,
          W-(M*2)-12
        );

      const obsHeight =
        12 + obsLines.length*5.2;

      doc.roundedRect(
        M,
        y,
        W-(M*2),
        obsHeight,
        3,
        3,
        "F"
      );

      doc.setFont("helvetica","bold");
      doc.setFontSize(7);
      doc.setTextColor(...C.verde);

      doc.text(
        "OBSERVACIONES",
        M+6,
        y+7
      );

      doc.setFont("times","normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...C.tinta);

      doc.text(
        obsLines,
        M+6,
        y+13,
        {lineHeightFactor:1.45}
      );

      y += obsHeight + 12;
    }

    doc.setFont("times","normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...C.tinta);

    const cierre =
      "Se expide la presente certificación a solicitud del interesado(a), " +
      "para los fines que estime pertinentes.";

    const cierreLines =
      doc.splitTextToSize(
        cierre,
        W-(M*2)
      );

    doc.text(
      cierreLines,
      M,
      y,
      {lineHeightFactor:1.6}
    );

    y += 28;

    /* Firma */
    doc.setDrawColor(120);
    doc.setLineWidth(.3);

    doc.line(
      72,
      y,
      144,
      y
    );

    doc.setFont("helvetica","bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...C.tinta);

    doc.text(
      responsable,
      W/2,
      y+7,
      {align:"center"}
    );

    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.gris);

    doc.text(
      cargo,
      W/2,
      y+13,
      {align:"center"}
    );

    /* Pie */
    doc.setDrawColor(...C.dorado);
    doc.setLineWidth(.5);

    doc.line(
      M,
      H-17,
      W-M,
      H-17
    );

    doc.setFont("helvetica","bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.verde);

    doc.text(
      "JUNTA DE ACCIÓN COMUNAL VEREDA SANTA BÁRBARA",
      W/2,
      H-11,
      {align:"center"}
    );

    doc.setFont("helvetica","normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.gris);

    doc.text(
      `${municipio} · Documento generado desde el Sistema Administrativo de la JAC`,
      W/2,
      H-7,
      {align:"center"}
    );

    doc.save(
      `Certificacion_${limpiarNombreArchivo(nombre)}_${numero.replace(/[^a-zA-Z0-9-]/g,"")}.pdf`
    );

    registrarHistorial({
      id:seleccionado.id,
      nombre,
      numero,
      tipo:titulo,
      fecha:fecha || new Date().toISOString().slice(0,10)
    });

    actualizarContadorHistorial();

  }catch(error){

    console.error(error);
    alert(
      "No fue posible generar el PDF: " +
      (error.message || error)
    );

  }finally{

    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function cargarImagenPDF(src){

  return new Promise((resolve,reject)=>{

    const image = new Image();

    image.onload = ()=>{
      resolve(image);
    };

    image.onerror = reject;

    image.src = src;
  });
}

/* =========================================================
   IMPRESIÓN
   ========================================================= */
function imprimirVista(){
  const vista=document.getElementById("documentoVista");
  if(!vista){ alert("No se encontró la vista previa del certificado."); return; }
  const ventana=window.open("","_blank","width=900,height=1100");
  if(!ventana){ alert("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio."); return; }
  const estilos=`
    <style>
      @page{size:letter;margin:14mm}
      body{font-family:Arial,Helvetica,sans-serif;color:#263238;margin:0;background:#fff}
      .print-wrap{max-width:760px;margin:auto}
      img{max-width:100%}
      *{box-sizing:border-box}
    </style>`;
  ventana.document.open();
  ventana.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Certificación</title>'+estilos+'</head><body><div class="print-wrap">');
  ventana.document.write(vista.innerHTML);
  ventana.document.write('</div></body></html>');
  ventana.document.close();
  ventana.onload=function(){ ventana.focus(); setTimeout(function(){ ventana.print(); },250); };
}

/* =========================================================
   HISTORIAL LOCAL
   ========================================================= */
function obtenerHistorial(){

  try{

    return JSON.parse(
      localStorage.getItem(
        "jac_certificaciones_historial"
      ) || "[]"
    );

  }catch(e){

    return [];
  }
}

function registrarHistorial(item){

  const historial =
    obtenerHistorial();

  historial.unshift({
    ...item,
    generadoEn:new Date().toISOString()
  });

  localStorage.setItem(
    "jac_certificaciones_historial",
    JSON.stringify(
      historial.slice(0,30)
    )
  );

  renderHistorial();
}

function renderHistorial(){

  const historial =
    obtenerHistorial();

  const container =
    document.getElementById(
      "historialCertificados"
    );

  if(!historial.length){

    container.innerHTML =
      `<div class="history-empty">
        Todavía no se han generado certificados desde este navegador.
      </div>`;

    return;
  }

  container.innerHTML =
    historial.map(item=>{

      return `
        <div class="history-item">

          <div class="history-icon">
            <i class="bi bi-file-earmark-pdf"></i>
          </div>

          <div class="history-main">
            <strong>${escapeHtml(item.nombre)}</strong>
            <span>
              ${escapeHtml(item.tipo)}
              · ${escapeHtml(item.numero)}
              · ${escapeHtml(formatearFecha(item.fecha))}
            </span>
          </div>

          <button
            class="btn-jac btn-light-jac"
            style="padding:7px 9px;font-size:10px"
            onclick="seleccionarDesdeHistorial('${escapeJs(item.id)}')">
            <i class="bi bi-person"></i>
          </button>

        </div>
      `;
    }).join("");
}

function seleccionarDesdeHistorial(id){

  const afiliado =
    afiliados.find(
      a=>String(a.id) === String(id)
    );

  if(afiliado){

    seleccionado = afiliado;

    document.getElementById(
      "sinSeleccion"
    ).style.display = "none";

    document.getElementById(
      "editorCert"
    ).style.display = "block";

    actualizarFichaSeleccionada();
    prepararTexto();
    actualizarPreview();
    renderAfiliados();
  }
}

function actualizarContadorHistorial(){

  const total =
    obtenerHistorial().length;

  document.getElementById(
    "kCertificados"
  ).textContent = total;
}

/* =========================================================
   EVENTOS
   ========================================================= */
document
  .getElementById("tipoCertificacion")
  .addEventListener("change",()=>{
    prepararTexto();
    actualizarPreview();
  });

[
  "fechaCertificacion",
  "municipioExpedicion",
  "numeroManual",
  "textoCertificacion",
  "responsableCertificacion",
  "cargoResponsable",
  "observacionesCertificacion"
].forEach(id=>{

  document
    .getElementById(id)
    .addEventListener("input",actualizarPreview);
});

/* =========================================================
   KPIs
   ========================================================= */
function actualizarKpis(){

  const total =
    afiliados.length;

  const activos =
    afiliados.filter(
      a=>String(a.estado || "ACTIVO").toUpperCase() === "ACTIVO"
    ).length;

  document.getElementById("kTotal").textContent =
    total;

  document.getElementById("kActivos").textContent =
    activos;

  document.getElementById("kCertificados").textContent =
    obtenerHistorial().length;
}

/* =========================================================
   ESTADO
   ========================================================= */
function setSync(texto,estado){

  const badge =
    document.getElementById("syncStatus");

  const label =
    document.getElementById("syncText");

  label.textContent = texto;

  badge.classList.remove(
    "off",
    "wait"
  );

  if(estado === "off"){
    badge.classList.add("off");
    document.getElementById("kSeguridad").textContent =
      "Error";
  }else if(estado === "wait"){
    badge.classList.add("wait");
    document.getElementById("kSeguridad").textContent =
      "Esperando";
  }else{
    document.getElementById("kSeguridad").textContent =
      "OK";
  }
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function iniciales(a){

  const n =
    (a.nombres || "").trim();

  const p =
    (a.apellidos || "").trim();

  const result =
    (
      (n.charAt(0) || "") +
      (p.charAt(0) || "")
    ).toUpperCase();

  return result || "A";
}

function formatearFecha(valor){

  if(!valor){
    return "No registrada";
  }

  const fecha =
    new Date(valor);

  if(Number.isNaN(fecha.getTime())){
    return String(valor);
  }

  return fecha.toLocaleDateString(
    "es-CO",
    {
      day:"2-digit",
      month:"2-digit",
      year:"numeric"
    }
  );
}

function formatearFechaLarga(valor){

  if(!valor){
    return new Date().toLocaleDateString(
      "es-CO",
      {
        day:"numeric",
        month:"long",
        year:"numeric"
      }
    );
  }

  const fecha =
    new Date(valor + "T12:00:00");

  if(Number.isNaN(fecha.getTime())){
    return String(valor);
  }

  return fecha.toLocaleDateString(
    "es-CO",
    {
      day:"numeric",
      month:"long",
      year:"numeric"
    }
  );
}

function limpiarNombreArchivo(texto){

  return String(texto || "Afiliado")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zA-Z0-9_-]+/g,"_")
    .replace(/^_+|_+$/g,"");
}

function escapeHtml(value){

  return String(value ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function escapeAttr(value){
  return escapeHtml(value);
}

function escapeJs(value){

  return String(value ?? "")
    .replace(/\\/g,"\\\\")
    .replace(/'/g,"\\'");
}

/* =========================================================
   INICIALIZACIÓN
   ========================================================= */
document.getElementById(
  "fechaCertificacion"
).value =
  new Date().toISOString().slice(0,10);

document.getElementById(
  "municipioExpedicion"
).value =
  "El Bagre, Antioquia";

renderHistorial();
actualizarContadorHistorial();
actualizarKpis();
cargarAfiliados();
