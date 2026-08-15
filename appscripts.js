/*
 * Google Apps Script para PQRS.
 *
 * Si el script esta ligado al Google Sheet, no cambies nada.
 * Si es un script independiente, configura la propiedad SPREADSHEET_ID
 * en Project Settings > Script properties.
 *
 * Propiedad opcional: DRIVE_FOLDER_ID para guardar los PDF en una carpeta.
 */

const SHEET_NAME = "PQRS";

const DEFAULT_HEADERS = [
  "Radicado",
  "Fecha",
  "Nombre",
  "Documento",
  "Telefono",
  "Correo",
  "Tipo",
  "Asunto",
  "Descripcion",
  "Estado",
  "Respuesta",
  "Observaciones",
  "Fecha respuesta",
  "Fecha actualizacion",
  "Archivo respuesta",
  "Nombre archivo",
  "ID archivo",
  "Tipo archivo",
  "Tamanio archivo"
];

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const data = parseRequest(e);
    const accion = String(data.accion || "").trim().toLowerCase();

    if (!accion) {
      return json({ ok: false, mensaje: "Falta la accion." });
    }

    if (accion === "registrar") return registrarPQRS(data);
    if (accion === "consultar") return consultarPQRS(data);
    if (accion === "listarpqrs") return listarPQRS();
    if (accion === "obtenerpqrs") return obtenerPQRS(data);
    if (accion === "responder" || accion === "actualizar") return guardarGestionPQRS(data);

    return json({ ok: false, mensaje: "Accion no reconocida: " + data.accion });
  } catch (error) {
    return json({ ok: false, mensaje: error.message || String(error) });
  }
}

function parseRequest(e) {
  const out = {};

  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function(key) {
      out[key] = e.parameter[key];
    });
  }

  const body = e && e.postData && e.postData.contents;
  if (body) {
    const parsed = JSON.parse(body);
    Object.keys(parsed).forEach(function(key) {
      out[key] = parsed[key];
    });
  }

  return out;
}

function getSpreadsheet() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (id) return SpreadsheetApp.openById(id);

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error("Configura SPREADSHEET_ID en las propiedades del script.");
  }
  return active;
}

function getSheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DEFAULT_HEADERS);
  }

  ensureHeaders(sheet, DEFAULT_HEADERS);
  return sheet;
}

function ensureHeaders(sheet, headers) {
  const current = getHeaders(sheet);
  const normalized = current.map(normalizeHeader);
  const missing = headers.filter(function(header) {
    return normalized.indexOf(normalizeHeader(header)) === -1;
  });

  if (missing.length) {
    sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  }
}

function getHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return headers.map(function(value) {
    return String(value || "").trim();
  });
}

function normalizeHeader(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function col(headers, aliases) {
  const normalized = headers.map(normalizeHeader);
  for (let i = 0; i < aliases.length; i++) {
    const index = normalized.indexOf(normalizeHeader(aliases[i]));
    if (index !== -1) return index + 1;
  }
  return -1;
}

function getValue(row, headers, aliases) {
  const index = col(headers, aliases);
  return index === -1 ? "" : row[index - 1];
}

function setValue(sheet, rowNumber, headers, aliases, value) {
  const index = col(headers, aliases);
  if (index !== -1) {
    sheet.getRange(rowNumber, index).setValue(value);
  }
}

function registrarPQRS(data) {
  const sheet = getSheet();
  const headers = getHeaders(sheet);
  const radicado = generarRadicado(sheet);
  const now = new Date();
  const row = new Array(headers.length).fill("");

  put(row, headers, ["Radicado"], radicado);
  put(row, headers, ["Fecha"], now);
  put(row, headers, ["Nombre"], data.nombre);
  put(row, headers, ["Documento"], data.documento);
  put(row, headers, ["Telefono", "Teléfono"], data.telefono);
  put(row, headers, ["Correo"], data.correo);
  put(row, headers, ["Tipo"], data.tipo);
  put(row, headers, ["Asunto"], data.asunto);
  put(row, headers, ["Descripcion", "Descripción"], data.descripcion);
  put(row, headers, ["Estado"], "Recibida");
  put(row, headers, ["Fecha actualizacion", "Fecha actualización"], now);

  sheet.appendRow(row);

  return json({ ok: true, radicado: radicado, pqrs: rowToObject(row, headers) });
}

function put(row, headers, aliases, value) {
  const index = col(headers, aliases);
  if (index !== -1) row[index - 1] = value || "";
}

function generarRadicado(sheet) {
  const year = new Date().getFullYear();
  const total = Math.max(0, sheet.getLastRow() - 1) + 1;
  return "PQRS-" + year + "-" + String(total).padStart(5, "0");
}

function listarPQRS() {
  const sheet = getSheet();
  const items = readRows(sheet);
  return json({ ok: true, pqrs: items });
}

function consultarPQRS(data) {
  const found = findByRadicado(data.radicado);
  if (!found) {
    return json({ ok: false, mensaje: "No se encontro una PQRS con ese numero de radicado." });
  }

  return json(Object.assign({ ok: true }, found.item));
}

function obtenerPQRS(data) {
  const found = findByRadicado(data.radicado);
  if (!found) {
    return json({ ok: false, mensaje: "No se encontro una PQRS con ese numero de radicado." });
  }

  return json({ ok: true, pqrs: found.item });
}

function guardarGestionPQRS(data) {
  const found = findByRadicado(data.radicado);
  if (!found) {
    return json({ ok: false, mensaje: "No se encontro una PQRS con ese numero de radicado." });
  }

  const sheet = found.sheet;
  let headers = getHeaders(sheet);
  const rowNumber = found.rowNumber;
  const now = new Date();
  let fileInfo = null;

  const archivoBase64 = data.archivoBase64 || data.base64Archivo || "";

  if (archivoBase64) {
    data.archivoBase64 = archivoBase64;
    fileInfo = guardarArchivoRespuesta(data, data.radicado);
  }

  setValue(sheet, rowNumber, headers, ["Estado"], data.estado || found.item.estado || "En tramite");
  setValue(sheet, rowNumber, headers, ["Respuesta"], data.respuesta || "");
  setValue(sheet, rowNumber, headers, ["Observaciones"], data.observaciones || "");
  setValue(sheet, rowNumber, headers, ["Fecha respuesta"], data.respuesta ? now : found.item.fechaRespuesta || "");
  setValue(sheet, rowNumber, headers, ["Fecha actualizacion", "Fecha actualización"], now);

  if (fileInfo) {
    setValue(sheet, rowNumber, headers, ["Archivo respuesta", "archivoRespuesta", "archivoUrl", "urlArchivo", "urlRespuesta"], fileInfo.url);
    setValue(sheet, rowNumber, headers, ["Nombre archivo", "archivoNombre", "nombreArchivo"], fileInfo.nombre);
    setValue(sheet, rowNumber, headers, ["ID archivo", "archivoId", "idArchivo"], fileInfo.id);
    setValue(sheet, rowNumber, headers, ["Tipo archivo", "archivoTipo"], fileInfo.tipo);
    setValue(sheet, rowNumber, headers, ["Tamanio archivo", "archivoTamanio"], fileInfo.tamanio);
  }

  SpreadsheetApp.flush();

  headers = getHeaders(sheet);
  const row = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  return json({ ok: true, pqrs: rowToObject(row, headers) });
}

function guardarArchivoRespuesta(data, radicado) {
  const bytes = Utilities.base64Decode(data.archivoBase64);
  const tipo = data.archivoTipo || data.tipoArchivo || "application/pdf";
  const nombre = data.archivoNombre || data.nombreArchivo || ("respuesta-" + radicado + ".pdf");
  const blob = Utilities.newBlob(bytes, tipo, nombre);
  const folderId = PropertiesService.getScriptProperties().getProperty("DRIVE_FOLDER_ID");
  const file = folderId ? DriveApp.getFolderById(folderId).createFile(blob) : DriveApp.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    id: file.getId(),
    url: file.getUrl(),
    nombre: file.getName(),
    tipo: tipo,
    tamanio: data.archivoTamanio || data.tamanioArchivo || bytes.length
  };
}

function findByRadicado(radicado) {
  const sheet = getSheet();
  const headers = getHeaders(sheet);
  const target = String(radicado || "").trim().toUpperCase();
  const radicadoCol = col(headers, ["Radicado", "Numero radicado", "Número radicado"]);

  if (!target || radicadoCol === -1 || sheet.getLastRow() < 2) return null;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();

  for (let i = 0; i < values.length; i++) {
    const value = String(values[i][radicadoCol - 1] || "").trim().toUpperCase();
    if (value === target) {
      return {
        sheet: sheet,
        headers: headers,
        row: values[i],
        rowNumber: i + 2,
        item: rowToObject(values[i], headers)
      };
    }
  }

  return null;
}

function readRows(sheet) {
  const headers = getHeaders(sheet);
  if (sheet.getLastRow() < 2) return [];

  return sheet
    .getRange(2, 1, sheet.getLastRow() - 1, headers.length)
    .getValues()
    .map(function(row) {
      return rowToObject(row, headers);
    });
}

function rowToObject(row, headers) {
  const obj = {};

  headers.forEach(function(header, index) {
    if (header) obj[header] = formatValue(row[index]);
  });

  obj.radicado = obj.radicado || getValue(row, headers, ["Radicado", "Numero radicado", "Número radicado"]);
  obj.fecha = obj.fecha || getValue(row, headers, ["Fecha", "Fecha recepcion", "Fecha recepción"]);
  obj.nombre = obj.nombre || getValue(row, headers, ["Nombre", "Nombre completo"]);
  obj.documento = obj.documento || getValue(row, headers, ["Documento"]);
  obj.telefono = obj.telefono || getValue(row, headers, ["Telefono", "Teléfono"]);
  obj.correo = obj.correo || getValue(row, headers, ["Correo"]);
  obj.tipo = obj.tipo || getValue(row, headers, ["Tipo"]);
  obj.asunto = obj.asunto || getValue(row, headers, ["Asunto"]);
  obj.descripcion = obj.descripcion || getValue(row, headers, ["Descripcion", "Descripción"]);
  obj.estado = obj.estado || getValue(row, headers, ["Estado"]);
  obj.respuesta = obj.respuesta || getValue(row, headers, ["Respuesta"]);
  obj.observaciones = obj.observaciones || getValue(row, headers, ["Observaciones"]);
  obj.fechaRespuesta = obj.fechaRespuesta || getValue(row, headers, ["Fecha respuesta"]);
  obj.fechaActualizacion = obj.fechaActualizacion || getValue(row, headers, ["Fecha actualizacion", "Fecha actualización"]);
  obj.archivoRespuesta = obj.archivoRespuesta || getValue(row, headers, ["Archivo respuesta", "archivoUrl", "urlArchivo", "urlRespuesta"]);
  obj.archivoUrl = obj.archivoRespuesta;
  obj.nombreArchivo = obj.nombreArchivo || getValue(row, headers, ["Nombre archivo", "archivoNombre"]);
  obj.idArchivo = obj.idArchivo || getValue(row, headers, ["ID archivo", "archivoId"]);

  return obj;
}

function formatValue(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  }
  return value === null || value === undefined ? "" : value;
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
