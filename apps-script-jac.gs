
const CONFIG = {

  SPREADSHEET_ID:
    '1bAgUIQL9HXPb62DXmmi-OGKKhindvtwtwcL6Kcp_0wU',

  HOJA_PQRS:
    'PQRS',

  CORREO_RECEPCION:
    'soportewebjac@gmail.com',

  NOMBRE_INSTITUCION:
    'Junta de Acción Comunal Vereda Santa Bárbara',

  MUNICIPIO:
    'El Bagre - Antioquia',

  ESTADO_INICIAL:
    'Recibida',

  /****************************************************************************************
   * CLAVE ADMINISTRATIVA PQRS
   *
   * Cambia esta clave antes de publicar. TambiÃ©n puedes definir una propiedad
   * de script llamada ADMIN_PQRS_PASSWORD para no dejarla escrita en el cÃ³digo.
   ****************************************************************************************/

  ADMIN_PQRS_PASSWORD:
    'JAC-SB-2026',

  /****************************************************************************************
   * DOCUMENTOS
   *
   * Si se deja vacío, el sistema buscará o creará automáticamente
   * una carpeta llamada "PQRS".
   ****************************************************************************************/

  CARPETA_DOCUMENTOS:
    '',

  NOMBRE_CARPETA_DOCUMENTOS:
    'PQRS',

  /****************************************************************************************
   * TAMAÑO MÁXIMO DEL PDF
   *
   * 10 MB
   ****************************************************************************************/

  MAX_PDF_BYTES:
    10 * 1024 * 1024

};


/****************************************************************************************
 * ENCABEZADOS OFICIALES
 *
 * Las primeras 10 columnas corresponden a la estructura original.
 * Las columnas 11 a 14 son de gestión.
 * Las columnas 15 a 17 corresponden al documento PDF.
 ****************************************************************************************/

const ENCABEZADOS_PQRS = [

  'Fecha',
  'Radicado',
  'Nombre completo',
  'Documento',
  'Teléfono',
  'Correo electrónico',
  'Tipo',
  'Asunto',
  'Descripción',
  'Estado',

  // Gestión
  'Respuesta',
  'Fecha respuesta',
  'Observaciones',
  'Fecha actualización',

  // Documento
  'Documento adjunto',
  'URL documento',
  'ID documento',

  // Documento de respuesta
  'Archivo respuesta',
  'URL respuesta',
  'ID respuesta'

];


/****************************************************************************************
 * ESTADOS PERMITIDOS
 ****************************************************************************************/

const ESTADOS_PQRS = [

  'Recibida',
  'En revisión',
  'En trámite',
  'Respondida',
  'Cerrada'

];


/****************************************************************************************
 * TIPOS PERMITIDOS
 ****************************************************************************************/

const TIPOS_PQRS = [

  'Petición',
  'Queja',
  'Reclamo',
  'Sugerencia'

];


/****************************************************************************************
 * DOGET
 *
 * Operaciones:
 * listarPQRS
 * listarSolicitudes
 * obtenerPQRS
 * detallePQRS
 ****************************************************************************************/

function doGet(e) {

  try {

    const parametros =
      e && e.parameter
        ? e.parameter
        : {};

    const accion =
      String(
        parametros.accion ||
        parametros.action ||
        parametros.op ||
        ''
      )
        .trim()
        .toLowerCase();


    /******************************************************
     * SERVICIO ACTIVO
     ******************************************************/

    if (!accion) {

      return respuestaJSON({

        ok: true,
        success: true,

        mensaje:
          'Servicio PQRS activo.',

        message:
          'Servicio PQRS activo.',

        servicio:
          'Sistema de recepción y gestión de PQRS',

        acciones: [

          'listarPQRS',
          'listarSolicitudes',
          'obtenerPQRS',
          'detallePQRS'

        ]

      });

    }


    /******************************************************
     * LISTAR
     ******************************************************/

    if (

      accion === 'listarpqrs' ||

      accion === 'listarsolicitudes' ||

      accion === 'listar'

    ) {

      validarAdminPQRS(
        parametros
      );

      return listarPQRS();

    }


    /******************************************************
     * OBTENER DETALLE
     ******************************************************/

    if (

      accion === 'obtenerpqrs' ||

      accion === 'detallepqrs' ||

      accion === 'verpqrs'

    ) {

      const radicado =
        limpiar(
          parametros.radicado ||
          parametros.id
        );

      return obtenerPQRS(
        radicado
      );

    }


    /******************************************************
     * ACCIÓN DESCONOCIDA
     ******************************************************/

    return respuestaJSON({

      ok: false,
      success: false,

      mensaje:
        'La acción solicitada no es válida.',

      message:
        'La acción solicitada no es válida.',

      accion:
        accion

    });


  } catch (error) {

    console.error(
      'ERROR DOGET:',
      error
    );

    return respuestaJSON({

      ok: false,
      success: false,

      mensaje:
        error.message ||
        'No fue posible completar la operación.',

      message:
        error.message ||
        'No fue posible completar la operación.'

    });

  }

}


/****************************************************************************************
 * DOPOST
 *
 * Operaciones:
 *
 * REGISTRAR
 * ACTUALIZAR_ESTADO
 * RESPONDER
 * ACTUALIZAR
 *
 * Para registrar un PDF:
 *
 * {
 *   "accion": "REGISTRAR",
 *   ...
 *   "documentoPDF": {
 *      "nombre": "documento.pdf",
 *      "mimeType": "application/pdf",
 *      "base64": "JVBERi0x..."
 *   }
 * }
 ****************************************************************************************/

function doPost(e) {

  try {

    if (
      !e ||
      !e.postData ||
      !e.postData.contents
    ) {

      throw new Error(
        'No se recibieron datos.'
      );

    }


    let datos;

    try {

      datos =
        JSON.parse(
          e.postData.contents
        );

    } catch (error) {

      throw new Error(
        'Los datos recibidos no tienen un formato JSON válido.'
      );

    }


    const accion =
      String(
        datos.accion ||
        datos.action ||
        ''
      )
        .trim()
        .toUpperCase();


    /******************************************************
     * REGISTRAR
     ******************************************************/

    if (

      accion === 'REGISTRAR' ||

      accion === 'REGISTRAR_PQRS' ||

      accion === 'CREAR'

    ) {

      return registrarPQRS(
        datos
      );

    }


    /******************************************************
     * CONSULTAR / OBTENER DETALLE
     ******************************************************/

    if (

      accion === 'CONSULTAR' ||

      accion === 'OBTENER' ||

      accion === 'OBTENER_PQRS' ||

      accion === 'OBTENERPQRS' ||

      accion === 'DETALLE' ||

      accion === 'DETALLE_PQRS' ||

      accion === 'DETALLEPQRS'

    ) {

      return obtenerPQRS(
        limpiar(
          datos.radicado ||
          datos.id
        )
      );

    }


    /******************************************************
     * ACTUALIZAR ESTADO
     ******************************************************/

    if (

      accion === 'ACTUALIZAR_ESTADO' ||

      accion === 'ACTUALIZAR_ESTADO_PQRS' ||

      accion === 'CAMBIAR_ESTADO'

    ) {

      validarAdminPQRS(
        datos
      );

      return actualizarEstadoPQRS(
        datos
      );

    }


    /******************************************************
     * RESPONDER
     ******************************************************/

    if (

      accion === 'RESPONDER' ||

      accion === 'RESPONDER_PQRS'

    ) {

      validarAdminPQRS(
        datos
      );

      return responderPQRS(
        datos
      );

    }


    /******************************************************
     * ACTUALIZAR COMPLETO
     ******************************************************/

    if (

      accion === 'ACTUALIZAR' ||

      accion === 'ACTUALIZAR_PQRS'

    ) {

      validarAdminPQRS(
        datos
      );

      return actualizarPQRS(
        datos
      );

    }


    throw new Error(
      'Acción no reconocida.'
    );


  } catch (error) {

    console.error(
      'ERROR DOPOST:',
      error
    );

    return respuestaJSON({

      ok: false,
      success: false,

      mensaje:
        error.message ||
        'No fue posible procesar la solicitud.',

      message:
        error.message ||
        'No fue posible procesar la solicitud.'

    });

  }

}


/****************************************************************************************
 * REGISTRAR PQRS
 *
 * Mantiene la recepción original.
 *
 * Si existe documentoPDF:
 * - valida PDF
 * - valida tamaño
 * - crea carpeta año
 * - crea carpeta radicado
 * - guarda PDF
 * - guarda nombre, URL e ID
 ****************************************************************************************/

function registrarPQRS(datos) {

  const lock =
    LockService.getScriptLock();

  try {

    lock.waitLock(
      15000
    );


    /******************************************************
     * DATOS
     ******************************************************/

    const nombre =
      limpiar(
        datos.nombre ||
        datos.nombreCompleto
      );

    const documento =
      limpiar(
        datos.documento
      );

    const telefono =
      limpiar(
        datos.telefono
      );

    const correo =
      limpiar(
        datos.correo ||
        datos.email
      );

    const tipo =
      limpiar(
        datos.tipo
      );

    const asunto =
      limpiar(
        datos.asunto
      );

    const descripcion =
      limpiar(
        datos.descripcion ||
        datos.mensaje
      );


    /******************************************************
     * VALIDACIONES
     ******************************************************/

    if (!nombre) {

      throw new Error(
        'El nombre completo es obligatorio.'
      );

    }


    if (!tipo) {

      throw new Error(
        'El tipo de solicitud es obligatorio.'
      );

    }


    if (
      TIPOS_PQRS.indexOf(
        tipo
      ) === -1
    ) {

      throw new Error(
        'El tipo de solicitud no es válido.'
      );

    }


    if (!asunto) {

      throw new Error(
        'El asunto es obligatorio.'
      );

    }


    if (!descripcion) {

      throw new Error(
        'La descripción de la solicitud es obligatoria.'
      );

    }


    if (
      correo &&
      !validarCorreo(correo)
    ) {

      throw new Error(
        'El correo electrónico no tiene un formato válido.'
      );

    }


    /******************************************************
     * SPREADSHEET
     ******************************************************/

    const spreadsheet =
      SpreadsheetApp.openById(
        CONFIG.SPREADSHEET_ID
      );

    const hoja =
      obtenerHojaPQRS(
        spreadsheet
      );


    /******************************************************
     * RADICADO
     ******************************************************/

    const radicado =
      generarRadicado(
        hoja
      );


    const fecha =
      new Date();


    /******************************************************
     * DOCUMENTO PDF
     ******************************************************/

    let documentoGuardado =
      null;


    if (
      datos.documentoPDF
    ) {

      documentoGuardado =
        guardarDocumentoPDF(
          datos.documentoPDF,
          radicado
        );

    }


    /******************************************************
     * REGISTRO
     ******************************************************/

    hoja.appendRow([

      fecha,
      radicado,
      nombre,
      documento,
      telefono,
      correo,
      tipo,
      asunto,
      descripcion,
      CONFIG.ESTADO_INICIAL,

      '',

      '',

      '',

      fecha,

      documentoGuardado
        ? documentoGuardado.nombre
        : '',

      documentoGuardado
        ? documentoGuardado.url
        : '',

      documentoGuardado
        ? documentoGuardado.id
        : '',

      '',

      '',

      ''

    ]);


    const ultimaFila =
      hoja.getLastRow();


    /******************************************************
     * FORMATO DE FECHAS
     ******************************************************/

    hoja
      .getRange(
        ultimaFila,
        1
      )
      .setNumberFormat(
        'dd/MM/yyyy HH:mm:ss'
      );


    hoja
      .getRange(
        ultimaFila,
        12
      )
      .setNumberFormat(
        'dd/MM/yyyy HH:mm:ss'
      );


    hoja
      .getRange(
        ultimaFila,
        14
      )
      .setNumberFormat(
        'dd/MM/yyyy HH:mm:ss'
      );


    SpreadsheetApp.flush();


    /******************************************************
     * CORREO A LA JAC
     ******************************************************/

    enviarCorreoRecepcion({

      radicado:
        radicado,

      fecha:
        fecha,

      nombre:
        nombre,

      documento:
        documento,

      telefono:
        telefono,

      correo:
        correo,

      tipo:
        tipo,

      asunto:
        asunto,

      descripcion:
        descripcion,

      documentoAdjunto:
        documentoGuardado
          ? documentoGuardado.nombre
          : '',

      urlDocumento:
        documentoGuardado
          ? documentoGuardado.url
          : ''

    });


    /******************************************************
     * CONFIRMACIÓN AL CIUDADANO
     ******************************************************/

    if (correo) {

      enviarConfirmacionCiudadano({

        radicado:
          radicado,

        fecha:
          fecha,

        nombre:
          nombre,

        correo:
          correo,

        tipo:
          tipo,

        asunto:
          asunto,

        documentoAdjunto:
          documentoGuardado
            ? documentoGuardado.nombre
            : '',

        urlDocumento:
          documentoGuardado
            ? documentoGuardado.url
            : ''

      });

    }


    /******************************************************
     * RESPUESTA
     ******************************************************/

    return respuestaJSON({

      ok: true,
      success: true,

      mensaje:
        documentoGuardado
          ? 'La PQRS y el documento PDF fueron registrados correctamente.'
          : 'La PQRS fue registrada correctamente.',

      message:
        documentoGuardado
          ? 'La PQRS y el documento PDF fueron registrados correctamente.'
          : 'La PQRS fue registrada correctamente.',

      radicado:
        radicado,

      documento:
        documentoGuardado
          ? documentoGuardado.nombre
          : '',

      urlDocumento:
        documentoGuardado
          ? documentoGuardado.url
          : '',

      documentoGuardado:
        !!documentoGuardado

    });


  } catch (error) {

    console.error(
      'ERROR REGISTRAR PQRS:',
      error
    );

    return respuestaJSON({

      ok: false,
      success: false,

      mensaje:
        error.message ||
        'No fue posible registrar la PQRS.',

      message:
        error.message ||
        'No fue posible registrar la PQRS.'

    });


  } finally {

    try {

      lock.releaseLock();

    } catch (e) {}

  }

}


/****************************************************************************************
 * GUARDAR DOCUMENTO PDF
 ****************************************************************************************/

function guardarDocumentoPDF(
  archivo,
  radicado
) {

  if (
    !archivo
  ) {

    return null;

  }


  const nombreOriginal =
    limpiar(
      archivo.nombre ||
      archivo.name ||
      'documento.pdf'
    );


  const mimeType =
    limpiar(
      archivo.mimeType ||
      archivo.type ||
      'application/pdf'
    );


  const base64 =
    limpiar(
      archivo.base64 ||
      archivo.data ||
      ''
    );


  if (!base64) {

    throw new Error(
      'El documento PDF no contiene información válida.'
    );

  }


  /******************************************************
   * VALIDAR EXTENSIÓN
   ******************************************************/

  if (
    !/\.pdf$/i.test(
      nombreOriginal
    )
  ) {

    throw new Error(
      'Solo se permiten archivos PDF.'
    );

  }


  /******************************************************
   * VALIDAR MIME
   ******************************************************/

  if (
    mimeType &&
    mimeType !== 'application/pdf' &&
    mimeType !== 'application/octet-stream'
  ) {

    throw new Error(
      'El archivo seleccionado no es un PDF válido.'
    );

  }


  /******************************************************
   * LIMPIAR BASE64
   ******************************************************/

  let contenidoBase64 =
    base64;


  if (
    contenidoBase64.indexOf(
      'base64,'
    ) !== -1
  ) {

    contenidoBase64 =
      contenidoBase64.split(
        'base64,'
      )[1];

  }


  /******************************************************
   * DECODIFICAR
   ******************************************************/

  let bytes;

  try {

    bytes =
      Utilities.base64Decode(
        contenidoBase64
      );

  } catch (error) {

    throw new Error(
      'No fue posible procesar el archivo PDF.'
    );

  }


  /******************************************************
   * VALIDAR TAMAÑO
   ******************************************************/

  if (
    bytes.length >
    CONFIG.MAX_PDF_BYTES
  ) {

    throw new Error(
      'El PDF supera el tamaño máximo permitido de 10 MB.'
    );

  }


  if (
    bytes.length === 0
  ) {

    throw new Error(
      'El archivo PDF está vacío.'
    );

  }


  /******************************************************
   * VALIDAR FIRMA PDF
   *
   * Un PDF normalmente comienza con:
   * %PDF-
   ******************************************************/

  const primerosBytes =
    bytes
      .slice(
        0,
        5
      );


  const firmaPDF =
    String.fromCharCode.apply(
      null,
      primerosBytes
    );


  if (
    firmaPDF !==
    '%PDF-'
  ) {

    throw new Error(
      'El archivo seleccionado no parece ser un PDF válido.'
    );

  }


  /******************************************************
   * CARPETA PRINCIPAL
   ******************************************************/

  const carpetaPrincipal =
    obtenerCarpetaDocumentos();


  /******************************************************
   * CARPETA DEL AÑO
   ******************************************************/

  const anio =
    String(
      new Date().getFullYear()
    );


  const carpetaAnio =
    obtenerOCrearCarpeta(
      carpetaPrincipal,
      anio
    );


  /******************************************************
   * CARPETA DEL RADICADO
   ******************************************************/

  const carpetaRadicado =
    obtenerOCrearCarpeta(
      carpetaAnio,
      radicado
    );


  /******************************************************
   * NOMBRE SEGURO
   ******************************************************/

  const nombreSeguro =
    limpiarNombreArchivo(
      nombreOriginal
    );


  /******************************************************
   * CREAR BLOB
   ******************************************************/

  const blob =
    Utilities.newBlob(
      bytes,
      'application/pdf',
      nombreSeguro
    );


  /******************************************************
   * CREAR ARCHIVO
   ******************************************************/

  const archivoDrive =
    carpetaRadicado.createFile(
      blob
    );


  /******************************************************
   * DESCRIPCIÓN
   ******************************************************/

  archivoDrive.setDescription(

    'Documento adjunto de PQRS ' +
    radicado +
    ' - ' +
    CONFIG.NOMBRE_INSTITUCION

  );


  /******************************************************
   * ACCESO POR ENLACE
   *
   * Se utiliza para que posteriormente el ciudadano
   * pueda consultar el documento desde seguimiento.
   ******************************************************/

  try {

    archivoDrive.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );

  } catch (error) {

    console.warn(
      'No fue posible configurar acceso por enlace:',
      error
    );

  }


  /******************************************************
   * RESULTADO
   ******************************************************/

  return {

    nombre:
      nombreOriginal,

    url:
      archivoDrive.getUrl(),

    id:
      archivoDrive.getId()

  };

}


/****************************************************************************************
 * OBTENER CARPETA PRINCIPAL
 ****************************************************************************************/

function obtenerCarpetaDocumentos() {

  /******************************************************
   * SI CONFIGURAMOS ID DIRECTAMENTE
   ******************************************************/

  if (
    CONFIG.CARPETA_DOCUMENTOS
  ) {

    try {

      return DriveApp.getFolderById(
        CONFIG.CARPETA_DOCUMENTOS
      );

    } catch (error) {

      throw new Error(
        'La carpeta configurada para documentos no existe o no es accesible.'
      );

    }

  }


  /******************************************************
   * BUSCAR CARPETA POR NOMBRE
   ******************************************************/

  const carpetas =
    DriveApp.getFoldersByName(
      CONFIG.NOMBRE_CARPETA_DOCUMENTOS
    );


  if (
    carpetas.hasNext()
  ) {

    return carpetas.next();

  }


  /******************************************************
   * CREAR CARPETA
   ******************************************************/

  return DriveApp.createFolder(
    CONFIG.NOMBRE_CARPETA_DOCUMENTOS
  );

}


/****************************************************************************************
 * OBTENER O CREAR SUBCARPETA
 ****************************************************************************************/

function obtenerOCrearCarpeta(
  carpetaPadre,
  nombre
) {

  const carpetas =
    carpetaPadre.getFoldersByName(
      nombre
    );


  if (
    carpetas.hasNext()
  ) {

    return carpetas.next();

  }


  return carpetaPadre.createFolder(
    nombre
  );

}


/****************************************************************************************
 * LIMPIAR NOMBRE DE ARCHIVO
 ****************************************************************************************/

function limpiarNombreArchivo(
  nombre
) {

  let resultado =
    String(
      nombre ||
      'documento.pdf'
    );


  resultado =
    resultado.replace(
      /[\\\/:*?"<>|#%{}[\]]/g,
      '_'
    );


  resultado =
    resultado.replace(
      /\s+/g,
      ' '
    )
    .trim();


  if (
    !/\.pdf$/i.test(
      resultado
    )
  ) {

    resultado +=
      '.pdf';

  }


  return resultado;

}


/****************************************************************************************
 * OBTENER / CREAR HOJA PQRS
 ****************************************************************************************/

function obtenerHojaPQRS(
  spreadsheet
) {

  let hoja =
    spreadsheet.getSheetByName(
      CONFIG.HOJA_PQRS
    );


  /******************************************************
   * CREAR HOJA SI NO EXISTE
   ******************************************************/

  if (!hoja) {

    hoja =
      spreadsheet.insertSheet(
        CONFIG.HOJA_PQRS
      );

  }


  /******************************************************
   * ASEGURAR COLUMNAS FÍSICAS
   ******************************************************/

  const columnasNecesarias =
    ENCABEZADOS_PQRS.length;

  const maxColumnas =
    hoja.getMaxColumns();


  if (
    maxColumnas <
    columnasNecesarias
  ) {

    hoja.insertColumnsAfter(

      maxColumnas,

      columnasNecesarias -
      maxColumnas

    );

  }


  /******************************************************
   * CREAR ENCABEZADOS SI NO EXISTEN
   ******************************************************/

  if (
    hoja.getLastRow() === 0
  ) {

    hoja
      .getRange(
        1,
        1,
        1,
        ENCABEZADOS_PQRS.length
      )
      .setValues([
        ENCABEZADOS_PQRS
      ]);

  }


  /******************************************************
   * AGREGAR SOLO ENCABEZADOS FALTANTES
   ******************************************************/

  asegurarEncabezadosPQRS(
    hoja
  );


  /******************************************************
   * FORMATO
   ******************************************************/

  const encabezados =
    hoja.getRange(
      1,
      1,
      1,
      ENCABEZADOS_PQRS.length
    );


  encabezados
    .setFontWeight('bold')
    .setBackground('#0f5b35')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');


  hoja.setFrozenRows(
    1
  );


  /******************************************************
   * ANCHOS
   ******************************************************/

  const anchos = [

    145,
    145,
    220,
    140,
    140,
    230,
    120,
    240,
    420,
    130,
    380,
    155,
    300,
    170,
    260,
    350,
    300

  ];


  for (
    let i = 0;
    i < anchos.length;
    i++
  ) {

    hoja.setColumnWidth(
      i + 1,
      anchos[i]
    );

  }


  return hoja;

}


/****************************************************************************************
 * ASEGURAR ENCABEZADOS
 *
 * NO modifica encabezados existentes.
 * Solo coloca encabezados en columnas vacías.
 ****************************************************************************************/

function asegurarEncabezadosPQRS(
  hoja
) {

  const cantidad =
    ENCABEZADOS_PQRS.length;


  const encabezados =
    hoja
      .getRange(
        1,
        1,
        1,
        cantidad
      )
      .getValues()[0];


  for (
    let i = 0;
    i < cantidad;
    i++
  ) {

    const actual =
      limpiar(
        encabezados[i]
      );


    if (!actual) {

      hoja
        .getRange(
          1,
          i + 1
        )
        .setValue(
          ENCABEZADOS_PQRS[i]
        );

    }

  }

}


/****************************************************************************************
 * VALIDAR ADMINISTRADOR PQRS
 ****************************************************************************************/

function obtenerClaveAdminPQRS() {

  try {

    const clavePropiedad =
      PropertiesService
        .getScriptProperties()
        .getProperty(
          'ADMIN_PQRS_PASSWORD'
        );

    if (
      limpiar(
        clavePropiedad
      )
    ) {

      return limpiar(
        clavePropiedad
      );

    }

  } catch (error) {

    console.warn(
      'No fue posible leer ADMIN_PQRS_PASSWORD:',
      error
    );

  }

  return limpiar(
    CONFIG.ADMIN_PQRS_PASSWORD
  );

}


function validarAdminPQRS(
  datos
) {

  const claveConfigurada =
    obtenerClaveAdminPQRS();

  const claveRecibida =
    limpiar(
      datos.adminClave ||
      datos.adminPassword ||
      datos.claveAdmin ||
      datos.password ||
      datos.token
    );

  if (
    !claveConfigurada ||
    claveRecibida !== claveConfigurada
  ) {

    throw new Error(
      'Acceso no autorizado. Verifica la clave administrativa.'
    );

  }

}


/****************************************************************************************
 * LISTAR PQRS
 ****************************************************************************************/

function listarPQRS() {

  const spreadsheet =
    SpreadsheetApp.openById(
      CONFIG.SPREADSHEET_ID
    );


  const hoja =
    obtenerHojaPQRS(
      spreadsheet
    );


  const ultimaFila =
    hoja.getLastRow();


  if (
    ultimaFila < 2
  ) {

    return respuestaJSON({

      ok: true,
      success: true,

      total: 0,

      pqrs: [],
      solicitudes: [],
      data: [],
      rows: []

    });

  }


  const valores =
    hoja
      .getRange(
        1,
        1,
        ultimaFila,
        ENCABEZADOS_PQRS.length
      )
      .getValues();


  const lista = [];


  for (
    let i = 1;
    i < valores.length;
    i++
  ) {

    const fila =
      valores[i];


    if (
      fila.every(
        function(valor) {

          return (
            valor === '' ||
            valor === null ||
            typeof valor === 'undefined'
          );

        }
      )
    ) {

      continue;

    }


    const item =
      convertirFilaPQRS(
        fila,
        i + 1
      );


    lista.push(
      item
    );

  }


  return respuestaJSON({

    ok: true,
    success: true,

    total:
      lista.length,

    pqrs:
      lista,

    solicitudes:
      lista,

    data:
      lista,

    rows:
      lista

  });

}


/****************************************************************************************
 * CONVERTIR FILA PQRS
 ****************************************************************************************/

function convertirFilaPQRS(
  fila,
  numeroFila
) {

  return {

    fila:
      numeroFila,

    fecha:
      convertirFechaJSON(
        fila[0]
      ),

    radicado:
      limpiar(
        fila[1]
      ),

    nombre:
      limpiar(
        fila[2]
      ),

    documento:
      limpiar(
        fila[3]
      ),

    telefono:
      limpiar(
        fila[4]
      ),

    correo:
      limpiar(
        fila[5]
      ),

    tipo:
      limpiar(
        fila[6]
      ),

    asunto:
      limpiar(
        fila[7]
      ),

    descripcion:
      limpiar(
        fila[8]
      ),

    estado:
      limpiar(
        fila[9]
      ) ||
      CONFIG.ESTADO_INICIAL,

    respuesta:
      limpiar(
        fila[10]
      ),

    fechaRespuesta:
      convertirFechaJSON(
        fila[11]
      ),

    observaciones:
      limpiar(
        fila[12]
      ),

    fechaActualizacion:
      convertirFechaJSON(
        fila[13]
      ),

    documentoAdjunto:
      limpiar(
        fila[14]
      ),

    urlDocumento:
      limpiar(
        fila[15]
      ),

    idDocumento:
      limpiar(
        fila[16]
      ),

    archivoRespuesta:
      limpiar(
        fila[17]
      ),

    urlRespuesta:
      limpiar(
        fila[18]
      ),

    idRespuesta:
      limpiar(
        fila[19]
      ),

    nombreArchivo:
      limpiar(
        fila[17]
      ),

    archivoUrl:
      limpiar(
        fila[18]
      ),

    urlArchivo:
      limpiar(
        fila[18]
      )

  };

}


/****************************************************************************************
 * OBTENER PQRS POR RADICADO
 ****************************************************************************************/

function obtenerPQRS(
  radicado
) {

  if (!radicado) {

    return respuestaJSON({

      ok: false,
      success: false,

      mensaje:
        'El número de radicado es obligatorio.',

      message:
        'El número de radicado es obligatorio.'

    });

  }


  const spreadsheet =
    SpreadsheetApp.openById(
      CONFIG.SPREADSHEET_ID
    );


  const hoja =
    obtenerHojaPQRS(
      spreadsheet
    );


  const ultimaFila =
    hoja.getLastRow();


  if (
    ultimaFila < 2
  ) {

    return respuestaJSON({

      ok: false,
      success: false,

      mensaje:
        'No existen PQRS registradas.',

      message:
        'No existen PQRS registradas.'

    });

  }


  const datos =
    hoja
      .getRange(
        2,
        1,
        ultimaFila - 1,
        ENCABEZADOS_PQRS.length
      )
      .getValues();


  for (
    let i = 0;
    i < datos.length;
    i++
  ) {

    if (
      limpiar(
        datos[i][1]
      ) ===
      limpiar(
        radicado
      )
    ) {

      const item =
        convertirFilaPQRS(
          datos[i],
          i + 2
        );


      return respuestaJSON({

        ok: true,
        success: true,

        pqrs:
          item,

        data:
          item

      });

    }

  }


  return respuestaJSON({

    ok: false,
    success: false,

    mensaje:
      'No se encontró la PQRS ' +
      radicado,

    message:
      'No se encontró la PQRS ' +
      radicado

  });

}


/****************************************************************************************
 * ACTUALIZAR ESTADO
 ****************************************************************************************/

function actualizarEstadoPQRS(
  datos
) {

  const lock =
    LockService.getScriptLock();


  try {

    lock.waitLock(
      15000
    );


    const radicado =
      limpiar(
        datos.radicado ||
        datos.id
      );


    const estado =
      limpiar(
        datos.estado
      );


    if (!radicado) {

      throw new Error(
        'El radicado es obligatorio.'
      );

    }


    if (
      ESTADOS_PQRS.indexOf(
        estado
      ) === -1
    ) {

      throw new Error(
        'El estado indicado no es válido.'
      );

    }


    const hoja =
      obtenerHojaPQRS(
        SpreadsheetApp.openById(
          CONFIG.SPREADSHEET_ID
        )
      );


    const fila =
      buscarFilaPorRadicado(
        hoja,
        radicado
      );


    if (!fila) {

      throw new Error(
        'No se encontró la PQRS ' +
        radicado
      );

    }


    const ahora =
      new Date();


    hoja
      .getRange(
        fila,
        10
      )
      .setValue(
        estado
      );


    hoja
      .getRange(
        fila,
        14
      )
      .setValue(
        ahora
      )
      .setNumberFormat(
        'dd/MM/yyyy HH:mm:ss'
      );


    /******************************************************
     * PDF DE RESPUESTA
     ******************************************************/

    const archivoRespuestaPayload =
      obtenerArchivoRespuestaPayload(
        datos
      );


    if (
      archivoRespuestaPayload
    ) {

      const archivoRespuestaGuardado =
        guardarDocumentoPDF(
          archivoRespuestaPayload,
          radicado
        );


      hoja
        .getRange(
          fila,
          18
        )
        .setValue(
          archivoRespuestaGuardado.nombre
        );


      hoja
        .getRange(
          fila,
          19
        )
        .setValue(
          archivoRespuestaGuardado.url
        );


      hoja
        .getRange(
          fila,
          20
        )
        .setValue(
          archivoRespuestaGuardado.id
        );

    }


    SpreadsheetApp.flush();


    const datosActualizados =
      hoja
        .getRange(
          fila,
          1,
          1,
          ENCABEZADOS_PQRS.length
        )
        .getValues()[0];


    const pqrsActualizada =
      convertirFilaPQRS(
        datosActualizados,
        fila
      );


    return respuestaJSON({

      ok: true,
      success: true,

      mensaje:
        'Estado actualizado correctamente.',

      message:
        'Estado actualizado correctamente.',

      radicado:
        radicado,

      estado:
        estado,

      archivoRespuesta:
        pqrsActualizada.archivoRespuesta,

      urlRespuesta:
        pqrsActualizada.urlRespuesta,

      pqrs:
        pqrsActualizada,

      data:
        pqrsActualizada

    });


  } finally {

    try {

      lock.releaseLock();

    } catch (e) {}

  }

}


/****************************************************************************************
 * RESPONDER PQRS
 ****************************************************************************************/

function responderPQRS(
  datos
) {

  const lock =
    LockService.getScriptLock();


  try {

    lock.waitLock(
      15000
    );


    const radicado =
      limpiar(
        datos.radicado ||
        datos.id
      );


    const respuesta =
      limpiar(
        datos.respuesta ||
        datos.mensaje
      );


    const observaciones =
      limpiar(
        datos.observaciones
      );


    const estadoRespuesta =
      limpiar(
        datos.estado
      ) ||
      'Respondida';


    if (!radicado) {

      throw new Error(
        'El radicado es obligatorio.'
      );

    }


    if (!respuesta) {

      throw new Error(
        'La respuesta es obligatoria.'
      );

    }


    if (
      ESTADOS_PQRS.indexOf(
        estadoRespuesta
      ) === -1
    ) {

      throw new Error(
        'El estado indicado no es válido.'
      );

    }


    const spreadsheet =
      SpreadsheetApp.openById(
        CONFIG.SPREADSHEET_ID
      );


    const hoja =
      obtenerHojaPQRS(
        spreadsheet
      );


    const fila =
      buscarFilaPorRadicado(
        hoja,
        radicado
      );


    if (!fila) {

      throw new Error(
        'No se encontró la PQRS ' +
        radicado
      );

    }


    const ahora =
      new Date();


    /******************************************************
     * LEER DATOS DEL CIUDADANO
     ******************************************************/

    const datosFila =
      hoja
        .getRange(
          fila,
          1,
          1,
          ENCABEZADOS_PQRS.length
        )
        .getValues()[0];


    const nombre =
      limpiar(
        datosFila[2]
      );


    const correo =
      limpiar(
        datosFila[5]
      );


    const tipo =
      limpiar(
        datosFila[6]
      );


    const asunto =
      limpiar(
        datosFila[7]
      );


    /******************************************************
     * GUARDAR RESPUESTA
     ******************************************************/

    hoja
      .getRange(
        fila,
        10
      )
      .setValue(
        estadoRespuesta
      );


    hoja
      .getRange(
        fila,
        11
      )
      .setValue(
        respuesta
      );


    hoja
      .getRange(
        fila,
        12
      )
      .setValue(
        ahora
      )
      .setNumberFormat(
        'dd/MM/yyyy HH:mm:ss'
      );


    hoja
      .getRange(
        fila,
        13
      )
      .setValue(
        observaciones
      );


    hoja
      .getRange(
        fila,
        14
      )
      .setValue(
        ahora
      )
      .setNumberFormat(
        'dd/MM/yyyy HH:mm:ss'
      );


    /******************************************************
     * PDF DE RESPUESTA
     ******************************************************/

    const archivoRespuestaPayload =
      obtenerArchivoRespuestaPayload(
        datos
      );


    let archivoRespuestaGuardado =
      null;


    if (
      archivoRespuestaPayload
    ) {

      archivoRespuestaGuardado =
        guardarDocumentoPDF(
          archivoRespuestaPayload,
          radicado
        );


      hoja
        .getRange(
          fila,
          18
        )
        .setValue(
          archivoRespuestaGuardado.nombre
        );


      hoja
        .getRange(
          fila,
          19
        )
        .setValue(
          archivoRespuestaGuardado.url
        );


      hoja
        .getRange(
          fila,
          20
        )
        .setValue(
          archivoRespuestaGuardado.id
        );

    }


    SpreadsheetApp.flush();


    const datosActualizados =
      hoja
        .getRange(
          fila,
          1,
          1,
          ENCABEZADOS_PQRS.length
        )
        .getValues()[0];


    const pqrsActualizada =
      convertirFilaPQRS(
        datosActualizados,
        fila
      );


    /******************************************************
     * ENVIAR RESPUESTA AL CIUDADANO
     ******************************************************/

    let correoEnviado =
      false;


    if (
      correo &&
      validarCorreo(correo)
    ) {

      enviarRespuestaCiudadano({

        correo:
          correo,

        nombre:
          nombre,

        radicado:
          radicado,

        tipo:
          tipo,

        asunto:
          asunto,

        respuesta:
          respuesta,

        estado:
          estadoRespuesta,

        documentoRespuesta:
          archivoRespuestaGuardado
            ? archivoRespuestaGuardado.nombre
            : pqrsActualizada.archivoRespuesta,

        urlRespuesta:
          archivoRespuestaGuardado
            ? archivoRespuestaGuardado.url
            : pqrsActualizada.urlRespuesta

      });


      correoEnviado =
        true;

    }


    return respuestaJSON({

      ok: true,
      success: true,

      mensaje:
        correoEnviado
          ? 'Respuesta registrada y enviada al ciudadano.'
          : 'Respuesta registrada correctamente. El ciudadano no tiene un correo válido.',

      message:
        correoEnviado
          ? 'Respuesta registrada y enviada al ciudadano.'
          : 'Respuesta registrada correctamente. El ciudadano no tiene un correo válido.',

      radicado:
        radicado,

      estado:
        estadoRespuesta,

      correoEnviado:
        correoEnviado,

      archivoRespuesta:
        pqrsActualizada.archivoRespuesta,

      urlRespuesta:
        pqrsActualizada.urlRespuesta,

      pqrs:
        pqrsActualizada,

      data:
        pqrsActualizada

    });


  } finally {

    try {

      lock.releaseLock();

    } catch (e) {}

  }

}


/****************************************************************************************
 * ACTUALIZAR PQRS
 ****************************************************************************************/

function actualizarPQRS(
  datos
) {

  const lock =
    LockService.getScriptLock();


  try {

    lock.waitLock(
      15000
    );


    const radicado =
      limpiar(
        datos.radicado ||
        datos.id
      );


    if (!radicado) {

      throw new Error(
        'El radicado es obligatorio.'
      );

    }


    const hoja =
      obtenerHojaPQRS(
        SpreadsheetApp.openById(
          CONFIG.SPREADSHEET_ID
        )
      );


    const fila =
      buscarFilaPorRadicado(
        hoja,
        radicado
      );


    if (!fila) {

      throw new Error(
        'No se encontró la PQRS ' +
        radicado
      );

    }


    const ahora =
      new Date();


    /******************************************************
     * ESTADO
     ******************************************************/

    if (
      typeof datos.estado !==
      'undefined'
    ) {

      const estado =
        limpiar(
          datos.estado
        );


      if (
        ESTADOS_PQRS.indexOf(
          estado
        ) === -1
      ) {

        throw new Error(
          'El estado indicado no es válido.'
        );

      }


      hoja
        .getRange(
          fila,
          10
        )
        .setValue(
          estado
        );

    }


    /******************************************************
     * RESPUESTA
     ******************************************************/

    if (
      typeof datos.respuesta !==
      'undefined'
    ) {

      hoja
        .getRange(
          fila,
          11
        )
        .setValue(
          limpiar(
            datos.respuesta
          )
        );

    }


    /******************************************************
     * FECHA DE RESPUESTA
     ******************************************************/

    if (
      typeof datos.respuesta !==
      'undefined' &&
      limpiar(
        datos.respuesta
      )
    ) {

      hoja
        .getRange(
          fila,
          12
        )
        .setValue(
          ahora
        )
        .setNumberFormat(
          'dd/MM/yyyy HH:mm:ss'
        );

    }


    /******************************************************
     * OBSERVACIONES
     ******************************************************/

    if (
      typeof datos.observaciones !==
      'undefined'
    ) {

      hoja
        .getRange(
          fila,
          13
        )
        .setValue(
          limpiar(
            datos.observaciones
          )
        );

    }


    /******************************************************
     * FECHA ACTUALIZACIÓN
     ******************************************************/

    hoja
      .getRange(
        fila,
        14
      )
      .setValue(
        ahora
      )
      .setNumberFormat(
        'dd/MM/yyyy HH:mm:ss'
      );


    /******************************************************
     * PDF DE RESPUESTA
     ******************************************************/

    const archivoRespuestaPayload =
      obtenerArchivoRespuestaPayload(
        datos
      );


    if (
      archivoRespuestaPayload
    ) {

      const archivoRespuestaGuardado =
        guardarDocumentoPDF(
          archivoRespuestaPayload,
          radicado
        );


      hoja
        .getRange(
          fila,
          18
        )
        .setValue(
          archivoRespuestaGuardado.nombre
        );


      hoja
        .getRange(
          fila,
          19
        )
        .setValue(
          archivoRespuestaGuardado.url
        );


      hoja
        .getRange(
          fila,
          20
        )
        .setValue(
          archivoRespuestaGuardado.id
        );

    }


    SpreadsheetApp.flush();


    const datosActualizados =
      hoja
        .getRange(
          fila,
          1,
          1,
          ENCABEZADOS_PQRS.length
        )
        .getValues()[0];


    const pqrsActualizada =
      convertirFilaPQRS(
        datosActualizados,
        fila
      );


    return respuestaJSON({

      ok: true,
      success: true,

      mensaje:
        'PQRS actualizada correctamente.',

      message:
        'PQRS actualizada correctamente.',

      radicado:
        radicado,

      archivoRespuesta:
        pqrsActualizada.archivoRespuesta,

      urlRespuesta:
        pqrsActualizada.urlRespuesta,

      pqrs:
        pqrsActualizada,

      data:
        pqrsActualizada

    });


  } finally {

    try {

      lock.releaseLock();

    } catch (e) {}

  }

}


/****************************************************************************************
 * BUSCAR FILA POR RADICADO
 ****************************************************************************************/

function buscarFilaPorRadicado(
  hoja,
  radicado
) {

  const ultimaFila =
    hoja.getLastRow();


  if (
    ultimaFila < 2
  ) {

    return null;

  }


  const valores =
    hoja
      .getRange(
        2,
        2,
        ultimaFila - 1,
        1
      )
      .getValues();


  const buscado =
    limpiar(
      radicado
    );


  for (
    let i = 0;
    i < valores.length;
    i++
  ) {

    if (
      limpiar(
        valores[i][0]
      ) ===
      buscado
    ) {

      return i + 2;

    }

  }


  return null;

}


/****************************************************************************************
 * GENERAR RADICADO
 *
 * Formato:
 *
 * PQRS-2026-0001
 * PQRS-2026-0002
 * PQRS-2026-0003
 ****************************************************************************************/

function generarRadicado(
  hoja
) {

  const anio =
    new Date().getFullYear();


  const ultimaFila =
    hoja.getLastRow();


  let consecutivo =
    1;


  if (
    ultimaFila >= 2
  ) {

    const valores =
      hoja
        .getRange(
          2,
          2,
          ultimaFila - 1,
          1
        )
        .getValues();


    let mayor =
      0;


    for (
      let i = 0;
      i < valores.length;
      i++
    ) {

      const valor =
        limpiar(
          valores[i][0]
        );


      const coincidencia =
        valor.match(
          /^PQRS-\d{4}-(\d+)$/
        );


      if (
        coincidencia
      ) {

        const numero =
          parseInt(
            coincidencia[1],
            10
          );


        if (
          numero > mayor
        ) {

          mayor =
            numero;

        }

      }

    }


    consecutivo =
      mayor + 1;

  }


  const numero =
    String(
      consecutivo
    )
      .padStart(
        4,
        '0'
      );


  return (
    'PQRS-' +
    anio +
    '-' +
    numero
  );

}


/****************************************************************************************
 * CORREO DE RECEPCIÓN
 ****************************************************************************************/

function enviarCorreoRecepcion(
  datos
) {

  const asuntoCorreo =
    'Nueva PQRS recibida - ' +
    datos.radicado;


  const cuerpoTexto =

    'NUEVA PQRS RECIBIDA\n\n' +

    'Institución: ' +
    CONFIG.NOMBRE_INSTITUCION +
    '\n' +

    'Municipio: ' +
    CONFIG.MUNICIPIO +
    '\n\n' +

    'RADICADO: ' +
    datos.radicado +
    '\n' +

    'Fecha: ' +
    formatearFecha(
      datos.fecha
    ) +
    '\n\n' +

    'DATOS DEL SOLICITANTE\n' +

    'Nombre: ' +
    datos.nombre +
    '\n' +

    'Documento: ' +
    (
      datos.documento ||
      'No suministrado'
    ) +
    '\n' +

    'Teléfono: ' +
    (
      datos.telefono ||
      'No suministrado'
    ) +
    '\n' +

    'Correo: ' +
    (
      datos.correo ||
      'No suministrado'
    ) +
    '\n\n' +

    'SOLICITUD\n' +

    'Tipo: ' +
    datos.tipo +
    '\n' +

    'Asunto: ' +
    datos.asunto +
    '\n\n' +

    'Descripción:\n' +
    datos.descripcion +
    '\n\n' +

    'Documento PDF: ' +
    (
      datos.documentoAdjunto ||
      'No adjunto'
    ) +
    '\n' +

    (
      datos.urlDocumento
        ? 'Documento: ' +
          datos.urlDocumento +
          '\n'
        : ''
    ) +

    '\n' +

    'Estado: ' +
    CONFIG.ESTADO_INICIAL;


  const cuerpoHTML =

    '<div style="font-family:Arial,sans-serif;color:#15221b;">' +

      '<h2 style="color:#0f5b35;">Nueva PQRS recibida</h2>' +

      '<p>' +

        '<strong>Radicado:</strong> ' +

        escaparHTML(
          datos.radicado
        ) +

      '</p>' +

      '<p>' +

        '<strong>Fecha:</strong> ' +

        escaparHTML(
          formatearFecha(
            datos.fecha
          )
        ) +

      '</p>' +

      '<hr>' +

      '<h3 style="color:#0d2c54;">Datos del solicitante</h3>' +

      '<p>' +

        '<strong>Nombre:</strong> ' +

        escaparHTML(
          datos.nombre
        ) +

        '<br>' +

        '<strong>Documento:</strong> ' +

        escaparHTML(
          datos.documento ||
          'No suministrado'
        ) +

        '<br>' +

        '<strong>Teléfono:</strong> ' +

        escaparHTML(
          datos.telefono ||
          'No suministrado'
        ) +

        '<br>' +

        '<strong>Correo:</strong> ' +

        escaparHTML(
          datos.correo ||
          'No suministrado'
        ) +

      '</p>' +

      '<h3 style="color:#0d2c54;">Solicitud</h3>' +

      '<p>' +

        '<strong>Tipo:</strong> ' +

        escaparHTML(
          datos.tipo
        ) +

        '<br>' +

        '<strong>Asunto:</strong> ' +

        escaparHTML(
          datos.asunto
        ) +

      '</p>' +

      '<p>' +

        '<strong>Descripción:</strong><br>' +

        escaparHTML(
          datos.descripcion
        )
          .replace(
            /\n/g,
            '<br>'
          ) +

      '</p>' +

      '<hr>' +

      '<p>' +

        '<strong>Estado:</strong> ' +

        CONFIG.ESTADO_INICIAL +

      '</p>' +

      '<p>' +

        '<strong>Documento PDF:</strong> ' +

        (
          datos.documentoAdjunto
            ? escaparHTML(
                datos.documentoAdjunto
              )
            : 'No adjunto'
        ) +

      '</p>' +

      (
        datos.urlDocumento

          ? '<p>' +

              '<a href="' +
                escaparHTML(
                  datos.urlDocumento
                ) +
                '" ' +

                'target="_blank" ' +

                'style="' +

                  'display:inline-block;' +
                  'padding:10px 16px;' +
                  'background:#0f5b35;' +
                  'color:#ffffff;' +
                  'text-decoration:none;' +
                  'border-radius:8px;' +

                '">' +

                'Ver documento PDF' +

              '</a>' +

            '</p>'

          : ''

      ) +

    '</div>';


  MailApp.sendEmail({

    to:
      CONFIG.CORREO_RECEPCION,

    subject:
      asuntoCorreo,

    body:
      cuerpoTexto,

    htmlBody:
      cuerpoHTML

  });

}


/****************************************************************************************
 * CONFIRMACIÓN AL CIUDADANO
 ****************************************************************************************/

function enviarConfirmacionCiudadano(
  datos
) {

  const asunto =
    'Confirmación de PQRS - ' +
    datos.radicado;


  const cuerpo =

    'Hola ' +
    datos.nombre +
    '.\n\n' +

    'La Junta de Acción Comunal de la Vereda Santa Bárbara ' +
    'ha recibido correctamente tu solicitud.\n\n' +

    'Número de radicado: ' +
    datos.radicado +
    '\n' +

    'Fecha de recepción: ' +
    formatearFecha(
      datos.fecha
    ) +
    '\n' +

    'Tipo de solicitud: ' +
    datos.tipo +
    '\n' +

    'Asunto: ' +
    datos.asunto +
    '\n\n' +

    'Documento PDF adjunto: ' +
    (
      datos.documentoAdjunto ||
      'No adjunto'
    ) +

    '\n\n' +

    (
      datos.urlDocumento
        ? 'Puedes consultar el documento aquí:\n' +
          datos.urlDocumento +
          '\n\n'
        : ''
    ) +

    'Conserva este número de radicado para futuras consultas ' +
    'o seguimiento de tu solicitud.\n\n' +

    'Atentamente,\n' +

    CONFIG.NOMBRE_INSTITUCION +
    '\n' +

    CONFIG.MUNICIPIO;


  const html =

    '<div style="font-family:Arial,sans-serif;color:#15221b;">' +

      '<h2 style="color:#0f5b35;">PQRS recibida correctamente</h2>' +

      '<p>' +

        'Hola ' +

        escaparHTML(
          datos.nombre
        ) +

        '.' +

      '</p>' +

      '<p>' +

        'La Junta de Acción Comunal de la Vereda Santa Bárbara ' +

        'ha recibido correctamente tu solicitud.' +

      '</p>' +

      '<div style="' +

        'background:#eaf5ee;' +
        'border:1px dashed #0f5b35;' +
        'border-radius:12px;' +
        'padding:18px;' +
        'text-align:center;' +
        'margin:20px 0;' +

      '">' +

        '<div style="font-size:13px;color:#66756c;">' +

          'Número de radicado' +

        '</div>' +

        '<div style="' +

          'font-size:25px;' +
          'font-weight:bold;' +
          'color:#0f5b35;' +
          'margin-top:8px;' +

        '">' +

          escaparHTML(
            datos.radicado
          ) +

        '</div>' +

      '</div>' +

      '<p>' +

        '<strong>Fecha:</strong> ' +

        escaparHTML(
          formatearFecha(
            datos.fecha
          )
        ) +

        '<br>' +

        '<strong>Tipo:</strong> ' +

        escaparHTML(
          datos.tipo
        ) +

        '<br>' +

        '<strong>Asunto:</strong> ' +

        escaparHTML(
          datos.asunto
        ) +

      '</p>' +

      (
        datos.documentoAdjunto

          ? '<p>' +

              '<strong>Documento adjunto:</strong> ' +

              escaparHTML(
                datos.documentoAdjunto
              ) +

            '</p>'

          : ''

      ) +

      (
        datos.urlDocumento

          ? '<p>' +

              '<a href="' +
                escaparHTML(
                  datos.urlDocumento
                ) +
                '" ' +

                'target="_blank" ' +

                'style="' +

                  'display:inline-block;' +
                  'padding:12px 18px;' +
                  'background:#0f5b35;' +
                  'color:#ffffff;' +
                  'text-decoration:none;' +
                  'border-radius:9px;' +
                  'font-weight:bold;' +

                '">' +

                'Ver documento PDF' +

              '</a>' +

            '</p>'

          : ''

      ) +

      '<p>' +

        'Conserva este número de radicado para futuras ' +
        'consultas o seguimiento de tu solicitud.' +

      '</p>' +

      '<p>' +

        '<strong>' +

          escaparHTML(
            CONFIG.NOMBRE_INSTITUCION
          ) +

        '</strong>' +

        '<br>' +

        escaparHTML(
          CONFIG.MUNICIPIO
        ) +

      '</p>' +

    '</div>';


  MailApp.sendEmail({

    to:
      datos.correo,

    subject:
      asunto,

    body:
      cuerpo,

    htmlBody:
      html

  });

}


/****************************************************************************************
 * CORREO DE RESPUESTA AL CIUDADANO
 ****************************************************************************************/

function enviarRespuestaCiudadano(
  datos
) {

  const estado =
    limpiar(
      datos.estado
    ) ||
    'Respondida';


  const asunto =
    'Respuesta a su PQRS - ' +
    datos.radicado;


  const cuerpo =

    'Hola ' +
    datos.nombre +
    '.\n\n' +

    'La Junta de Acción Comunal de la Vereda Santa Bárbara ' +
    'ha emitido una respuesta a su solicitud.\n\n' +

    'Radicado: ' +
    datos.radicado +
    '\n' +

    'Tipo: ' +
    datos.tipo +
    '\n' +

    'Asunto: ' +
    datos.asunto +
    '\n\n' +

    'RESPUESTA:\n' +

    datos.respuesta +

    '\n\n' +

    'Estado: ' +
    estado +
    '\n\n' +

    (
      datos.urlRespuesta
        ? 'Documento PDF de respuesta:\n' +
          datos.urlRespuesta +
          '\n\n'
        : ''
    ) +

    'Atentamente,\n' +

    CONFIG.NOMBRE_INSTITUCION +
    '\n' +

    CONFIG.MUNICIPIO;


  const html =

    '<div style="font-family:Arial,sans-serif;color:#15221b;max-width:700px;">' +

      '<h2 style="color:#0f5b35;">Respuesta a su PQRS</h2>' +

      '<p>' +

        'Hola ' +

        escaparHTML(
          datos.nombre
        ) +

        '.' +

      '</p>' +

      '<p>' +

        'La Junta de Acción Comunal de la Vereda Santa Bárbara ' +

        'ha emitido una respuesta a su solicitud.' +

      '</p>' +

      '<div style="' +

        'background:#eaf5ee;' +
        'border:1px solid #c9dfd0;' +
        'border-radius:14px;' +
        'padding:18px;' +
        'margin:20px 0;' +

      '">' +

        '<strong>Radicado:</strong> ' +

        escaparHTML(
          datos.radicado
        ) +

        '<br>' +

        '<strong>Tipo:</strong> ' +

        escaparHTML(
          datos.tipo
        ) +

        '<br>' +

        '<strong>Asunto:</strong> ' +

        escaparHTML(
          datos.asunto
        ) +

      '</div>' +

      '<h3 style="color:#0d2c54;">Respuesta</h3>' +

      '<div style="' +

        'background:#f7faf8;' +
        'border:1px solid #dce7df;' +
        'border-radius:14px;' +
        'padding:20px;' +
        'white-space:normal;' +

      '">' +

        escaparHTML(
          datos.respuesta
        )
          .replace(
            /\n/g,
            '<br>'
          ) +

      '</div>' +

      '<p style="margin-top:20px;">' +

        '<strong>Estado:</strong> ' +

        escaparHTML(
          estado
        ) +

      '</p>' +

      (
        datos.urlRespuesta

          ? '<p>' +

              '<a href="' +
                escaparHTML(
                  datos.urlRespuesta
                ) +
                '" ' +

                'target="_blank" ' +

                'style="' +

                  'display:inline-block;' +
                  'padding:12px 18px;' +
                  'background:#0f5b35;' +
                  'color:#ffffff;' +
                  'text-decoration:none;' +
                  'border-radius:9px;' +
                  'font-weight:bold;' +

                '">' +

                'Descargar PDF de respuesta' +

              '</a>' +

            '</p>'

          : ''

      ) +

      '<p>' +

        '<strong>' +

          escaparHTML(
            CONFIG.NOMBRE_INSTITUCION
          ) +

        '</strong>' +

        '<br>' +

        escaparHTML(
          CONFIG.MUNICIPIO
        ) +

      '</p>' +

    '</div>';


  MailApp.sendEmail({

    to:
      datos.correo,

    subject:
      asunto,

    body:
      cuerpo,

    htmlBody:
      html

  });

}


/****************************************************************************************
 * FORMATEAR FECHA
 ****************************************************************************************/

function formatearFecha(
  fecha
) {

  if (!fecha) {

    return '';

  }


  return Utilities.formatDate(

    new Date(fecha),

    Session.getScriptTimeZone(),

    'dd/MM/yyyy HH:mm:ss'

  );

}


/****************************************************************************************
 * FECHA PARA JSON
 ****************************************************************************************/

function convertirFechaJSON(
  valor
) {

  if (!valor) {

    return '';

  }


  if (
    Object.prototype.toString.call(
      valor
    ) ===
    '[object Date]'
  ) {

    return formatearFecha(
      valor
    );

  }


  return String(
    valor
  );

}


/****************************************************************************************
 * LIMPIAR TEXTO
 ****************************************************************************************/

function limpiar(
  valor
) {

  if (
    valor === null ||
    valor === undefined
  ) {

    return '';

  }


  return String(
    valor
  ).trim();

}


/****************************************************************************************
 * VALIDAR CORREO
 ****************************************************************************************/

function validarCorreo(
  correo
) {

  const expresion =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


  return expresion.test(
    correo
  );

}


/****************************************************************************************
 * ESCAPAR HTML
 ****************************************************************************************/

function escaparHTML(
  texto
) {

  return String(
    texto || ''
  )

    .replace(
      /&/g,
      '&amp;'
    )

    .replace(
      /</g,
      '&lt;'
    )

    .replace(
      />/g,
      '&gt;'
    )

    .replace(
      /"/g,
      '&quot;'
    )

    .replace(
      /'/g,
      '&#39;'
    );

}


/****************************************************************************************
 * RESPUESTA JSON
 ****************************************************************************************/

function respuestaJSON(
  objeto
) {

  return ContentService

    .createTextOutput(
      JSON.stringify(
        objeto
      )
    )

    .setMimeType(
      ContentService.MimeType.JSON
    );

}


/****************************************************************************************
 * PRUEBA DEL SISTEMA
 *
 * Ejecutar manualmente UNA VEZ después de actualizar.
 *
 * Esta función:
 * - verifica la hoja
 * - crea las columnas nuevas si hacen falta
 * - NO crea PQRS
 * - NO crea documentos
 * - NO elimina información
 ****************************************************************************************/

function probarSistema() {

  const spreadsheet =
    SpreadsheetApp.openById(
      CONFIG.SPREADSHEET_ID
    );


  const hoja =
    obtenerHojaPQRS(
      spreadsheet
    );


  Logger.log(
    'Spreadsheet: ' +
    spreadsheet.getName()
  );


  Logger.log(
    'Hoja PQRS: ' +
    hoja.getName()
  );


  Logger.log(
    'Filas registradas: ' +
    Math.max(
      0,
      hoja.getLastRow() - 1
    )
  );


  Logger.log(
    'Columnas disponibles: ' +
    hoja.getMaxColumns()
  );


  Logger.log(
    'Carpeta de documentos: ' +
    CONFIG.NOMBRE_CARPETA_DOCUMENTOS
  );


  Logger.log(
    'Sistema PQRS correctamente conectado.'
  );

}


/****************************************************************************************
 * PRUEBA DE CARPETA DE DOCUMENTOS
 *
 * Ejecutar manualmente UNA VEZ para verificar que Apps Script
 * tenga permisos para trabajar con Google Drive.
 ****************************************************************************************/

function probarCarpetaDocumentos() {

  const carpeta =
    obtenerCarpetaDocumentos();


  Logger.log(
    'Nombre carpeta: ' +
    carpeta.getName()
  );


  Logger.log(
    'ID carpeta: ' +
    carpeta.getId()
  );


  Logger.log(
    'URL carpeta: ' +
    carpeta.getUrl()
  );

}


/****************************************************************************************
 * OBTENER ARCHIVO DE RESPUESTA DESDE PAYLOAD
 ****************************************************************************************/

function obtenerArchivoRespuestaPayload(
  datos
) {

  const base64 =
    limpiar(
      datos.archivoBase64 ||
      datos.base64Archivo ||
      datos.respuestaBase64 ||
      ''
    );


  if (!base64) {

    return null;

  }


  return {

    nombre:
      limpiar(
        datos.archivoNombre ||
        datos.nombreArchivo ||
        datos.nombreRespuesta ||
        (
          'respuesta-' +
          limpiar(
            datos.radicado ||
            datos.id ||
            'pqrs'
          ) +
          '.pdf'
        )
      ),

    mimeType:
      limpiar(
        datos.archivoTipo ||
        datos.tipoArchivo ||
        datos.mimeType ||
        'application/pdf'
      ),

    base64:
      base64

  };

}
