const STORAGE_KEY = "kenko-hotabi-v1";
const DEMO_STEPS = 7420;
const WALKING_DISTANCE_FACTOR = 1.25;
const DEFAULT_MAP_CENTER = [36.2, 138.25];

const elements = {
  headerDate: document.querySelector("#headerDate"),
  stepsInput: document.querySelector("#stepsInput"),
  stepLengthInput: document.querySelector("#stepLengthInput"),
  dailyDistance: document.querySelector("#dailyDistanceKm"),
  tripDistance: document.querySelector("#tripCurrentDistanceKm"),
  progressPercent: document.querySelector("#tripProgressPercent"),
  progressBar: document.querySelector(".progress-bar"),
  progressFill: document.querySelector("#progressBarFill"),
  lifeBonus: document.querySelector("#lifeBonusMinutes"),
  completion: document.querySelector("#completionMessage"),
  homeRouteLabel: document.querySelector("#homeRouteLabel"),
  startInput: document.querySelector("#startInput"),
  goalInput: document.querySelector("#goalInput"),
  routeMessage: document.querySelector("#routeMessage"),
  routeDistanceLabel: document.querySelector("#totalDistanceKmLabel"),
  mapStartLabel: document.querySelector("#mapStartLabel"),
  mapGoalLabel: document.querySelector("#mapGoalLabel"),
  mapContainer: document.querySelector("#map"),
  toast: document.querySelector("#toast"),
};

function emptyState() {
  return { settings: { stepLengthM: 0.7 }, route: null, history: {} };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return emptyState();
    return {
      settings: { ...emptyState().settings, ...saved.settings },
      route: saved.route && typeof saved.route === "object" ? saved.route : null,
      history: saved.history && typeof saved.history === "object" ? saved.history : {},
    };
  } catch {
    return emptyState();
  }
}

let state = loadState();
let map;
let routeLayer;
let currentMarker;
let toastTimer;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    showToast("保存できませんでした。ブラウザーの保存領域をご確認ください。");
  }
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todaySteps() {
  return Number(state.history[localDateKey()]?.steps) || 0;
}

function distanceForSteps(steps) {
  return (steps * Number(state.settings.stepLengthM)) / 1000;
}

function totalTripDistance() {
  return Object.values(state.history).reduce((total, record) => {
    const steps = Number(record?.steps);
    return total + (Number.isFinite(steps) && steps > 0 ? distanceForSteps(steps) : 0);
  }, 0);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 2800);
}

function render() {
  const steps = todaySteps();
  const dailyDistance = distanceForSteps(steps);
  const accumulatedDistance = totalTripDistance();
  const goalDistance = Number(state.route?.distanceKm) || 0;
  const progress = goalDistance > 0 ? Math.min(100, (accumulatedDistance / goalDistance) * 100) : 0;

  elements.headerDate.textContent = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).format(new Date());
  elements.stepsInput.value = steps || "";
  elements.stepLengthInput.value = Number(state.settings.stepLengthM).toFixed(2);
  elements.dailyDistance.innerHTML = `${dailyDistance.toFixed(2)} <small>km</small>`;
  elements.tripDistance.innerHTML = `${accumulatedDistance.toFixed(2)} <small>/ ${goalDistance.toFixed(2)} km</small>`;
  elements.progressPercent.textContent = `${Math.floor(progress)}%`;
  elements.progressBar.setAttribute("aria-valuenow", String(Math.floor(progress)));
  elements.progressFill.style.width = `${progress}%`;
  elements.lifeBonus.textContent = `+${Math.floor(steps / 1000)}`;
  elements.completion.classList.toggle("hidden", !(goalDistance > 0 && accumulatedDistance >= goalDistance));

  const routeText = state.route ? `${state.route.start.name} から ${state.route.goal.name} へ` : "旅ルートを設定してください";
  elements.homeRouteLabel.textContent = routeText;
  elements.routeDistanceLabel.textContent = `${goalDistance.toFixed(2)} km`;
  elements.mapStartLabel.textContent = state.route?.start.name || "未設定";
  elements.mapGoalLabel.textContent = state.route?.goal.name || "未設定";
  updateMapCurrentPosition();
  if (state.route) {
    elements.startInput.value = state.route.start.name;
    elements.goalInput.value = state.route.goal.name;
  }
}

function openScreen(name) {
  document.querySelectorAll(".screen").forEach((screen) => {
    const isActive = screen.id === `screen-${name}`;
    screen.hidden = !isActive;
    screen.classList.toggle("active", isActive);
  });
  document.querySelectorAll(".nav-btn").forEach((button) => {
    const isActive = button.dataset.screen === name;
    button.classList.toggle("active", isActive);
    if (isActive) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (name === "map") window.requestAnimationFrame(initializeMap);
  window.location.hash = name;
}

function initializeMap() {
  if (!window.L) {
    elements.mapContainer.innerHTML = '<p class="map-placeholder">地図を読み込めませんでした。インターネット接続をご確認ください。</p>';
    return;
  }
  if (!map) {
    elements.mapContainer.querySelector(".map-placeholder")?.remove();
    map = window.L.map(elements.mapContainer).setView(DEFAULT_MAP_CENTER, 5);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
  }
  window.setTimeout(() => map.invalidateSize(), 0);
  renderMapRoute();
}

function renderMapRoute() {
  if (!map) return;
  if (!state.route) {
    if (routeLayer) routeLayer.remove();
    if (currentMarker) currentMarker.remove();
    routeLayer = null;
    currentMarker = null;
    return;
  }
  const points = [state.route.start, state.route.goal].map((place) => [place.lat, place.lon]);
  if (routeLayer) routeLayer.remove();
  routeLayer = window.L.featureGroup([
    window.L.marker(points[0]).bindPopup(state.route.start.name),
    window.L.marker(points[1]).bindPopup(state.route.goal.name),
    window.L.polyline(points, { color: "#2f7cf6", weight: 4, dashArray: "8 8" }),
  ]).addTo(map);
  map.fitBounds(routeLayer.getBounds().pad(0.25), { maxZoom: 12 });
  updateMapCurrentPosition();
}

function updateMapCurrentPosition() {
  if (!map || !state.route) return;
  const { start, goal, distanceKm } = state.route;
  const progress = distanceKm > 0 ? Math.min(1, totalTripDistance() / distanceKm) : 0;
  const position = [
    start.lat + (goal.lat - start.lat) * progress,
    start.lon + (goal.lon - start.lon) * progress,
  ];

  if (currentMarker) {
    currentMarker.setLatLng(position);
  } else {
    currentMarker = window.L.circleMarker(position, {
      radius: 8,
      color: "#fff",
      weight: 3,
      fillColor: "#d76c50",
      fillOpacity: 1,
    }).addTo(map).bindTooltip("現在位置（累計歩数に基づく概算）");
  }
}

async function geocode(placeName) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "jp", q: placeName });
  const response = await fetch(url, { headers: { "Accept-Language": "ja" } });
  if (!response.ok) throw new Error("住所検索サービスに接続できませんでした。");
  const results = await response.json();
  if (!results.length) throw new Error(`「${placeName}」が見つかりませんでした。地名を確認してください。`);
  return { name: placeName, lat: Number(results[0].lat), lon: Number(results[0].lon) };
}

function estimateWalkingDistanceKm(start, goal) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const latDelta = radians(goal.lat - start.lat);
  const lonDelta = radians(goal.lon - start.lon);
  const startLatitude = radians(start.lat);
  const goalLatitude = radians(goal.lat);
  const haversine = Math.sin(latDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(goalLatitude) * Math.sin(lonDelta / 2) ** 2;
  const straightLineKm = 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return straightLineKm * WALKING_DISTANCE_FACTOR;
}

function validSteps(rawValue) {
  const steps = Number(rawValue);
  return Number.isInteger(steps) && steps >= 0 && steps <= 100000;
}

document.querySelectorAll(".nav-btn").forEach((button) => {
  button.addEventListener("click", () => openScreen(button.dataset.screen));
});
document.querySelector("[data-open-settings]").addEventListener("click", (event) => {
  event.preventDefault();
  openScreen("settings");
});

document.querySelector("#btnApplySteps").addEventListener("click", () => {
  if (!validSteps(elements.stepsInput.value)) {
    showToast("0〜100,000の整数で入力してください。");
    elements.stepsInput.focus();
    return;
  }
  state.history[localDateKey()] = { steps: Number(elements.stepsInput.value) };
  saveState();
  render();
  showToast("今日の歩数を記録しました。");
});

document.querySelector("#btnMockAutoSteps").addEventListener("click", () => {
  elements.stepsInput.value = DEMO_STEPS;
  state.history[localDateKey()] = { steps: DEMO_STEPS };
  saveState();
  render();
  showToast("デモ歩数 7,420歩 を記録しました。");
});

document.querySelector("#btnSaveSettings").addEventListener("click", () => {
  const stepLength = Number(elements.stepLengthInput.value);
  if (!Number.isFinite(stepLength) || stepLength < 0.3 || stepLength > 1.5) {
    showToast("歩幅は0.30〜1.50mの範囲で入力してください。");
    elements.stepLengthInput.focus();
    return;
  }
  state.settings.stepLengthM = stepLength;
  saveState();
  render();
  showToast("歩幅を保存し、距離を更新しました。");
});

document.querySelector("#btnCalcRoute").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const startName = elements.startInput.value.trim();
  const goalName = elements.goalInput.value.trim();
  elements.routeMessage.textContent = "";
  elements.routeMessage.classList.remove("success");
  if (!startName || !goalName) {
    elements.routeMessage.textContent = "出発地点と到着地点を入力してください。";
    return;
  }
  button.disabled = true;
  button.textContent = "検索しています...";
  try {
    const start = await geocode(startName);
    const goal = await geocode(goalName);
    const distanceKm = estimateWalkingDistanceKm(start, goal);
    state.route = { start, goal, distanceKm, createdOn: localDateKey() };
    saveState();
    render();
    elements.routeMessage.textContent = "概算距離を設定しました。地図で位置関係を確認できます。";
    elements.routeMessage.classList.add("success");
    renderMapRoute();
  } catch (error) {
    elements.routeMessage.textContent = error instanceof Error ? error.message : "ルートを計算できませんでした。";
  } finally {
    button.disabled = false;
    button.textContent = "ルート距離を計算";
  }
});

render();
const initialScreen = ["home", "map", "settings"].includes(window.location.hash.slice(1))
  ? window.location.hash.slice(1)
  : "home";
openScreen(initialScreen);