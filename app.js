const DATA_FILE = "equipos.csv";
const WARNING_DAYS = 30;
const UPCOMING_LIMIT = 5;
const THEME_KEY = "metrics-calibration-theme";

let equipmentData = [];
let equipmentWithStatus = [];

const elements = {
  searchInput: document.getElementById("equipmentSearch"),
  searchButton: document.getElementById("searchButton"),
  suggestions: document.getElementById("suggestions"),
  messageBox: document.getElementById("messageBox"),
  card: document.getElementById("equipmentCard"),
  certificateButton: document.getElementById("certificateButton"),
  copyLinkButton: document.getElementById("copyLinkButton"),
  printEquipmentButton: document.getElementById("printEquipmentButton"),
  equipmentImage: document.getElementById("equipmentImage"),
  dashboard: document.getElementById("dashboard"),
  dashboardSearchButton: document.getElementById("dashboardSearchButton"),
  backToDashboardButton: document.getElementById("backToDashboardButton"),
  locationFilter: document.getElementById("locationFilter"),
  brandFilter: document.getElementById("brandFilter"),
  clearFiltersButton: document.getElementById("clearFiltersButton"),
  statusDonut: document.getElementById("statusDonut"),
  locationList: document.getElementById("locationList"),
  upcomingList: document.getElementById("upcomingList"),
  themeToggleButton: document.getElementById("themeToggleButton"),
  themeToggleIcon: document.getElementById("themeToggleIcon"),
  themeToggleText: document.getElementById("themeToggleText"),
  statusProgress: document.getElementById("statusProgress"),
  statusProgressFill: document.getElementById("statusProgressFill"),
  statusProgressLabel: document.getElementById("statusProgressLabel"),
  statusProgressDetail: document.getElementById("statusProgressDetail")
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  applySavedTheme();

  try {
    const response = await fetch(DATA_FILE, { cache: "no-store" });
    if (!response.ok) throw new Error("No fue posible cargar equipos.csv");

    equipmentData = parseCSV(await response.text());
    equipmentWithStatus = equipmentData.map(addCalculatedStatus);

    populateFilters();
    renderDashboard();
    bindEvents();

    const equipmentId = new URLSearchParams(window.location.search).get("id");
    if (equipmentId) {
      if (elements.searchInput) elements.searchInput.value = equipmentId;
      showEquipmentById(equipmentId, false);
    } else {
      showDashboard(false);
    }
  } catch (error) {
    console.error(error);
    showMessage("No fue posible cargar equipos.csv. Verifica que el archivo esté en la misma carpeta que app.js y que el sitio esté publicado en GitHub Pages.");
    hideDashboard();
    hideCard();
  }
}

function bindEvents() {
  elements.searchButton?.addEventListener("click", performSearch);
  elements.searchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter") performSearch();
  });
  elements.searchInput?.addEventListener("input", showSuggestions);
  elements.copyLinkButton?.addEventListener("click", copyCurrentLink);
  elements.printEquipmentButton?.addEventListener("click", () => window.print());
  elements.dashboardSearchButton?.addEventListener("click", focusSearch);
  elements.backToDashboardButton?.addEventListener("click", () => showDashboard(true));
  elements.locationFilter?.addEventListener("change", renderDashboard);
  elements.brandFilter?.addEventListener("change", renderDashboard);
  elements.clearFiltersButton?.addEventListener("click", clearFilters);
  elements.themeToggleButton?.addEventListener("click", toggleTheme);
}

function addCalculatedStatus(item) {
  const expirationDate = parseDate(item.FechaVencimiento);
  const daysRemaining = calculateDaysRemaining(expirationDate);
  return {
    ...item,
    expirationDate,
    daysRemaining,
    calculatedStatus: determineStatus(item.EstadoCalibracion, daysRemaining, expirationDate)
  };
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
      if (char === "\r" && nextChar === "\n") i++;
      row.push(field.trim());
      if (row.some(cell => cell !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field.trim());
    if (row.some(cell => cell !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows.shift().map(header => header.replace(/^\uFEFF/, "").trim());
  return rows.map(values => {
    const item = {};
    headers.forEach((header, index) => item[header] = values[index] ?? "");
    return item;
  });
}

function populateFilters() {
  populateSelect(elements.locationFilter, equipmentData.map(item => item.Ubicacion), "Todas las ubicaciones");
  populateSelect(elements.brandFilter, equipmentData.map(item => item.Marca), "Todas las marcas");
}

function populateSelect(select, values, defaultText) {
  if (!select) return;
  const unique = [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
  select.innerHTML = `<option value="">${defaultText}</option>`;
  unique.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function getFilteredData() {
  const location = normalize(elements.locationFilter?.value);
  const brand = normalize(elements.brandFilter?.value);
  return equipmentWithStatus.filter(item =>
    (!location || normalize(item.Ubicacion) === location) &&
    (!brand || normalize(item.Marca) === brand)
  );
}

function clearFilters() {
  if (elements.locationFilter) elements.locationFilter.value = "";
  if (elements.brandFilter) elements.brandFilter.value = "";
  renderDashboard();
}

function renderDashboard() {
  const data = getFilteredData();
  const calibrated = data.filter(item => item.calculatedStatus.key === "calibrado").length;
  const warning = data.filter(item => item.calculatedStatus.key === "por-vencer").length;
  const expired = data.filter(item => item.calculatedStatus.key === "vencido").length;

  setText("totalEquipment", data.length);
  setText("calibratedEquipment", calibrated);
  setText("warningEquipment", warning);
  setText("expiredEquipment", expired);

  renderChart(data.length, calibrated, warning, expired);
  renderLocations(data);
  renderUpcomingExpirations(data);
}

function renderChart(total, calibrated, warning, expired) {
  const calibratedPercent = total ? calibrated / total * 100 : 0;
  const warningPercent = total ? warning / total * 100 : 0;
  const expiredPercent = total ? expired / total * 100 : 0;
  const firstEnd = calibratedPercent;
  const secondEnd = calibratedPercent + warningPercent;

  if (elements.statusDonut) {
    elements.statusDonut.style.background = `conic-gradient(var(--brand-green) 0% ${firstEnd}%, var(--brand-orange) ${firstEnd}% ${secondEnd}%, var(--danger) ${secondEnd}% 100%)`;
    elements.statusDonut.setAttribute("aria-label", `${calibrated} calibrados, ${warning} por vencer y ${expired} vencidos.`);
  }

  setText("chartTotal", total);
  setText("chartCalibrated", `${Math.round(calibratedPercent)}%`);
  setText("chartWarning", `${Math.round(warningPercent)}%`);
  setText("chartExpired", `${Math.round(expiredPercent)}%`);
}

function renderLocations(data) {
  if (!elements.locationList) return;
  const counts = new Map();
  data.forEach(item => {
    const location = item.Ubicacion?.trim() || "Sin ubicación";
    counts.set(location, (counts.get(location) || 0) + 1);
  });

  const locations = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  elements.locationList.innerHTML = "";
  if (!locations.length) {
    elements.locationList.innerHTML = '<p class="empty-state">No existen equipos para los filtros seleccionados.</p>';
    return;
  }

  const maximum = Math.max(...locations.map(([, count]) => count));
  locations.forEach(([location, count]) => {
    const row = document.createElement("div");
    row.className = "location-row";
    row.innerHTML = `<div class="location-row-header"><span></span><strong>${count}</strong></div><div class="location-bar-track"><div class="location-bar-fill"></div></div>`;
    row.querySelector("span").textContent = location;
    row.querySelector(".location-bar-fill").style.width = `${count / maximum * 100}%`;
    elements.locationList.appendChild(row);
  });
}

function renderUpcomingExpirations(data) {
  if (!elements.upcomingList) return;
  const upcoming = data
    .filter(item => item.expirationDate && item.daysRemaining !== null && item.daysRemaining >= 0)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, UPCOMING_LIMIT);

  elements.upcomingList.innerHTML = "";
  if (!upcoming.length) {
    elements.upcomingList.innerHTML = '<p class="empty-state">No existen próximos vencimientos con fecha válida.</p>';
    return;
  }

  upcoming.forEach(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "upcoming-item";

    const image = document.createElement("img");
    image.className = "upcoming-thumbnail";
    image.src = item.Foto?.trim() || "imagenes/sin-imagen.jpg";
    image.alt = `Miniatura del equipo ${item.ID || ""}`;
    image.loading = "lazy";
    image.onerror = function () { this.onerror = null; this.src = "imagenes/sin-imagen.jpg"; };

    const main = document.createElement("span");
    main.className = "upcoming-main";
    const id = document.createElement("strong");
    id.textContent = item.ID || "Sin ID";
    const description = document.createElement("span");
    description.textContent = item.Descripcion || "Sin descripción";
    const detail = document.createElement("span");
    detail.className = "upcoming-details";
    detail.textContent = [item.Marca?.trim(), item.Ubicacion?.trim()].filter(Boolean).join(" · ") || "Sin información adicional";
    main.append(id, description, detail);

    const days = document.createElement("span");
    days.className = "upcoming-days";
    days.textContent = upcomingText(item.daysRemaining);

    button.append(image, main, days);
    button.addEventListener("click", () => {
      if (elements.searchInput) elements.searchInput.value = item.ID;
      displayEquipment(item);
    });
    elements.upcomingList.appendChild(button);
  });
}

function performSearch() {
  if (!elements.searchInput) return;
  const query = elements.searchInput.value.trim();
  if (!query) {
    showMessage("Escribe un ID o una descripción para buscar.");
    hideCard();
    return;
  }

  const exactMatch = equipmentData.find(item => normalize(item.ID) === normalize(query));
  if (exactMatch) return displayEquipment(exactMatch);

  const matches = findMatches(query);
  if (matches.length === 1) displayEquipment(matches[0]);
  else if (matches.length > 1) {
    showMessage(`Se encontraron ${matches.length} coincidencias. Selecciona una opción.`);
    renderSuggestions(matches);
    hideCard();
  } else {
    showMessage(`No se encontró ningún equipo relacionado con “${query}”.`);
    hideCard();
  }
}

function showEquipmentById(id, updateUrl = true) {
  const equipment = equipmentData.find(item => normalize(item.ID) === normalize(id));
  if (equipment) displayEquipment(equipment, updateUrl);
  else {
    hideDashboard();
    showMessage(`No se encontró el equipo ${id}.`);
    hideCard();
  }
}

function findMatches(query) {
  const normalizedQuery = normalize(query);
  return equipmentData.filter(item => [item.ID, item.Descripcion, item.Marca, item.NumeroSerie, item.Rango, item.Ubicacion]
    .some(value => normalize(value).includes(normalizedQuery))).slice(0, 8);
}

function showSuggestions() {
  if (!elements.searchInput || !elements.suggestions) return;
  const query = elements.searchInput.value.trim();
  if (query.length < 2) {
    elements.suggestions.hidden = true;
    return;
  }
  renderSuggestions(findMatches(query));
}

function renderSuggestions(matches) {
  if (!elements.suggestions) return;
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
      if (elements.searchInput) elements.searchInput.value = item.ID;
      elements.suggestions.hidden = true;
      displayEquipment(item);
    });
    elements.suggestions.appendChild(button);
  });
  elements.suggestions.hidden = false;
}

function displayEquipment(item, updateUrl = true) {
  hideDashboard();
  if (elements.suggestions) elements.suggestions.hidden = true;
  if (elements.messageBox) elements.messageBox.hidden = true;
  if (elements.card) elements.card.hidden = false;

  const expirationDate = parseDate(item.FechaVencimiento);
  const daysRemaining = calculateDaysRemaining(expirationDate);
  const status = determineStatus(item.EstadoCalibracion, daysRemaining, expirationDate);

  setText("equipmentType", "Equipo de medición");
  setText("equipmentDescription", item.Descripcion || "Sin descripción");
  setText("equipmentId", item.ID || "Sin ID");
  setText("brand", item.Marca || "—");
  setText("model", item.Rango || "—");
  setText("serial", item.NumeroSerie || "—");
  setText("location", item.Ubicacion || "—");
  setText("responsible", item.EstadoEquipo || "—");
  setText("frequency", item.FrecuenciaMeses ? `${item.FrecuenciaMeses} meses` : "—");
  setText("lastCalibration", formatDate(parseDate(item.FechaCalibracion)));
  setText("nextCalibration", formatDate(expirationDate));
  setText("daysRemaining", daysRemaining === null ? "Sin fecha" : formatDays(daysRemaining));

  const badge = document.getElementById("statusBadge");
  if (badge) {
    badge.textContent = status.label;
    badge.className = `status-badge ${status.className}`;
  }
  renderStatusProgress(status, daysRemaining);

  if (elements.certificateButton) {
    elements.certificateButton.hidden = !item.URLCertificado;
    if (item.URLCertificado) elements.certificateButton.href = item.URLCertificado;
  }

  if (elements.equipmentImage) {
    elements.equipmentImage.src = item.Foto?.trim() || "imagenes/sin-imagen.jpg";
    elements.equipmentImage.alt = `Fotografía del equipo ${item.ID || ""}`;
    elements.equipmentImage.onerror = function () { this.onerror = null; this.src = "imagenes/sin-imagen.jpg"; };
  }

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("id", item.ID);
    window.history.pushState({}, "", url);
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStatusProgress(status, daysRemaining) {
  if (!elements.statusProgress || !elements.statusProgressFill) return;
  let percentage = 0;
  if (status.key === "calibrado") percentage = 100;
  else if (status.key === "por-vencer") percentage = Math.max(8, Math.min(100, ((daysRemaining || 0) / WARNING_DAYS) * 100));
  else if (status.key === "vencido") percentage = 18;

  elements.statusProgress.className = `status-progress ${status.progressClassName}`;
  elements.statusProgressFill.style.width = `${percentage}%`;
  if (elements.statusProgressLabel) elements.statusProgressLabel.textContent = status.label;
  if (elements.statusProgressDetail) elements.statusProgressDetail.textContent = daysRemaining === null ? "Sin fecha de vencimiento" : formatDays(daysRemaining);
}

function determineStatus(explicitStatus, daysRemaining, expirationDate) {
  if (expirationDate && daysRemaining !== null) {
    if (daysRemaining < 0) return statusObject("vencido", "VENCIDO", "status-vencido", "progress-vencido");
    if (daysRemaining <= WARNING_DAYS) return statusObject("por-vencer", "POR VENCER", "status-por-vencer", "progress-por-vencer");
    return statusObject("calibrado", "CALIBRADO", "status-calibrado", "progress-calibrado");
  }
  const normalized = normalize(explicitStatus);
  if (normalized === "vencido") return statusObject("vencido", "VENCIDO", "status-vencido", "progress-vencido");
  if (normalized === "por vencer") return statusObject("por-vencer", "POR VENCER", "status-por-vencer", "progress-por-vencer");
  if (normalized === "calibrado") return statusObject("calibrado", "CALIBRADO", "status-calibrado", "progress-calibrado");
  return statusObject("sin-fecha", "SIN FECHA", "", "progress-sin-fecha");
}

function statusObject(key, label, className, progressClassName) {
  return { key, label, className, progressClassName };
}

function showDashboard(updateUrl = true) {
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.pushState({}, "", url);
  }
  renderDashboard();
  if (elements.dashboard) elements.dashboard.hidden = false;
  hideCard();
  if (elements.messageBox) elements.messageBox.hidden = true;
  if (elements.suggestions) elements.suggestions.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideDashboard() { if (elements.dashboard) elements.dashboard.hidden = true; }
function hideCard() { if (elements.card) elements.card.hidden = true; }

function focusSearch() {
  if (!elements.searchInput) return;
  elements.searchInput.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => elements.searchInput.focus(), 350);
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
}

function applyTheme(theme, save = false) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === "dark";
  if (elements.themeToggleIcon) elements.themeToggleIcon.textContent = dark ? "☀️" : "🌙";
  if (elements.themeToggleText) elements.themeToggleText.textContent = dark ? "Modo claro" : "Modo oscuro";
  if (elements.themeToggleButton) elements.themeToggleButton.setAttribute("aria-label", dark ? "Activar modo claro" : "Activar modo oscuro");
  if (save) localStorage.setItem(THEME_KEY, theme);
}

function parseDate(value) {
  if (!value) return null;
  const cleaned = value.trim();
  const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const local = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (local) return new Date(Number(local[3]), Number(local[2]) - 1, Number(local[1]));
  return null;
}

function calculateDaysRemaining(date) {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / 86400000);
}

function formatDate(date) {
  return date ? new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date) : "—";
}

function formatDays(days) {
  if (days < 0) return `${Math.abs(days)} días vencido`;
  if (days === 0) return "Vence hoy";
  if (days === 1) return "1 día";
  return `${days} días`;
}

function upcomingText(days) {
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Vence en 1 día";
  return `Vence en ${days} días`;
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function showMessage(message) {
  if (!elements.messageBox) return;
  elements.messageBox.textContent = message;
  elements.messageBox.hidden = false;
}

async function copyCurrentLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    if (elements.copyLinkButton) {
      elements.copyLinkButton.textContent = "Enlace copiado";
      setTimeout(() => elements.copyLinkButton.textContent = "Copiar enlace de esta ficha", 1800);
    }
  } catch {
    alert("Copia manualmente la dirección mostrada en el navegador.");
  }
}

window.addEventListener("popstate", () => {
  const id = new URLSearchParams(window.location.search).get("id");
  id ? showEquipmentById(id, false) : showDashboard(false);
});
