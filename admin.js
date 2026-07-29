const DATA_FILE = "equipos.csv";
const WARNING_DAYS = 30;

const CSV_HEADERS = [
  "ID",
  "Descripcion",
  "Marca",
  "NumeroSerie",
  "Rango",
  "EstadoEquipo",
  "FrecuenciaMeses",
  "FechaCalibracion",
  "FechaVencimiento",
  "EstadoCalibracion",
  "Ubicacion",
  "Foto",
  "URLCertificado"
];

let existingEquipment = [];
let pendingEquipment = [];

const elements = {
  form: document.getElementById("equipmentForm"),
  equipmentId: document.getElementById("equipmentId"),
  description: document.getElementById("description"),
  brand: document.getElementById("brand"),
  serialNumber: document.getElementById("serialNumber"),
  range: document.getElementById("range"),
  equipmentStatus: document.getElementById("equipmentStatus"),
  frequency: document.getElementById("frequency"),
  calibrationDate: document.getElementById("calibrationDate"),
  expirationDate: document.getElementById("expirationDate"),
  calibrationStatus: document.getElementById("calibrationStatus"),
  location: document.getElementById("location"),
  photoPath: document.getElementById("photoPath"),
  certificatePath: document.getElementById("certificatePath"),

  generateIdButton: document.getElementById("generateIdButton"),
  previewButton: document.getElementById("previewButton"),
  resetButton: document.getElementById("resetButton"),
  downloadCsvButton: document.getElementById("downloadCsvButton"),

  loadedCount: document.getElementById("loadedCount"),
  generatedId: document.getElementById("generatedId"),
  pendingCount: document.getElementById("pendingCount"),
  validationMessage: document.getElementById("validationMessage"),
  pendingTableBody: document.getElementById("pendingTableBody"),

  brandOptions: document.getElementById("brandOptions"),
  locationOptions: document.getElementById("locationOptions"),

  previewDescription: document.getElementById("previewDescription"),
  previewId: document.getElementById("previewId"),
  previewStatus: document.getElementById("previewStatus"),
  previewImage: document.getElementById("previewImage"),
  previewBrand: document.getElementById("previewBrand"),
  previewSerial: document.getElementById("previewSerial"),
  previewRange: document.getElementById("previewRange"),
  previewLocation: document.getElementById("previewLocation"),
  previewCalibrationDate: document.getElementById("previewCalibrationDate"),
  previewExpirationDate: document.getElementById("previewExpirationDate"),
  previewLink: document.getElementById("previewLink")
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  bindEvents();
  setDefaultCalibrationDate();

  try {
    const response = await fetch(DATA_FILE, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("No fue posible cargar equipos.csv");
    }

    existingEquipment = parseCSV(await response.text());
    elements.loadedCount.textContent = existingEquipment.length;

    populateDatalist(
      elements.brandOptions,
      existingEquipment.map(item => item.Marca)
    );

    populateDatalist(
      elements.locationOptions,
      existingEquipment.map(item => item.Ubicacion)
    );
  } catch (error) {
    console.error(error);
    showValidation(
      "No fue posible leer equipos.csv. El formulario puede utilizarse, pero no será posible validar duplicados contra los registros existentes.",
      "warning"
    );
  }

  updateCalculatedFields();
  updatePreview();
}

function bindEvents() {
  elements.form.addEventListener("submit", addEquipment);
  elements.generateIdButton.addEventListener("click", generateNextId);
  elements.previewButton.addEventListener("click", updatePreview);
  elements.resetButton.addEventListener("click", resetForm);
  elements.downloadCsvButton.addEventListener("click", downloadUpdatedCsv);

  elements.frequency.addEventListener("change", calculateExpirationDate);
  elements.calibrationDate.addEventListener("change", calculateExpirationDate);
  elements.expirationDate.addEventListener("change", updateCalculatedFields);
  elements.equipmentId.addEventListener("input", handleIdInput);

  elements.form.addEventListener("input", () => {
    updateCalculatedFields();
    updatePreview();
  });
}

function setDefaultCalibrationDate() {
  const today = new Date();
  elements.calibrationDate.value = toInputDate(today);
}

function calculateExpirationDate() {
  if (!elements.calibrationDate.value) {
    return;
  }

  const startDate = parseInputDate(elements.calibrationDate.value);
  const months = Number(elements.frequency.value || 0);

  if (!startDate || !months) {
    return;
  }

  const expiration = addMonthsPreservingDay(startDate, months);
  expiration.setDate(expiration.getDate() + 1);

  elements.expirationDate.value = toInputDate(expiration);
  updateCalculatedFields();
  updatePreview();
}

function addMonthsPreservingDay(date, months) {
  const originalDay = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(Math.min(originalDay, lastDay));
  return result;
}

function updateCalculatedFields() {
  const expiration = parseInputDate(elements.expirationDate.value);
  const status = determineCalibrationStatus(expiration);

  elements.calibrationStatus.value = status;
  updateStatusBadge(elements.previewStatus, status);
}

function determineCalibrationStatus(expirationDate) {
  if (!expirationDate) {
    return "SIN FECHA";
  }

  const daysRemaining = calculateDaysRemaining(expirationDate);

  if (daysRemaining < 0) {
    return "VENCIDO";
  }

  if (daysRemaining <= WARNING_DAYS) {
    return "POR VENCER";
  }

  return "CALIBRADO";
}

function addEquipment(event) {
  event.preventDefault();
  hideValidation();

  const record = getFormRecord();
  const errors = validateRecord(record);

  if (errors.length) {
    showValidation(errors.join(" "), "error");
    return;
  }

  pendingEquipment.push(record);
  renderPendingTable();
  updateCounters();

  showValidation(
    `El equipo ${record.ID} fue agregado a la sesión. Aún debes descargar y reemplazar equipos.csv.`,
    "success"
  );

  resetForm(false);
}

function getFormRecord() {
  return {
    ID: cleanUpper(elements.equipmentId.value),
    Descripcion: cleanUpper(elements.description.value),
    Marca: cleanUpper(elements.brand.value),
    NumeroSerie: cleanUpper(elements.serialNumber.value),
    Rango: cleanValue(elements.range.value),
    EstadoEquipo: cleanUpper(elements.equipmentStatus.value),
    FrecuenciaMeses: cleanValue(elements.frequency.value),
    FechaCalibracion: formatCsvDate(elements.calibrationDate.value),
    FechaVencimiento: formatCsvDate(elements.expirationDate.value),
    EstadoCalibracion: cleanUpper(elements.calibrationStatus.value),
    Ubicacion: cleanValue(elements.location.value),
    Foto: cleanValue(elements.photoPath.value),
    URLCertificado: cleanValue(elements.certificatePath.value)
  };
}

function validateRecord(record) {
  const errors = [];

  const requiredFields = [
    ["ID", "ID"],
    ["Descripcion", "descripción"],
    ["Marca", "marca"],
    ["NumeroSerie", "número de serie"],
    ["Rango", "rango"],
    ["EstadoEquipo", "estado del equipo"],
    ["FrecuenciaMeses", "frecuencia"],
    ["FechaCalibracion", "fecha de calibración"],
    ["FechaVencimiento", "fecha de vencimiento"],
    ["Ubicacion", "ubicación"]
  ];

  requiredFields.forEach(([field, label]) => {
    if (!record[field]) {
      errors.push(`Falta ${label}.`);
    }
  });

  if (record.ID && !/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(record.ID)) {
    errors.push("El ID debe usar un formato como CALMI-015.");
  }

  const allEquipment = [...existingEquipment, ...pendingEquipment];

  if (
    record.ID &&
    allEquipment.some(item => normalize(item.ID) === normalize(record.ID))
  ) {
    errors.push(`El ID ${record.ID} ya existe.`);
  }

  const serial = normalize(record.NumeroSerie);

  if (
    serial &&
    !["sn", "na", "n/a"].includes(serial) &&
    allEquipment.some(item =>
      normalize(item.NumeroSerie) === serial
    )
  ) {
    errors.push(`El número de serie ${record.NumeroSerie} ya está registrado.`);
  }

  const calibrationDate = parseCsvDate(record.FechaCalibracion);
  const expirationDate = parseCsvDate(record.FechaVencimiento);

  if (
    calibrationDate &&
    expirationDate &&
    expirationDate <= calibrationDate
  ) {
    errors.push("La fecha de vencimiento debe ser posterior a la calibración.");
  }

  return errors;
}

function handleIdInput() {
  const id = cleanUpper(elements.equipmentId.value);
  elements.equipmentId.value = id;

  if (id) {
    elements.photoPath.value = `imagenes/${id}.jpg`;
    elements.certificatePath.value = `certificados/${id}.pdf`;
    elements.generatedId.textContent = id;
  }

  updatePreview();
}

function generateNextId() {
  const enteredId = cleanUpper(elements.equipmentId.value);
  const prefixFromInput = enteredId.match(/^([A-Z]+(?:[A-Z0-9]*))-?/)?.[1];
  const descriptionPrefix = inferPrefix(elements.description.value);
  const prefix = prefixFromInput || descriptionPrefix || "CAL";

  const allIds = [...existingEquipment, ...pendingEquipment]
    .map(item => cleanUpper(item.ID))
    .filter(id => id.startsWith(`${prefix}-`));

  const maximum = allIds.reduce((highest, id) => {
    const match = id.match(/-(\d+)$/);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  const nextId = `${prefix}-${String(maximum + 1).padStart(3, "0")}`;

  elements.equipmentId.value = nextId;
  elements.photoPath.value = `imagenes/${nextId}.jpg`;
  elements.certificatePath.value = `certificados/${nextId}.pdf`;
  elements.generatedId.textContent = nextId;

  updatePreview();
}

function inferPrefix(description) {
  const normalized = normalize(description);

  const rules = [
    ["vernier", "CALCA"],
    ["pie de rey", "CALCA"],
    ["micrometro", "CALMI"],
    ["optical comparator", "CALOP"],
    ["comparador optico", "CALOP"],
    ["cmm", "CALCMM"],
    ["roughness", "CALRG"],
    ["rugosidad", "CALRG"],
    ["weighing", "CALBA"],
    ["balanza", "CALBA"],
    ["block patron", "CALBP"],
    ["gage block", "CALBP"],
    ["balancer", "BAL"],
    ["blancer", "BAL"]
  ];

  return rules.find(([term]) => normalized.includes(term))?.[1] || "";
}

function updatePreview() {
  const id = cleanUpper(elements.equipmentId.value);
  const status = elements.calibrationStatus.value || "SIN FECHA";
  const imagePath = cleanValue(elements.photoPath.value);

  elements.previewDescription.textContent =
    cleanUpper(elements.description.value) || "Sin descripción";
  elements.previewId.textContent = id || "Sin ID";
  elements.previewBrand.textContent = cleanUpper(elements.brand.value) || "—";
  elements.previewSerial.textContent = cleanUpper(elements.serialNumber.value) || "—";
  elements.previewRange.textContent = cleanValue(elements.range.value) || "—";
  elements.previewLocation.textContent = cleanValue(elements.location.value) || "—";
  elements.previewCalibrationDate.textContent =
    formatDisplayDate(elements.calibrationDate.value);
  elements.previewExpirationDate.textContent =
    formatDisplayDate(elements.expirationDate.value);
  elements.previewLink.textContent = id ? `?id=${encodeURIComponent(id)}` : "?id=";

  elements.previewImage.src = imagePath || "imagenes/sin-imagen.jpg";
  elements.previewImage.onerror = function () {
    this.onerror = null;
    this.src = "imagenes/sin-imagen.jpg";
  };

  updateStatusBadge(elements.previewStatus, status);
}

function updateStatusBadge(element, status) {
  element.textContent = status;
  element.className = "status-badge";

  if (status === "CALIBRADO") {
    element.classList.add("status-calibrated");
  } else if (status === "POR VENCER") {
    element.classList.add("status-warning");
  } else if (status === "VENCIDO") {
    element.classList.add("status-expired");
  }
}

function renderPendingTable() {
  elements.pendingTableBody.innerHTML = "";

  if (!pendingEquipment.length) {
    elements.pendingTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          Todavía no se han agregado equipos.
        </td>
      </tr>
    `;
    return;
  }

  pendingEquipment.forEach((item, index) => {
    const row = document.createElement("tr");

    [
      item.ID,
      item.Descripcion,
      item.Marca,
      item.NumeroSerie,
      item.Ubicacion,
      item.FechaVencimiento
    ].forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const actionCell = document.createElement("td");
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Eliminar";
    removeButton.addEventListener("click", () => {
      pendingEquipment.splice(index, 1);
      renderPendingTable();
      updateCounters();
    });

    actionCell.appendChild(removeButton);
    row.appendChild(actionCell);
    elements.pendingTableBody.appendChild(row);
  });
}

function updateCounters() {
  elements.pendingCount.textContent = pendingEquipment.length;
  elements.downloadCsvButton.disabled = pendingEquipment.length === 0;
}

function downloadUpdatedCsv() {
  if (!pendingEquipment.length) {
    return;
  }

  const combinedData = [...existingEquipment, ...pendingEquipment];
  const csvContent = [
    CSV_HEADERS.join(","),
    ...combinedData.map(item =>
      CSV_HEADERS.map(header => escapeCsv(item[header] ?? "")).join(",")
    )
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "equipos.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function resetForm(showMessageAfterReset = true) {
  elements.form.reset();
  elements.equipmentStatus.value = "ACTIVO";
  elements.frequency.value = "12";
  setDefaultCalibrationDate();
  elements.expirationDate.value = "";
  elements.calibrationStatus.value = "SIN FECHA";
  elements.generatedId.textContent = "—";

  updateCalculatedFields();
  updatePreview();

  if (showMessageAfterReset) {
    hideValidation();
  }
}

function populateDatalist(datalist, values) {
  const uniqueValues = [...new Set(
    values.map(cleanValue).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "es"));

  datalist.innerHTML = "";

  uniqueValues.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    datalist.appendChild(option);
  });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      field += '"';
      index++;
    } else if (character === '"') {
      insideQuotes = !insideQuotes;
    } else if (character === "," && !insideQuotes) {
      row.push(field.trim());
      field = "";
    } else if (
      (character === "\n" || character === "\r") &&
      !insideQuotes
    ) {
      if (character === "\r" && nextCharacter === "\n") {
        index++;
      }

      row.push(field.trim());

      if (row.some(cell => cell !== "")) {
        rows.push(row);
      }

      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length || row.length) {
    row.push(field.trim());

    if (row.some(cell => cell !== "")) {
      rows.push(row);
    }
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows.shift().map(header =>
    header.replace(/^\uFEFF/, "").trim()
  );

  return rows.map(values => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = values[index] ?? "";
    });

    return item;
  });
}

function escapeCsv(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function formatCsvDate(inputDate) {
  if (!inputDate) {
    return "";
  }

  const [year, month, day] = inputDate.split("-");
  return `${day}/${month}/${year}`;
}

function parseCsvDate(value) {
  const match = String(value || "").match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (!match) {
    return null;
  }

  return new Date(
    Number(match[3]),
    Number(match[2]) - 1,
    Number(match[1])
  );
}

function parseInputDate(value) {
  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return null;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value) {
  const date = parseInputDate(value);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function calculateDaysRemaining(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  return Math.ceil((target - today) / 86400000);
}

function cleanValue(value) {
  return String(value || "").trim();
}

function cleanUpper(value) {
  return cleanValue(value).toUpperCase();
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function showValidation(message, type) {
  elements.validationMessage.textContent = message;
  elements.validationMessage.className = `validation-message ${type}`;
  elements.validationMessage.hidden = false;
}

function hideValidation() {
  elements.validationMessage.hidden = true;
}
