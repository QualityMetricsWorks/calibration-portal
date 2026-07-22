const DATA_FILE = "equipos.csv";
const WARNING_DAYS = 30;

let equipmentData = [];

const elements = {
  searchInput: document.getElementById("equipmentSearch"),
  searchButton: document.getElementById("searchButton"),
  suggestions: document.getElementById("suggestions"),
  messageBox: document.getElementById("messageBox"),
  card: document.getElementById("equipmentCard"),
  certificateButton: document.getElementById("certificateButton"),
  copyLinkButton: document.getElementById("copyLinkButton"),
  equipmentImage: document.getElementById("equipmentImage")
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  try {
    const response = await fetch(DATA_FILE, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("No fue posible cargar equipos.csv");
    }

    const csvText = await response.text();
    equipmentData = parseCSV(csvText);

    const equipmentId = new URLSearchParams(window.location.search).get("id");

    if (equipmentId) {
      elements.searchInput.value = equipmentId;
      showEquipmentById(equipmentId);
    } else {
      showMessage("Escribe el ID del equipo para consultar su información.");
    }

    elements.searchButton.addEventListener("click", performSearch);

    elements.searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        performSearch();
      }
    });

    elements.searchInput.addEventListener("input", showSuggestions);

    elements.copyLinkButton.addEventListener("click", copyCurrentLink);
  } catch (error) {
    showMessage(
      "No fue posible cargar equipos.csv. Verifica que el archivo esté en la misma carpeta que app.js y que el sitio esté publicado en GitHub Pages."
    );
  }
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(field.trim());
      field = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }

      row.push(field.trim());

      if (row.some(cell => cell !== "")) {
        rows.push(row);
      }

      row = [];
      field = "";
    } else {
      field += char;
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

  const headers = rows
    .shift()
    .map(header => header.replace(/^\uFEFF/, "").trim());

  return rows.map(values => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = values[index] ?? "";
    });

    return item;
  });
}

function performSearch() {
  const query = elements.searchInput.value.trim();

  if (!query) {
    showMessage("Escribe un ID o una descripción para buscar.");
    hideCard();
    return;
  }

  const exactMatch = equipmentData.find(
    item => normalize(item.ID) === normalize(query)
  );

  if (exactMatch) {
    displayEquipment(exactMatch);
    return;
  }

  const matches = findMatches(query);

  if (matches.length === 1) {
    displayEquipment(matches[0]);
  } else if (matches.length > 1) {
    showMessage(
      `Se encontraron ${matches.length} coincidencias. Selecciona una opción.`
    );
    renderSuggestions(matches);
    hideCard();
  } else {
    showMessage(
      `No se encontró ningún equipo relacionado con “${query}”.`
    );
    hideCard();
  }
}

function showEquipmentById(id) {
  const equipment = equipmentData.find(
    item => normalize(item.ID) === normalize(id)
  );

  if (equipment) {
    displayEquipment(equipment);
  } else {
    showMessage(`No se encontró el equipo ${id}.`);
    hideCard();
  }
}

function findMatches(query) {
  const normalizedQuery = normalize(query);

  return equipmentData
    .filter(item =>
      [
        item.ID,
        item.Descripcion,
        item.Marca,
        item.NumeroSerie,
        item.Rango,
        item.Ubicacion
      ].some(value =>
        normalize(value).includes(normalizedQuery)
      )
    )
    .slice(0, 8);
}

function showSuggestions() {
  const query = elements.searchInput.value.trim();

  if (query.length < 2) {
    elements.suggestions.hidden = true;
    return;
  }

  renderSuggestions(findMatches(query));
}

function renderSuggestions(matches) {
  elements.suggestions.innerHTML = "";

  if (!matches.length) {
    elements.suggestions.hidden = true;
    return;
  }

  matches.forEach(item => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "suggestion";
    button.textContent = `${item.ID} — ${item.Descripcion}`;

    button.addEventListener("click", () => {
      elements.searchInput.value = item.ID;
      elements.suggestions.hidden = true;
      displayEquipment(item);
    });

    elements.suggestions.appendChild(button);
  });

  elements.suggestions.hidden = false;
}

function displayEquipment(item) {
  elements.suggestions.hidden = true;
  elements.messageBox.hidden = true;
  elements.card.hidden = false;

  const expirationDate = parseDate(item.FechaVencimiento);
  const daysRemaining = calculateDaysRemaining(expirationDate);

  const calibrationStatus = determineStatus(
    item.EstadoCalibracion,
    daysRemaining,
    expirationDate
  );

  setText("equipmentType", "Equipo de medición");
  setText("equipmentDescription", item.Descripcion || "Sin descripción");
  setText("equipmentId", item.ID || "Sin ID");
  setText("brand", item.Marca || "—");
  setText("model", item.Rango || "—");
  setText("serial", item.NumeroSerie || "—");
  setText("location", item.Ubicacion || "—");
  setText("responsible", item.EstadoEquipo || "—");

  setText(
    "frequency",
    item.FrecuenciaMeses
      ? `${item.FrecuenciaMeses} meses`
      : "—"
  );

  setText(
    "lastCalibration",
    formatDate(parseDate(item.FechaCalibracion))
  );

  setText(
    "nextCalibration",
    formatDate(expirationDate)
  );

  setText(
    "daysRemaining",
    daysRemaining === null
      ? "Sin fecha"
      : formatDays(daysRemaining)
  );

  const statusBadge = document.getElementById("statusBadge");

  statusBadge.textContent = calibrationStatus.label;
  statusBadge.className =
    `status-badge ${calibrationStatus.className}`;

  if (item.URLCertificado) {
    elements.certificateButton.href = item.URLCertificado;
    elements.certificateButton.hidden = false;
  } else {
    elements.certificateButton.hidden = true;
  }

  if (elements.equipmentImage) {
    const imagePath =
      item.Foto && item.Foto.trim() !== ""
        ? item.Foto
        : "imagenes/sin-imagen.jpg";

    elements.equipmentImage.src = imagePath;
    elements.equipmentImage.alt =
      `Fotografía del equipo ${item.ID || ""}`;

    elements.equipmentImage.onerror = function () {
      this.onerror = null;
      this.src = "imagenes/sin-imagen.jpg";
    };
  }

  const url = new URL(window.location.href);
  url.searchParams.set("id", item.ID);
  window.history.replaceState({}, "", url);
}

function determineStatus(explicitStatus, daysRemaining, expirationDate) {
  const normalizedStatus = normalize(explicitStatus);

  if (normalizedStatus === "vencido") {
    return {
      label: "VENCIDO",
      className: "status-vencido"
    };
  }

  if (normalizedStatus === "por vencer") {
    return {
      label: "POR VENCER",
      className: "status-por-vencer"
    };
  }

  if (normalizedStatus === "calibrado") {
    return {
      label: "CALIBRADO",
      className: "status-calibrado"
    };
  }

  if (!expirationDate || daysRemaining === null) {
    return {
      label: "SIN FECHA",
      className: ""
    };
  }

  if (daysRemaining < 0) {
    return {
      label: "VENCIDO",
      className: "status-vencido"
    };
  }

  if (daysRemaining <= WARNING_DAYS) {
    return {
      label: "POR VENCER",
      className: "status-por-vencer"
    };
  }

  return {
    label: "CALIBRADO",
    className: "status-calibrado"
  };
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const cleanedValue = value.trim();

  const isoFormat = cleanedValue.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (isoFormat) {
    return new Date(
      Number(isoFormat[1]),
      Number(isoFormat[2]) - 1,
      Number(isoFormat[3])
    );
  }

  const localFormat = cleanedValue.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
  );

  if (localFormat) {
    return new Date(
      Number(localFormat[3]),
      Number(localFormat[2]) - 1,
      Number(localFormat[1])
    );
  }

  return null;
}

function calculateDaysRemaining(date) {
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return Math.ceil(
    (targetDate - today) / 86400000
  );
}

function formatDate(date) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatDays(days) {
  if (days < 0) {
    return `${Math.abs(days)} días vencido`;
  }

  if (days === 0) {
    return "Vence hoy";
  }

  if (days === 1) {
    return "1 día";
  }

  return `${days} días`;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function showMessage(message) {
  elements.messageBox.textContent = message;
  elements.messageBox.hidden = false;
}

function hideCard() {
  elements.card.hidden = true;
}

async function copyCurrentLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);

    elements.copyLinkButton.textContent = "Enlace copiado";

    setTimeout(() => {
      elements.copyLinkButton.textContent =
        "Copiar enlace de esta ficha";
    }, 1800);
  } catch {
    alert(
      "Copia manualmente la dirección mostrada en el navegador."
    );
  }
}
