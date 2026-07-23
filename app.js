const DATA_FILE = "equipos.csv";
const WARNING_DAYS = 30;
const UPCOMING_LIMIT = 5;

let equipmentData = [];

const elements = {
  searchInput: document.getElementById("equipmentSearch"),
  searchButton: document.getElementById("searchButton"),
  suggestions: document.getElementById("suggestions"),
  messageBox: document.getElementById("messageBox"),
  card: document.getElementById("equipmentCard"),
  certificateButton: document.getElementById("certificateButton"),
  copyLinkButton: document.getElementById("copyLinkButton"),
  equipmentImage: document.getElementById("equipmentImage"),

  dashboard: document.getElementById("dashboard"),
  dashboardSearchButton: document.getElementById("dashboardSearchButton"),
  backToDashboardButton: document.getElementById("backToDashboardButton"),

  totalEquipment: document.getElementById("totalEquipment"),
  calibratedEquipment: document.getElementById("calibratedEquipment"),
  warningEquipment: document.getElementById("warningEquipment"),
  expiredEquipment: document.getElementById("expiredEquipment"),

  locationList: document.getElementById("locationList"),
  upcomingList: document.getElementById("upcomingList"),

  statusProgress: document.getElementById("statusProgress"),
  statusProgressFill: document.getElementById("statusProgressFill"),
  statusProgressLabel: document.getElementById("statusProgressLabel"),
  statusProgressDetail: document.getElementById("statusProgressDetail")
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  try {
    const response = await fetch(DATA_FILE, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("No fue posible cargar equipos.csv");
    }

    const csvText = await response.text();
    equipmentData = parseCSV(csvText);

    renderDashboard();

    const equipmentId = new URLSearchParams(
      window.location.search
    ).get("id");

    if (equipmentId) {
      if (elements.searchInput) {
        elements.searchInput.value = equipmentId;
      }

      showEquipmentById(equipmentId, false);
    } else {
      showDashboard(false);
    }

    bindEvents();
  } catch (error) {
    console.error(error);

    showMessage(
      "No fue posible cargar equipos.csv. Verifica que el archivo esté en la misma carpeta que app.js y que el sitio esté publicado en GitHub Pages."
    );

    hideDashboard();
    hideCard();
  }
}

function bindEvents() {
  if (elements.searchButton) {
    elements.searchButton.addEventListener(
      "click",
      performSearch
    );
  }

  if (elements.searchInput) {
    elements.searchInput.addEventListener(
      "keydown",
      event => {
        if (event.key === "Enter") {
          performSearch();
        }
      }
    );

    elements.searchInput.addEventListener(
      "input",
      showSuggestions
    );
  }

  if (elements.copyLinkButton) {
    elements.copyLinkButton.addEventListener(
      "click",
      copyCurrentLink
    );
  }

  if (elements.dashboardSearchButton) {
    elements.dashboardSearchButton.addEventListener(
      "click",
      focusSearch
    );
  }

  if (elements.backToDashboardButton) {
    elements.backToDashboardButton.addEventListener(
      "click",
      () => showDashboard(true)
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

    if (
      char === '"' &&
      insideQuotes &&
      nextChar === '"'
    ) {
      field += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(field.trim());
      field = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !insideQuotes
    ) {
      if (
        char === "\r" &&
        nextChar === "\n"
      ) {
        i++;
      }

      row.push(field.trim());

      if (
        row.some(cell => cell !== "")
      ) {
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

    if (
      row.some(cell => cell !== "")
    ) {
      rows.push(row);
    }
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows
    .shift()
    .map(header =>
      header
        .replace(/^\uFEFF/, "")
        .trim()
    );

  return rows.map(values => {
    const item = {};

    headers.forEach(
      (header, index) => {
        item[header] =
          values[index] ?? "";
      }
    );

    return item;
  });
}

function renderDashboard() {
  const equipmentWithStatus =
    equipmentData.map(item => {
      const expirationDate =
        parseDate(
          item.FechaVencimiento
        );

      const daysRemaining =
        calculateDaysRemaining(
          expirationDate
        );

      const status =
        determineStatus(
          item.EstadoCalibracion,
          daysRemaining,
          expirationDate
        );

      return {
        ...item,
        expirationDate,
        daysRemaining,
        calculatedStatus: status
      };
    });

  const calibrated =
    equipmentWithStatus.filter(
      item =>
        item.calculatedStatus.key ===
        "calibrado"
    ).length;

  const warning =
    equipmentWithStatus.filter(
      item =>
        item.calculatedStatus.key ===
        "por-vencer"
    ).length;

  const expired =
    equipmentWithStatus.filter(
      item =>
        item.calculatedStatus.key ===
        "vencido"
    ).length;

  setText(
    "totalEquipment",
    equipmentWithStatus.length
  );

  setText(
    "calibratedEquipment",
    calibrated
  );

  setText(
    "warningEquipment",
    warning
  );

  setText(
    "expiredEquipment",
    expired
  );

  renderLocations(
    equipmentWithStatus
  );

  renderUpcomingExpirations(
    equipmentWithStatus
  );
}

function renderLocations(data) {
  if (!elements.locationList) {
    return;
  }

  const locationCounts =
    new Map();

  data.forEach(item => {
    const location =
      item.Ubicacion?.trim() ||
      "Sin ubicación";

    locationCounts.set(
      location,
      (locationCounts.get(location) || 0) + 1
    );
  });

  const locations =
    [...locationCounts.entries()]
      .sort(
        (a, b) => b[1] - a[1]
      );

  elements.locationList.innerHTML = "";

  if (!locations.length) {
    elements.locationList.innerHTML =
      '<p class="empty-state">No existen ubicaciones registradas.</p>';

    return;
  }

  const maximum = Math.max(
    ...locations.map(
      ([, count]) => count
    )
  );

  locations.forEach(
    ([location, count]) => {
      const percentage =
        maximum > 0
          ? (count / maximum) * 100
          : 0;

      const row =
        document.createElement("div");

      row.className =
        "location-row";

      const header =
        document.createElement("div");

      header.className =
        "location-row-header";

      const name =
        document.createElement("span");

      name.textContent = location;

      const total =
        document.createElement("strong");

      total.textContent = count;

      const track =
        document.createElement("div");

      track.className =
        "location-bar-track";

      const fill =
        document.createElement("div");

      fill.className =
        "location-bar-fill";

      fill.style.width =
        `${percentage}%`;

      header.append(name, total);
      track.appendChild(fill);

      row.append(
        header,
        track
      );

      elements.locationList
        .appendChild(row);
    }
  );
}

function renderUpcomingExpirations(data) {
  if (!elements.upcomingList) {
    return;
  }

  const upcoming = data
    .filter(item =>
      item.expirationDate &&
      item.daysRemaining !== null &&
      item.daysRemaining >= 0
    )
    .sort(
      (a, b) =>
        a.daysRemaining -
        b.daysRemaining
    )
    .slice(0, UPCOMING_LIMIT);

  elements.upcomingList.innerHTML = "";

  if (!upcoming.length) {
    elements.upcomingList.innerHTML =
      '<p class="empty-state">No existen próximos vencimientos con fecha válida.</p>';

    return;
  }

  upcoming.forEach(item => {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className =
      "upcoming-item";

    const main =
      document.createElement("span");

    main.className =
      "upcoming-main";

    const id =
      document.createElement("strong");

    id.textContent =
      item.ID || "Sin ID";

    const description =
      document.createElement("span");

    description.textContent =
      item.Descripcion ||
      "Sin descripción";

    const days =
      document.createElement("span");

    days.className =
      "upcoming-days";

    days.textContent =
      upcomingText(
        item.daysRemaining
      );

    main.append(
      id,
      description
    );

    button.append(
      main,
      days
    );

    button.addEventListener(
      "click",
      () => {
        if (elements.searchInput) {
          elements.searchInput.value =
            item.ID;
        }

        displayEquipment(item);
      }
    );

    elements.upcomingList
      .appendChild(button);
  });
}

function performSearch() {
  if (!elements.searchInput) {
    return;
  }

  const query =
    elements.searchInput.value.trim();

  if (!query) {
    showMessage(
      "Escribe un ID o una descripción para buscar."
    );

    hideCard();
    return;
  }

  const exactMatch =
    equipmentData.find(
      item =>
        normalize(item.ID) ===
        normalize(query)
    );

  if (exactMatch) {
    displayEquipment(
      exactMatch
    );

    return;
  }

  const matches =
    findMatches(query);

  if (matches.length === 1) {
    displayEquipment(
      matches[0]
    );
  } else if (
    matches.length > 1
  ) {
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

function showEquipmentById(
  id,
  updateUrl = true
) {
  const equipment =
    equipmentData.find(
      item =>
        normalize(item.ID) ===
        normalize(id)
    );

  if (equipment) {
    displayEquipment(
      equipment,
      updateUrl
    );
  } else {
    hideDashboard();

    showMessage(
      `No se encontró el equipo ${id}.`
    );

    hideCard();
  }
}

function findMatches(query) {
  const normalizedQuery =
    normalize(query);

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
        normalize(value).includes(
          normalizedQuery
        )
      )
    )
    .slice(0, 8);
}

function showSuggestions() {
  if (
    !elements.searchInput ||
    !elements.suggestions
  ) {
    return;
  }

  const query =
    elements.searchInput.value.trim();

  if (query.length < 2) {
    elements.suggestions.hidden = true;
    return;
  }

  renderSuggestions(
    findMatches(query)
  );
}

function renderSuggestions(matches) {
  if (!elements.suggestions) {
    return;
  }

  elements.suggestions.innerHTML = "";

  if (!matches.length) {
    elements.suggestions.hidden = true;
    return;
  }

  matches.forEach(item => {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className =
      "suggestion";

    button.textContent =
      `${item.ID} — ${item.Descripcion}`;

    button.addEventListener(
      "click",
      () => {
        if (elements.searchInput) {
          elements.searchInput.value =
            item.ID;
        }

        elements.suggestions.hidden =
          true;

        displayEquipment(item);
      }
    );

    elements.suggestions
      .appendChild(button);
  });

  elements.suggestions.hidden = false;
}

function displayEquipment(
  item,
  updateUrl = true
) {
  hideDashboard();

  if (elements.suggestions) {
    elements.suggestions.hidden = true;
  }

  if (elements.messageBox) {
    elements.messageBox.hidden = true;
  }

  if (elements.card) {
    elements.card.hidden = false;
  }

  const expirationDate =
    parseDate(
      item.FechaVencimiento
    );

  const daysRemaining =
    calculateDaysRemaining(
      expirationDate
    );

  const calibrationStatus =
    determineStatus(
      item.EstadoCalibracion,
      daysRemaining,
      expirationDate
    );

  setText(
    "equipmentType",
    "Equipo de medición"
  );

  setText(
    "equipmentDescription",
    item.Descripcion ||
      "Sin descripción"
  );

  setText(
    "equipmentId",
    item.ID || "Sin ID"
  );

  setText(
    "brand",
    item.Marca || "—"
  );

  setText(
    "model",
    item.Rango || "—"
  );

  setText(
    "serial",
    item.NumeroSerie || "—"
  );

  setText(
    "location",
    item.Ubicacion || "—"
  );

  setText(
    "responsible",
    item.EstadoEquipo || "—"
  );

  setText(
    "frequency",
    item.FrecuenciaMeses
      ? `${item.FrecuenciaMeses} meses`
      : "—"
  );

  setText(
    "lastCalibration",
    formatDate(
      parseDate(
        item.FechaCalibracion
      )
    )
  );

  setText(
    "nextCalibration",
    formatDate(
      expirationDate
    )
  );

  setText(
    "daysRemaining",
    daysRemaining === null
      ? "Sin fecha"
      : formatDays(
          daysRemaining
        )
  );

  const statusBadge =
    document.getElementById(
      "statusBadge"
    );

  if (statusBadge) {
    statusBadge.textContent =
      calibrationStatus.label;

    statusBadge.className =
      `status-badge ${calibrationStatus.className}`;
  }

  renderStatusProgress(
    calibrationStatus,
    daysRemaining
  );

  if (elements.certificateButton) {
    if (item.URLCertificado) {
      elements.certificateButton.href =
        item.URLCertificado;

      elements.certificateButton.hidden =
        false;
    } else {
      elements.certificateButton.hidden =
        true;
    }
  }

  if (elements.equipmentImage) {
    const imagePath =
      item.Foto &&
      item.Foto.trim() !== ""
        ? item.Foto
        : "imagenes/sin-imagen.jpg";

    elements.equipmentImage.src =
      imagePath;

    elements.equipmentImage.alt =
      `Fotografía del equipo ${item.ID || ""}`;

    elements.equipmentImage.onerror =
      function () {
        this.onerror = null;
        this.src =
          "imagenes/sin-imagen.jpg";
      };
  }

  if (updateUrl) {
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.set(
      "id",
      item.ID
    );

    window.history.pushState(
      {},
      "",
      url
    );
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function renderStatusProgress(
  status,
  daysRemaining
) {
  if (
    !elements.statusProgress ||
    !elements.statusProgressFill
  ) {
    return;
  }

  let percentage = 0;

  if (
    status.key === "calibrado"
  ) {
    percentage = 100;
  } else if (
    status.key === "por-vencer"
  ) {
    percentage = Math.max(
      8,
      Math.min(
        100,
        (
          (daysRemaining || 0) /
          WARNING_DAYS
        ) * 100
      )
    );
  } else if (
    status.key === "vencido"
  ) {
    percentage = 18;
  }

  elements.statusProgress.className =
    `status-progress ${status.progressClassName}`;

  elements.statusProgressFill.style.width =
    `${percentage}%`;

  if (elements.statusProgressLabel) {
    elements.statusProgressLabel.textContent =
      status.label;
  }

  if (elements.statusProgressDetail) {
    elements.statusProgressDetail.textContent =
      daysRemaining === null
        ? "Sin fecha de vencimiento"
        : formatDays(
            daysRemaining
          );
  }
}

function determineStatus(
  explicitStatus,
  daysRemaining,
  expirationDate
) {
  if (
    expirationDate &&
    daysRemaining !== null
  ) {
    if (daysRemaining < 0) {
      return {
        key: "vencido",
        label: "VENCIDO",
        className: "status-vencido",
        progressClassName:
          "progress-vencido"
      };
    }

    if (
      daysRemaining <=
      WARNING_DAYS
    ) {
      return {
        key: "por-vencer",
        label: "POR VENCER",
        className:
          "status-por-vencer",
        progressClassName:
          "progress-por-vencer"
      };
    }

    return {
      key: "calibrado",
      label: "CALIBRADO",
      className:
        "status-calibrado",
      progressClassName:
        "progress-calibrado"
    };
  }

  const normalizedStatus =
    normalize(explicitStatus);

  if (
    normalizedStatus ===
    "vencido"
  ) {
    return {
      key: "vencido",
      label: "VENCIDO",
      className:
        "status-vencido",
      progressClassName:
        "progress-vencido"
    };
  }

  if (
    normalizedStatus ===
    "por vencer"
  ) {
    return {
      key: "por-vencer",
      label: "POR VENCER",
      className:
        "status-por-vencer",
      progressClassName:
        "progress-por-vencer"
    };
  }

  if (
    normalizedStatus ===
    "calibrado"
  ) {
    return {
      key: "calibrado",
      label: "CALIBRADO",
      className:
        "status-calibrado",
      progressClassName:
        "progress-calibrado"
    };
  }

  return {
    key: "sin-fecha",
    label: "SIN FECHA",
    className: "",
    progressClassName:
      "progress-sin-fecha"
  };
}

function showDashboard(
  updateUrl = true
) {
  if (updateUrl) {
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.delete("id");

    window.history.pushState(
      {},
      "",
      url
    );
  }

  if (elements.dashboard) {
    elements.dashboard.hidden =
      false;
  }

  hideCard();

  if (elements.messageBox) {
    elements.messageBox.hidden =
      true;
  }

  if (elements.suggestions) {
    elements.suggestions.hidden =
      true;
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function hideDashboard() {
  if (elements.dashboard) {
    elements.dashboard.hidden =
      true;
  }
}

function focusSearch() {
  if (!elements.searchInput) {
    return;
  }

  elements.searchInput.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  setTimeout(() => {
    elements.searchInput.focus();
  }, 350);
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const cleanedValue =
    value.trim();

  const isoFormat =
    cleanedValue.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (isoFormat) {
    return new Date(
      Number(isoFormat[1]),
      Number(isoFormat[2]) - 1,
      Number(isoFormat[3])
    );
  }

  const localFormat =
    cleanedValue.match(
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

  today.setHours(
    0,
    0,
    0,
    0
  );

  const targetDate =
    new Date(date);

  targetDate.setHours(
    0,
    0,
    0,
    0
  );

  return Math.ceil(
    (
      targetDate - today
    ) /
    86400000
  );
}

function formatDate(date) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-MX",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);
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

function upcomingText(days) {
  if (days === 0) {
    return "Vence hoy";
  }

  if (days === 1) {
    return "Vence en 1 día";
  }

  return `Vence en ${days} días`;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .trim();
}

function setText(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function showMessage(message) {
  if (!elements.messageBox) {
    return;
  }

  elements.messageBox.textContent =
    message;

  elements.messageBox.hidden =
    false;
}

function hideCard() {
  if (elements.card) {
    elements.card.hidden =
      true;
  }
}

async function copyCurrentLink() {
  try {
    await navigator.clipboard.writeText(
      window.location.href
    );

    if (
      elements.copyLinkButton
    ) {
      elements.copyLinkButton.textContent =
        "Enlace copiado";

      setTimeout(() => {
        elements.copyLinkButton.textContent =
          "Copiar enlace de esta ficha";
      }, 1800);
    }
  } catch {
    alert(
      "Copia manualmente la dirección mostrada en el navegador."
    );
  }
}

window.addEventListener(
  "popstate",
  () => {
    const equipmentId =
      new URLSearchParams(
        window.location.search
      ).get("id");

    if (equipmentId) {
      showEquipmentById(
        equipmentId,
        false
      );
    } else {
      showDashboard(false);
    }
  }
);
