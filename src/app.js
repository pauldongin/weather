const els = {
  photoLayer: document.querySelector("#photoLayer"),
  photoLayerNext: document.querySelector("#photoLayerNext"),
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
let photoTransitionTimer = 0;

// Lightweight 2D canvas engine that composites animated weather (rain, snow,
// drifting clouds, fog, sun/stars, lightning) on top of the landmark photo.
const fx = {
  canvas: null,
  ctx: null,
  raf: 0,
  lastTime: 0,
  width: 0,
  height: 0,
  dpr: 1,
  type: "",
  isDay: true,
  drops: [],
  flakes: [],
  clouds: [],
  mist: [],
  stars: [],
  motes: [],
  flash: 0,
  flashCooldown: 4,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
};

init();

function init() {
  setupWeatherCanvas();
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
    setWeatherEffect(getWeatherVisualType(weather), weather);
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
  document.body.dataset.theme = getWeatherVisualType(weather);
  document.body.classList.toggle("is-night", !weather.isDay);
}

function getWeatherVisualType(weather) {
  const severeCondition = ["rain", "storm", "snow"].includes(weather.condition.type);
  if (!severeCondition && weather.wind >= 20) return "wind";
  if (!weather.isDay && weather.condition.type === "clear") return "night";
  return weather.condition.type;
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

async function applyPhoto(photo, requestId = activePhotoRequest) {
  els.photoLayer.dataset.photoState = "loading";
  await preloadImage(photo.url);
  if (requestId !== activePhotoRequest) return;
  const escapedUrl = photo.url.replace(/"/g, "%22");
  const backgroundImage = [
    "linear-gradient(135deg, rgba(13, 18, 25, 0.22), rgba(28, 45, 51, 0.08))",
    `url("${escapedUrl}")`
  ].join(", ");

  window.clearTimeout(photoTransitionTimer);
  els.photoLayerNext.style.backgroundImage = backgroundImage;
  // Force the browser to commit the new image before starting the crossfade.
  void els.photoLayerNext.offsetWidth;
  els.photoLayerNext.style.opacity = "1";

  photoTransitionTimer = window.setTimeout(() => {
    els.photoLayer.style.backgroundImage = backgroundImage;
    els.photoLayerNext.style.opacity = "0";
  }, 900);

  const artist = photo.artist ? ` by ${escapeHtml(trimText(photo.artist, 70))}` : "";
  const license = photo.license ? ` · ${escapeHtml(trimText(photo.license, 38))}` : "";
  els.photoCredit.innerHTML = `Photo: <a href="${escapeAttribute(photo.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(trimText(photo.title, 72))}</a>${artist}${license}`;
  els.photoLayer.dataset.photoState = "loaded";
}

function applyFallbackPhoto(searchTerm) {
  window.clearTimeout(photoTransitionTimer);
  els.photoLayerNext.style.opacity = "0";
  els.photoLayerNext.style.backgroundImage = "";
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


/* --------------------------------------------------------------------------
 * Weather effects engine
 * A lightweight 2D canvas that layers animated weather (rain, snow, drifting
 * clouds, fog, sun/stars, lightning) over the landmark photo so the scene and
 * the weather read as one composited image.
 * ----------------------------------------------------------------------- */

function setupWeatherCanvas() {
  const canvas = document.querySelector("#weatherCanvas");
  if (!canvas) return;
  fx.canvas = canvas;
  fx.ctx = canvas.getContext("2d");
  resizeWeatherCanvas();
  window.addEventListener("resize", resizeWeatherCanvas);
  fx.lastTime = performance.now();
  fx.raf = requestAnimationFrame(stepWeather);
}

function resizeWeatherCanvas() {
  if (!fx.canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fx.dpr = dpr;
  fx.width = window.innerWidth;
  fx.height = window.innerHeight;
  fx.canvas.width = Math.round(fx.width * dpr);
  fx.canvas.height = Math.round(fx.height * dpr);
  fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (fx.type) seedWeather(fx.type);
}

function setWeatherEffect(type, weather = {}) {
  fx.type = type;
  fx.isDay = weather.isDay !== false;
  seedWeather(type);
}

function seedWeather(type) {
  const w = fx.width;
  const h = fx.height;
  const mobile = w <= 760;
  fx.drops = [];
  fx.flakes = [];
  fx.clouds = [];
  fx.mist = [];
  fx.stars = [];
  fx.motes = [];

  if (type === "rain" || type === "storm") {
    const heavy = type === "storm";
    const count = Math.min(1400, Math.round(w * (mobile ? 0.6 : 0.85) * (heavy ? 1.25 : 1)));
    for (let i = 0; i < count; i += 1) fx.drops.push(makeDrop(w, h, heavy));
  }

  if (type === "snow") {
    const count = Math.min(700, Math.round(w * (mobile ? 0.25 : 0.4)));
    for (let i = 0; i < count; i += 1) fx.flakes.push(makeFlake(w, h));
  }

  if (type === "wind") {
    const count = mobile ? 38 : 64;
    for (let i = 0; i < count; i += 1) fx.drops.push(makeStreak(w, h));
  }

  if (type === "cloud" || type === "rain" || type === "storm") {
    const count = mobile ? 4 : 7;
    for (let i = 0; i < count; i += 1) fx.clouds.push(makeCloud(w, h, i, count));
  }

  if (type === "fog") {
    const bands = mobile ? 5 : 8;
    for (let i = 0; i < bands; i += 1) fx.mist.push(makeMist(w, h, i, bands));
  }

  if (!fx.isDay && (type === "clear" || type === "night" || type === "cloud")) {
    const count = Math.round(w * (mobile ? 0.12 : 0.18));
    for (let i = 0; i < count; i += 1) fx.stars.push(makeStar(w, h));
  }

  if (fx.isDay && type === "clear") {
    const count = mobile ? 16 : 28;
    for (let i = 0; i < count; i += 1) fx.motes.push(makeMote(w, h));
  }

  if (type === "storm") {
    fx.flash = 0;
    fx.flashCooldown = randomRange(1.2, 3.4);
  }
}

function makeDrop(w, h, heavy) {
  return {
    x: Math.random() * (w + 200) - 100,
    y: Math.random() * h - h,
    len: randomRange(heavy ? 16 : 10, heavy ? 30 : 20),
    speed: randomRange(heavy ? 900 : 640, heavy ? 1500 : 1040),
    slant: heavy ? 2.4 : 1.5,
    alpha: randomRange(0.22, 0.55)
  };
}

function makeStreak(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    len: randomRange(40, 130),
    speed: randomRange(300, 640),
    alpha: randomRange(0.04, 0.14)
  };
}

function makeFlake(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h - h,
    r: randomRange(1.2, 3.6),
    speed: randomRange(38, 92),
    drift: randomRange(0.5, 1.7),
    phase: Math.random() * Math.PI * 2,
    alpha: randomRange(0.5, 0.95)
  };
}

function makeCloud(w, h, i, count) {
  return {
    x: (i / count) * (w + 420) - 210 + randomRange(-60, 60),
    y: randomRange(h * 0.02, h * 0.3),
    scale: randomRange(0.7, 1.5),
    speed: randomRange(6, 16),
    alpha: randomRange(0.12, 0.3)
  };
}

function makeMist(w, h, i, bands) {
  return {
    x: randomRange(-w * 0.4, 0),
    y: (i / bands) * h * 0.92 + h * 0.04,
    band: randomRange(h * 0.08, h * 0.2),
    speed: randomRange(8, 24),
    alpha: randomRange(0.06, 0.16)
  };
}

function makeStar(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h * 0.6,
    r: randomRange(0.4, 1.5),
    base: randomRange(0.2, 0.7),
    twinkle: randomRange(0.5, 2.2),
    phase: Math.random() * Math.PI * 2
  };
}

function makeMote(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: randomRange(0.6, 2),
    speed: randomRange(6, 18),
    drift: randomRange(-6, 6),
    phase: Math.random() * Math.PI * 2,
    alpha: randomRange(0.05, 0.2)
  };
}

function stepWeather(now) {
  fx.raf = requestAnimationFrame(stepWeather);
  let dt = (now - fx.lastTime) / 1000;
  fx.lastTime = now;
  if (!Number.isFinite(dt) || dt <= 0) dt = 0.016;
  if (dt > 0.05) dt = 0.05; // clamp tab-switch gaps
  if (fx.reducedMotion) dt *= 0.25;
  updateWeather(dt, now / 1000);
  drawWeather(now / 1000);
}

function updateWeather(dt, t) {
  const w = fx.width;
  const h = fx.height;

  if (fx.type === "rain" || fx.type === "storm") {
    for (const d of fx.drops) {
      d.y += d.speed * dt;
      d.x += d.slant * d.speed * dt * 0.12;
      if (d.y > h + 20) {
        d.y = -20;
        d.x = Math.random() * (w + 200) - 100;
      }
    }
  } else if (fx.type === "wind") {
    for (const s of fx.drops) {
      s.x += s.speed * dt;
      if (s.x - s.len > w) {
        s.x = -s.len;
        s.y = Math.random() * h;
      }
    }
  }

  if (fx.type === "snow") {
    for (const f of fx.flakes) {
      f.y += f.speed * dt;
      f.x += Math.sin(t * f.drift + f.phase) * 16 * dt + f.drift * 5 * dt;
      if (f.y > h + 8) {
        f.y = -8;
        f.x = Math.random() * w;
      }
    }
  }

  for (const c of fx.clouds) {
    c.x += c.speed * dt;
    if (c.x - 280 * c.scale > w) c.x = -280 * c.scale;
  }

  for (const m of fx.mist) {
    m.x += m.speed * dt;
    if (m.x > w) m.x = -w * 0.4;
  }

  for (const p of fx.motes) {
    p.y -= p.speed * dt;
    p.x += Math.sin(t + p.phase) * p.drift * dt;
    if (p.y < -4) {
      p.y = h + 4;
      p.x = Math.random() * w;
    }
  }

  if (fx.type === "storm") {
    fx.flashCooldown -= dt;
    if (fx.flashCooldown <= 0) {
      fx.flash = 1;
      fx.flashCooldown = randomRange(2.4, 6.4);
    } else {
      fx.flash *= Math.pow(0.018, dt);
      if (fx.flash < 0.01) fx.flash = 0;
    }
  }
}

function drawWeather(t) {
  const ctx = fx.ctx;
  if (!ctx) return;
  const w = fx.width;
  const h = fx.height;
  ctx.clearRect(0, 0, w, h);

  if (fx.isDay && fx.type === "clear") {
    drawGlow(ctx, w * 0.74, h * 0.22, Math.max(w, h) * 0.4, "rgba(255,221,140,0.42)");
  } else if (!fx.isDay && (fx.type === "clear" || fx.type === "night")) {
    drawGlow(ctx, w * 0.78, h * 0.18, Math.max(w, h) * 0.22, "rgba(214,226,255,0.32)");
  }

  for (const s of fx.stars) {
    const a = s.base + Math.sin(t * s.twinkle + s.phase) * 0.3;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    ctx.fillStyle = "#eaf2ff";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const cloudTint = fx.isDay ? "236,242,248" : "150,165,195";
  for (const c of fx.clouds) drawCloud(ctx, c, cloudTint);

  for (const m of fx.mist) {
    const grad = ctx.createLinearGradient(m.x, 0, m.x + w, 0);
    grad.addColorStop(0, "rgba(222,228,224,0)");
    grad.addColorStop(0.5, `rgba(222,228,224,${m.alpha})`);
    grad.addColorStop(1, "rgba(222,228,224,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, m.y - m.band / 2, w, m.band);
  }

  if (fx.type === "rain" || fx.type === "storm") {
    ctx.lineCap = "round";
    ctx.lineWidth = fx.type === "storm" ? 1.6 : 1.1;
    ctx.strokeStyle = "rgba(196,238,255,1)";
    for (const d of fx.drops) {
      ctx.globalAlpha = d.alpha;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.slant * 4, d.y - d.len);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (fx.type === "wind") {
    ctx.lineCap = "round";
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "rgba(226,242,245,1)";
    for (const s of fx.drops) {
      ctx.globalAlpha = s.alpha;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.len, s.y - s.len * 0.12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  if (fx.type === "snow") {
    ctx.fillStyle = "#ffffff";
    for (const f of fx.flakes) {
      ctx.globalAlpha = f.alpha;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (fx.motes.length) {
    ctx.fillStyle = "#fff2cf";
    for (const p of fx.motes) {
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  if (fx.flash > 0) {
    ctx.globalAlpha = Math.min(0.5, fx.flash * 0.5);
    ctx.fillStyle = "#e9f1ff";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}

function drawCloud(ctx, c, tint) {
  const baseR = 120 * c.scale;
  const puffs = [
    [0, 0, baseR],
    [baseR * 0.8, baseR * 0.1, baseR * 0.8],
    [-baseR * 0.8, baseR * 0.12, baseR * 0.75],
    [baseR * 0.35, -baseR * 0.32, baseR * 0.7],
    [-baseR * 0.42, -baseR * 0.2, baseR * 0.62]
  ];
  for (const [dx, dy, r] of puffs) {
    const cx = c.x + dx;
    const cy = c.y + dy;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${tint},${c.alpha})`);
    g.addColorStop(1, `rgba(${tint},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
}

function drawGlow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
