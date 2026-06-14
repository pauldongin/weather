import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";

const els = {
  canvas: document.querySelector("#weatherCanvas"),
  photoLayer: document.querySelector("#photoLayer"),
  placeName: document.querySelector("#placeName"),
  conditionBadge: document.querySelector("#conditionBadge"),
  tempValue: document.querySelector("#tempValue"),
  feelsValue: document.querySelector("#feelsValue"),
  windValue: document.querySelector("#windValue"),
  humidityValue: document.querySelector("#humidityValue"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  locateButton: document.querySelector("#locateButton"),
  refreshButton: document.querySelector("#refreshButton"),
  landmarkScroller: document.querySelector("#landmarkScroller"),
  photoCredit: document.querySelector("#photoCredit"),
  statusToast: document.querySelector("#statusToast")
};

const famousLandmarks = [
  { name: "Eiffel Tower", place: "Paris, France", lat: 48.8584, lon: 2.2945, wikiTitle: "Eiffel Tower", query: "Eiffel Tower Paris photograph city skyline" },
  { name: "Statue of Liberty", place: "New York, United States", lat: 40.6892, lon: -74.0445, wikiTitle: "Statue of Liberty", query: "Statue of Liberty New York Harbor photograph" },
  { name: "Golden Gate Bridge", place: "San Francisco, United States", lat: 37.8199, lon: -122.4783, wikiTitle: "Golden Gate Bridge", query: "Golden Gate Bridge San Francisco photograph" },
  { name: "Gyeongbokgung", place: "Seoul, South Korea", lat: 37.5796, lon: 126.977, wikiTitle: "Gyeongbokgung", query: "Gyeongbokgung Palace Seoul photograph" },
  { name: "Burj Khalifa", place: "Dubai, United Arab Emirates", lat: 25.1972, lon: 55.2744, wikiTitle: "Burj Khalifa", query: "Burj Khalifa Dubai skyline photograph" },
  { name: "Sydney Opera House", place: "Sydney, Australia", lat: -33.8568, lon: 151.2153, wikiTitle: "Sydney Opera House", query: "Sydney Opera House harbour photograph" },
  { name: "Colosseum", place: "Rome, Italy", lat: 41.8902, lon: 12.4922, wikiTitle: "Colosseum", query: "Colosseum Rome photograph" },
  { name: "Taj Mahal", place: "Agra, India", lat: 27.1751, lon: 78.0421, wikiTitle: "Taj Mahal", query: "Taj Mahal Agra photograph" },
  { name: "Machu Picchu", place: "Cusco Region, Peru", lat: -13.1631, lon: -72.545, wikiTitle: "Machu Picchu", query: "Machu Picchu Peru photograph" },
  { name: "Big Ben", place: "London, United Kingdom", lat: 51.5007, lon: -0.1246, wikiTitle: "Big Ben", query: "Big Ben London Westminster photograph" },
  { name: "Christ the Redeemer", place: "Rio de Janeiro, Brazil", lat: -22.9519, lon: -43.2105, wikiTitle: "Christ the Redeemer (statue)", query: "Christ the Redeemer Rio de Janeiro photograph" },
  { name: "Petra", place: "Petra, Jordan", lat: 30.3285, lon: 35.4444, wikiTitle: "Petra", query: "Petra Treasury Jordan photograph" },
  { name: "Sagrada Familia", place: "Barcelona, Spain", lat: 41.4036, lon: 2.1744, wikiTitle: "Sagrada Familia", query: "Sagrada Familia Barcelona photograph" },
  { name: "Mount Fuji", place: "Yamanashi, Japan", lat: 35.3606, lon: 138.7274, wikiTitle: "Mount Fuji", query: "Mount Fuji Japan photograph" },
  { name: "Great Wall", place: "Beijing, China", lat: 40.4319, lon: 116.5704, wikiTitle: "Great Wall of China", query: "Great Wall of China photograph" },
  { name: "Marina Bay Sands", place: "Singapore", lat: 1.2834, lon: 103.8607, wikiTitle: "Marina Bay Sands", query: "Marina Bay Sands Singapore skyline photograph" }
];

let activeLandmarkName = "";
let currentLocation = null;
let currentWeather = null;
let activePhotoRequest = 0;
let toastTimer = 0;

const sceneState = {
  scene: null,
  camera: null,
  renderer: null,
  clock: new THREE.Clock(),
  skyline: null,
  weatherGroup: null,
  rain: null,
  snow: null,
  clouds: [],
  sun: null,
  lightning: null,
  lightningCooldown: 0,
  pointerX: 0,
  pointerY: 0,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
};

init();

function init() {
  initScene();
  renderLandmarkChips();
  bindEvents();
  refreshIcons();
  showStatus("Requesting current location");
  locateCurrentPosition().catch(() => {
    showStatus("Location unavailable. Showing Paris as a live demo.");
    selectLandmark(famousLandmarks[0]);
  });
}

function bindEvents() {
  els.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = els.searchInput.value.trim();
    if (query) {
      searchPlace(query);
    }
  });

  els.locateButton.addEventListener("click", () => {
    activeLandmarkName = "";
    updateActiveChip();
    locateCurrentPosition().catch((error) => {
      showStatus(error.message || "Could not read your current location.");
    });
  });

  els.refreshButton.addEventListener("click", () => {
    if (currentLocation) {
      loadWeatherLocation(currentLocation, { keepPhotoQuery: false });
    }
  });

  window.addEventListener("pointermove", (event) => {
    const x = event.clientX / Math.max(1, window.innerWidth) - 0.5;
    const y = event.clientY / Math.max(1, window.innerHeight) - 0.5;
    sceneState.pointerX = x;
    sceneState.pointerY = y;
    document.documentElement.style.setProperty("--photo-x", `${(-x * 16).toFixed(2)}px`);
    document.documentElement.style.setProperty("--photo-y", `${(-y * 12).toFixed(2)}px`);
  });

  window.addEventListener("load", refreshIcons);
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderLandmarkChips() {
  els.landmarkScroller.replaceChildren();
  for (const landmark of famousLandmarks) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "landmark-chip";
    chip.textContent = landmark.name;
    chip.title = `${landmark.name}, ${landmark.place}`;
    chip.addEventListener("click", () => selectLandmark(landmark));
    els.landmarkScroller.append(chip);
  }
}

function updateActiveChip() {
  for (const chip of els.landmarkScroller.querySelectorAll(".landmark-chip")) {
    chip.classList.toggle("active", chip.textContent === activeLandmarkName);
  }
}

async function selectLandmark(landmark) {
  activeLandmarkName = landmark.name;
  updateActiveChip();
  await loadWeatherLocation({
    label: landmark.place,
    photoLabel: landmark.name,
    photoQuery: landmark.query,
    wikiTitle: landmark.wikiTitle,
    lat: landmark.lat,
    lon: landmark.lon
  });
}

async function locateCurrentPosition() {
  if (!("geolocation" in navigator)) {
    throw new Error("This browser does not expose geolocation.");
  }

  setLoading(true);
  const position = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 300000,
      timeout: 14000
    });
  });

  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const place = await reverseGeocode(lat, lon).catch(() => null);
  const label = place?.label || `Current location ${lat.toFixed(2)}, ${lon.toFixed(2)}`;
  const photoLabel = place?.city || place?.state || label;
  await loadWeatherLocation({
    label,
    photoLabel,
    photoQuery: `${photoLabel} ${place?.country || ""} landmark skyline photograph`,
    lat,
    lon
  });
}

async function searchPlace(rawQuery) {
  const query = rawQuery.toLowerCase();
  const directLandmark = famousLandmarks.find((landmark) => {
    return landmark.name.toLowerCase().includes(query) || landmark.place.toLowerCase().includes(query);
  });

  if (directLandmark) {
    await selectLandmark(directLandmark);
    return;
  }

  setLoading(true);
  showStatus("Searching city weather");

  try {
    const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
    url.search = new URLSearchParams({
      name: rawQuery,
      count: "1",
      language: "en",
      format: "json"
    });

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("City search failed.");
    }

    const data = await response.json();
    const place = data.results?.[0];
    if (!place) {
      await applyPhotoFromCommons(`${rawQuery} landmark photograph`);
      showStatus("No city weather match. Updated the landmark photo only.");
      return;
    }

    const label = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
    activeLandmarkName = "";
    updateActiveChip();
    await loadWeatherLocation({
      label,
      photoLabel: place.name,
      photoQuery: `${place.name} ${place.country} landmark skyline photograph`,
      lat: place.latitude,
      lon: place.longitude
    });
  } catch (error) {
    showStatus(error.message || "Search failed.");
  } finally {
    setLoading(false);
  }
}

async function loadWeatherLocation(location, options = {}) {
  currentLocation = location;
  const photoRequestId = ++activePhotoRequest;
  markPhotoLoading(location.photoLabel || location.label);
  setLoading(true);
  showStatus(`Loading ${location.photoLabel || location.label}`);

  try {
    const weather = await fetchWeather(location.lat, location.lon);
    currentWeather = weather;
    updateWeatherPanel(location.label, weather);
    updateSceneWeather(weather.condition.type, weather);
    await applyPhotoForLocation(location, options, photoRequestId);
    showStatus(`${weather.condition.label} in ${location.label}`, 2600);
  } catch (error) {
    showStatus(error.message || "Weather load failed.");
  } finally {
    setLoading(false);
  }
}

async function applyPhotoForLocation(location, options = {}, requestId = ++activePhotoRequest) {
  if (location.wikiTitle) {
    try {
      const photo = await fetchWikipediaPagePhoto(location.wikiTitle);
      if (requestId !== activePhotoRequest) return;
      await applyPhoto(photo);
      return;
    } catch {
      // Fall through to the Commons search query for alternate photos.
    }
  }

  const query = options.keepPhotoQuery ? location.photoLabel : location.photoQuery;
  await applyPhotoFromCommons(query || `${location.label} landmark photograph`, requestId);
}

async function fetchWeather(lat, lon) {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lon.toFixed(5),
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "precipitation",
      "rain",
      "showers",
      "snowfall",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "is_day"
    ].join(","),
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto"
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Weather request failed.");
  }

  const data = await response.json();
  const current = data.current;
  if (!current) {
    throw new Error("Weather data was empty.");
  }

  return {
    raw: current,
    timezone: data.timezone,
    temperature: current.temperature_2m,
    apparent: current.apparent_temperature,
    wind: current.wind_speed_10m,
    humidity: current.relative_humidity_2m,
    cloudCover: current.cloud_cover,
    precipitation: current.precipitation,
    isDay: current.is_day === 1,
    condition: conditionFromCode(current.weather_code, current.is_day === 1)
  };
}

async function reverseGeocode(lat, lon) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    zoom: "10",
    addressdetails: "1",
    "accept-language": "en"
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Place lookup failed.");
  }

  const data = await response.json();
  const address = data.address || {};
  const city = address.city || address.town || address.village || address.hamlet || address.county;
  const state = address.state || address.region;
  const country = address.country;
  const label = [city, state, country].filter(Boolean).join(", ") || data.display_name;
  return { city, state, country, label };
}

function updateWeatherPanel(label, weather) {
  els.placeName.textContent = label;
  els.conditionBadge.textContent = weather.condition.label;
  els.tempValue.textContent = formatTemp(weather.temperature);
  els.feelsValue.textContent = formatTemp(weather.apparent);
  els.windValue.textContent = `${Math.round(weather.wind)} mph`;
  els.humidityValue.textContent = `${Math.round(weather.humidity)}%`;
  document.body.dataset.theme = weather.condition.type;
  document.body.classList.toggle("is-night", !weather.isDay);
}

function conditionFromCode(code, isDay) {
  const numeric = Number(code);
  if (numeric === 0) return { label: isDay ? "Clear" : "Clear night", type: "clear" };
  if ([1, 2].includes(numeric)) return { label: "Partly cloudy", type: "cloud" };
  if (numeric === 3) return { label: "Overcast", type: "cloud" };
  if ([45, 48].includes(numeric)) return { label: "Fog", type: "fog" };
  if ([51, 53, 55, 56, 57].includes(numeric)) return { label: "Drizzle", type: "rain" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(numeric)) return { label: "Rain", type: "rain" };
  if ([71, 73, 75, 77, 85, 86].includes(numeric)) return { label: "Snow", type: "snow" };
  if ([95, 96, 99].includes(numeric)) return { label: "Storm", type: "storm" };
  return { label: "Clouds", type: "cloud" };
}

function formatTemp(value) {
  if (!Number.isFinite(value)) return "--";
  return `${Math.round(value)} F`;
}

async function applyPhotoFromCommons(searchTerm, requestId = ++activePhotoRequest) {
  try {
    const photo = await fetchCommonsPhoto(searchTerm);
    if (requestId !== activePhotoRequest) return;
    await applyPhoto(photo);
  } catch {
    if (requestId !== activePhotoRequest) return;
    applyFallbackPhoto(searchTerm);
  }
}

async function fetchCommonsPhoto(searchTerm) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    origin: "*",
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "14",
    gsrsearch: searchTerm,
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1800",
    iiextmetadatafilter: "Artist|Credit|LicenseShortName|UsageTerms|LicenseUrl|ObjectName|ImageDescription",
    iilimit: "1"
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Photo search failed.");
  }

  const data = await response.json();
  const pages = data.query?.pages || [];
  const candidates = pages
    .map((page) => normalizeCommonsPage(page))
    .filter(Boolean)
    .filter((photo) => photo.mime === "image/jpeg" || photo.mime === "image/png" || photo.mime === "image/webp")
    .filter((photo) => photo.width >= 900 && photo.height >= 500)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    throw new Error("No usable landmark photo found.");
  }

  return candidates[0];
}

async function fetchWikipediaPagePhoto(wikiTitle) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    origin: "*",
    action: "query",
    format: "json",
    formatversion: "2",
    titles: wikiTitle,
    prop: "pageimages",
    piprop: "name|original",
    pithumbsize: "1800"
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Wikipedia image lookup failed.");
  }

  const data = await response.json();
  const page = data.query?.pages?.[0];
  if (!page?.pageimage) {
    throw new Error("No page image found.");
  }

  return fetchCommonsFilePhoto(`File:${page.pageimage}`);
}

async function fetchCommonsFilePhoto(fileTitle) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    origin: "*",
    action: "query",
    format: "json",
    formatversion: "2",
    titles: fileTitle,
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1800",
    iiextmetadatafilter: "Artist|Credit|LicenseShortName|UsageTerms|LicenseUrl|ObjectName|ImageDescription",
    iilimit: "1"
  });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Commons file lookup failed.");
  }

  const data = await response.json();
  const page = data.query?.pages?.[0];
  const photo = normalizeCommonsPage(page);
  if (!photo) {
    throw new Error("Commons file metadata was empty.");
  }
  return photo;
}

function normalizeCommonsPage(page) {
  const info = page.imageinfo?.[0];
  if (!info) return null;
  const width = Number(info.thumbwidth || info.width || 0);
  const height = Number(info.thumbheight || info.height || 0);
  const title = page.title?.replace(/^File:/, "") || "Wikimedia Commons image";
  const aspect = width / Math.max(1, height);
  const panoramicBonus = aspect > 1.35 && aspect < 2.9 ? 300 : 0;
  const sizeScore = Math.min(width, 2560) + Math.min(height, 1600) + panoramicBonus;
  const meta = info.extmetadata || {};

  return {
    title,
    url: info.thumburl || info.url,
    sourceUrl: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    mime: info.mime,
    width,
    height,
    score: sizeScore,
    artist: cleanMetadata(meta.Artist?.value || meta.Credit?.value),
    license: cleanMetadata(meta.LicenseShortName?.value || meta.UsageTerms?.value),
    licenseUrl: cleanMetadata(meta.LicenseUrl?.value)
  };
}

async function applyPhoto(photo) {
  els.photoLayer.dataset.photoState = "loading";
  await preloadImage(photo.url);
  const escapedUrl = photo.url.replace(/"/g, "%22");
  els.photoLayer.style.backgroundImage = [
    "linear-gradient(135deg, rgba(13, 18, 25, 0.22), rgba(28, 45, 51, 0.08))",
    `url("${escapedUrl}")`
  ].join(", ");

  const artist = photo.artist ? ` by ${escapeHtml(trimText(photo.artist, 70))}` : "";
  const license = photo.license ? ` · ${escapeHtml(trimText(photo.license, 38))}` : "";
  els.photoCredit.innerHTML = `Photo: <a href="${escapeAttribute(photo.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(trimText(photo.title, 72))}</a>${artist}${license}`;
  els.photoLayer.dataset.photoState = "loaded";
}

function applyFallbackPhoto(searchTerm) {
  els.photoLayer.style.backgroundImage = "";
  els.photoCredit.textContent = `No Commons photo match for ${trimText(searchTerm, 62)}`;
  els.photoLayer.dataset.photoState = "fallback";
}

function markPhotoLoading(label) {
  els.photoLayer.dataset.photoState = "loading";
  els.photoCredit.textContent = `Photo loading for ${trimText(label, 54)}`;
}

function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Photo could not be loaded."));
    image.src = url;
  });
}

function cleanMetadata(value = "") {
  const container = document.createElement("div");
  container.innerHTML = value;
  return container.textContent.replace(/\s+/g, " ").trim();
}

function trimText(value, maxLength) {
  if (!value || value.length <= maxLength) return value || "";
  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function showStatus(message, duration = 3600) {
  window.clearTimeout(toastTimer);
  els.statusToast.textContent = message;
  els.statusToast.classList.add("visible");
  toastTimer = window.setTimeout(() => {
    els.statusToast.classList.remove("visible");
  }, duration);
}

function setLoading(isLoading) {
  els.locateButton.disabled = isLoading;
  els.refreshButton.disabled = isLoading || !currentLocation;
  els.searchInput.disabled = isLoading;
}

function initScene() {
  const canvas = els.canvas;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b1118, 0.018);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 120);
  camera.position.set(0, 3.2, 18);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance"
  });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const ambient = new THREE.AmbientLight(0xbcd7ff, 1.2);
  const key = new THREE.DirectionalLight(0xffd99a, 2.2);
  key.position.set(6, 10, 8);
  const back = new THREE.DirectionalLight(0x72e0c6, 1.0);
  back.position.set(-8, 4, -5);
  scene.add(ambient, key, back);

  const weatherGroup = new THREE.Group();
  scene.add(weatherGroup);

  const skyline = createSkyline();
  scene.add(skyline);

  sceneState.scene = scene;
  sceneState.camera = camera;
  sceneState.renderer = renderer;
  sceneState.skyline = skyline;
  sceneState.weatherGroup = weatherGroup;
  sceneState.lights = { ambient, key, back };

  window.addEventListener("resize", resizeScene);
  updateSceneWeather("cloud", { isDay: true, cloudCover: 60 });
  renderer.setAnimationLoop(animateScene);
}

function createSkyline() {
  return new THREE.Group();
}

function updateSceneWeather(type, weather = {}) {
  clearWeatherObjects();
  const { ambient, key, back } = sceneState.lights;
  const isNight = weather.isDay === false;
  sceneState.scene.fog = new THREE.FogExp2(isNight ? 0x050711 : 0x0b1118, 0.014);
  ambient.intensity = isNight ? 0.58 : 1.18;
  key.intensity = isNight ? 0.75 : 2.2;
  back.intensity = isNight ? 0.55 : 1.0;

  if (type === "clear") {
    return;
  } else if (type === "cloud") {
    createClouds(7, 0.42);
  } else if (type === "rain") {
    createClouds(8, 0.52);
    createRain(940);
    sceneState.scene.fog.density = 0.026;
  } else if (type === "snow") {
    createClouds(6, 0.46);
    createSnow(760);
    sceneState.scene.fog.density = 0.024;
  } else if (type === "fog") {
    createClouds(9, 0.68);
    createMistBands();
    sceneState.scene.fog.density = 0.052;
  } else if (type === "storm") {
    createClouds(10, 0.64);
    createRain(1250);
    createLightning();
    sceneState.scene.fog.density = 0.034;
    ambient.intensity = 0.46;
    key.intensity = 0.9;
  }
}

function clearWeatherObjects() {
  if (!sceneState.weatherGroup) return;
  for (const child of [...sceneState.weatherGroup.children]) {
    sceneState.weatherGroup.remove(child);
    disposeObject(child);
  }
  sceneState.rain = null;
  sceneState.snow = null;
  sceneState.clouds = [];
  sceneState.sun = null;
  sceneState.lightning = null;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((mat) => mat.dispose());
      else child.material.dispose();
    }
  });
}

function createSun(isNight) {
  const material = new THREE.MeshBasicMaterial({
    color: isNight ? 0xd7e3ff : 0xffd86f,
    transparent: true,
    opacity: isNight ? 0.52 : 0.78
  });
  const sun = new THREE.Mesh(new THREE.SphereGeometry(isNight ? 0.44 : 0.68, 32, 32), material);
  sun.position.set(8.6, 6.2, -9);
  sceneState.weatherGroup.add(sun);
  sceneState.sun = sun;
}

function createClouds(count, opacity) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xe4edf3,
    transparent: true,
    opacity,
    depthWrite: false
  });

  for (let i = 0; i < count; i += 1) {
    const cloud = new THREE.Group();
    const puffs = 4 + (i % 3);
    for (let p = 0; p < puffs; p += 1) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.72 + p * 0.08, 16, 12), material);
      sphere.scale.set(1.5 + p * 0.15, 0.55 + (p % 2) * 0.2, 0.6);
      sphere.position.set(p * 0.74, Math.sin(p) * 0.16, 0);
      cloud.add(sphere);
    }
    cloud.position.set(-16 + i * 4.8, 3.8 + (i % 3) * 0.72, -7 - (i % 4));
    cloud.userData.speed = 0.16 + (i % 4) * 0.035;
    sceneState.weatherGroup.add(cloud);
    sceneState.clouds.push(cloud);
  }
}

function createRain(count) {
  const positions = new Float32Array(count * 6);
  for (let i = 0; i < count; i += 1) {
    const idx = i * 6;
    const x = randomRange(-18, 18);
    const y = randomRange(-4.2, 9.5);
    const z = randomRange(-10, 8);
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;
    positions[idx + 3] = x + 0.16;
    positions[idx + 4] = y - 0.85;
    positions[idx + 5] = z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xbceeff,
    transparent: true,
    opacity: 0.52
  });
  const rain = new THREE.LineSegments(geometry, material);
  rain.userData.speed = 9.5;
  sceneState.weatherGroup.add(rain);
  sceneState.rain = rain;
}

function createSnow(count) {
  const positions = new Float32Array(count * 3);
  const drift = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    const idx = i * 3;
    positions[idx] = randomRange(-18, 18);
    positions[idx + 1] = randomRange(-4.4, 9.5);
    positions[idx + 2] = randomRange(-10, 8);
    drift[i] = randomRange(0.4, 1.8);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.055,
    transparent: true,
    opacity: 0.86,
    depthWrite: false
  });
  const snow = new THREE.Points(geometry, material);
  snow.userData.drift = drift;
  sceneState.weatherGroup.add(snow);
  sceneState.snow = snow;
}

function createMistBands() {
  const material = new THREE.MeshBasicMaterial({
    color: 0xdfe7e2,
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  });
  for (let i = 0; i < 8; i += 1) {
    const band = new THREE.Mesh(new THREE.PlaneGeometry(24, 1.8), material);
    band.position.set(randomRange(-4, 4), -0.3 + i * 0.55, -4.5 - i * 0.8);
    band.rotation.y = randomRange(-0.12, 0.12);
    band.userData.speed = randomRange(0.08, 0.18);
    sceneState.weatherGroup.add(band);
    sceneState.clouds.push(band);
  }
}

function createLightning() {
  const light = new THREE.PointLight(0xeef6ff, 0, 80);
  light.position.set(0, 8, -6);
  sceneState.weatherGroup.add(light);
  sceneState.lightning = light;
  sceneState.lightningCooldown = 1.4;
}

function resizeScene() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  sceneState.camera.aspect = width / Math.max(1, height);
  sceneState.camera.updateProjectionMatrix();
  sceneState.renderer.setSize(width, height);
}

function animateScene() {
  const delta = Math.min(sceneState.clock.getDelta(), 0.05);
  const elapsed = sceneState.clock.elapsedTime;
  const motionDelta = sceneState.reducedMotion ? delta * 0.25 : delta;

  if (sceneState.skyline) {
    sceneState.skyline.rotation.y += ((sceneState.pointerX * 0.055) - sceneState.skyline.rotation.y) * 0.06;
    sceneState.skyline.rotation.x += ((-sceneState.pointerY * 0.025) - sceneState.skyline.rotation.x) * 0.06;
  }

  if (sceneState.sun) {
    sceneState.sun.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.04);
  }

  animateClouds(motionDelta);
  animateRain(motionDelta);
  animateSnow(motionDelta, elapsed);
  animateLightning(motionDelta);

  sceneState.renderer.render(sceneState.scene, sceneState.camera);
}

function animateClouds(delta) {
  for (const cloud of sceneState.clouds) {
    cloud.position.x += cloud.userData.speed * delta;
    if (cloud.position.x > 18) cloud.position.x = -18;
  }
}

function animateRain(delta) {
  if (!sceneState.rain) return;
  const attr = sceneState.rain.geometry.attributes.position;
  const positions = attr.array;
  const speed = sceneState.rain.userData.speed * delta;
  for (let i = 0; i < positions.length; i += 6) {
    positions[i + 1] -= speed;
    positions[i + 4] -= speed;
    if (positions[i + 1] < -5.6) {
      const y = randomRange(6.5, 9.5);
      const x = randomRange(-18, 18);
      const z = randomRange(-10, 8);
      positions[i] = x;
      positions[i + 1] = y;
      positions[i + 2] = z;
      positions[i + 3] = x + 0.16;
      positions[i + 4] = y - 0.85;
      positions[i + 5] = z;
    }
  }
  attr.needsUpdate = true;
}

function animateSnow(delta, elapsed) {
  if (!sceneState.snow) return;
  const attr = sceneState.snow.geometry.attributes.position;
  const positions = attr.array;
  const drift = sceneState.snow.userData.drift;
  for (let i = 0; i < positions.length; i += 3) {
    const particle = i / 3;
    positions[i + 1] -= delta * (0.55 + drift[particle] * 0.28);
    positions[i] += Math.sin(elapsed * drift[particle] + particle) * delta * 0.18;
    if (positions[i + 1] < -4.9) {
      positions[i] = randomRange(-18, 18);
      positions[i + 1] = randomRange(6.5, 9.8);
      positions[i + 2] = randomRange(-10, 8);
    }
  }
  attr.needsUpdate = true;
}

function animateLightning(delta) {
  if (!sceneState.lightning) return;
  sceneState.lightningCooldown -= delta;
  if (sceneState.lightningCooldown <= 0) {
    sceneState.lightning.intensity = 7.5;
    sceneState.lightningCooldown = randomRange(3.2, 7.5);
  } else {
    sceneState.lightning.intensity *= 0.82;
  }
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
