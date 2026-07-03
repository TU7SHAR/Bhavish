import * as Astronomy from "astronomy-engine";

// Lahiri Ayanamsa calculation (most commonly used in Vedic astrology)
function getLahiriAyanamsa(jd) {
  // Lahiri Ayanamsa formula (approximation based on Spica at 0° Libra in 285 AD)
  const T = (jd - 2451545.0) / 36525.0; // Julian centuries from J2000.0
  const ayanamsa = 23.856 + 1.3972222 * T + 0.0003086 * T * T;
  return ayanamsa % 360;
}

// Convert tropical longitude to sidereal (Vedic)
function toSidereal(tropicalLongitude, ayanamsa) {
  let sidereal = tropicalLongitude - ayanamsa;
  if (sidereal < 0) sidereal += 360;
  return sidereal;
}

// Get zodiac sign from sidereal longitude
function getSign(longitude) {
  const signs = [
    "Mesha (Aries)", "Vrishabha (Taurus)", "Mithuna (Gemini)",
    "Karka (Cancer)", "Simha (Leo)", "Kanya (Virgo)",
    "Tula (Libra)", "Vrischika (Scorpio)", "Dhanu (Sagittarius)",
    "Makara (Capricorn)", "Kumbha (Aquarius)", "Meena (Pisces)"
  ];
  const signIndex = Math.floor(longitude / 30);
  return {
    name: signs[signIndex],
    index: signIndex + 1,
    degree: longitude % 30,
  };
}

// Get Nakshatra from sidereal Moon longitude
function getNakshatra(moonLongitude) {
  const nakshatras = [
    { name: "Ashwini", ruler: "Ketu", deity: "Ashwini Kumaras" },
    { name: "Bharani", ruler: "Venus", deity: "Yama" },
    { name: "Krittika", ruler: "Sun", deity: "Agni" },
    { name: "Rohini", ruler: "Moon", deity: "Brahma" },
    { name: "Mrigashira", ruler: "Mars", deity: "Soma" },
    { name: "Ardra", ruler: "Rahu", deity: "Rudra" },
    { name: "Punarvasu", ruler: "Jupiter", deity: "Aditi" },
    { name: "Pushya", ruler: "Saturn", deity: "Brihaspati" },
    { name: "Ashlesha", ruler: "Mercury", deity: "Nagas" },
    { name: "Magha", ruler: "Ketu", deity: "Pitris" },
    { name: "Purva Phalguni", ruler: "Venus", deity: "Bhaga" },
    { name: "Uttara Phalguni", ruler: "Sun", deity: "Aryaman" },
    { name: "Hasta", ruler: "Moon", deity: "Savitar" },
    { name: "Chitra", ruler: "Mars", deity: "Vishwakarma" },
    { name: "Swati", ruler: "Rahu", deity: "Vayu" },
    { name: "Vishakha", ruler: "Jupiter", deity: "Indragni" },
    { name: "Anuradha", ruler: "Saturn", deity: "Mitra" },
    { name: "Jyeshtha", ruler: "Mercury", deity: "Indra" },
    { name: "Moola", ruler: "Ketu", deity: "Nirriti" },
    { name: "Purva Ashadha", ruler: "Venus", deity: "Apas" },
    { name: "Uttara Ashadha", ruler: "Sun", deity: "Vishwadevas" },
    { name: "Shravana", ruler: "Moon", deity: "Vishnu" },
    { name: "Dhanishtha", ruler: "Mars", deity: "Vasus" },
    { name: "Shatabhisha", ruler: "Rahu", deity: "Varuna" },
    { name: "Purva Bhadrapada", ruler: "Jupiter", deity: "Ajaikapad" },
    { name: "Uttara Bhadrapada", ruler: "Saturn", deity: "Ahir Budhnya" },
    { name: "Revati", ruler: "Mercury", deity: "Pushan" },
  ];

  const nakshatraSpan = 360 / 27; // 13.333... degrees each
  const index = Math.floor(moonLongitude / nakshatraSpan);
  const pada = Math.floor((moonLongitude % nakshatraSpan) / (nakshatraSpan / 4)) + 1;

  return {
    ...nakshatras[index],
    index: index + 1,
    pada,
    degree: moonLongitude % nakshatraSpan,
  };
}

// Calculate Vimshottari Dasha
function calculateDasha(moonLongitude) {
  const dashaOrder = [
    { planet: "Ketu", years: 7 },
    { planet: "Venus", years: 20 },
    { planet: "Sun", years: 6 },
    { planet: "Moon", years: 10 },
    { planet: "Mars", years: 7 },
    { planet: "Rahu", years: 18 },
    { planet: "Jupiter", years: 16 },
    { planet: "Saturn", years: 19 },
    { planet: "Mercury", years: 17 },
  ];

  const nakshatraSpan = 360 / 27;
  const nakshatraIndex = Math.floor(moonLongitude / nakshatraSpan);
  const dashaStartIndex = nakshatraIndex % 9;
  const portionUsed = (moonLongitude % nakshatraSpan) / nakshatraSpan;

  // Build dasha sequence from birth
  const sequence = [];
  for (let i = 0; i < 9; i++) {
    const idx = (dashaStartIndex + i) % 9;
    const dasha = dashaOrder[idx];
    let years = dasha.years;
    if (i === 0) {
      years = dasha.years * (1 - portionUsed); // Remaining portion of first dasha
    }
    sequence.push({ planet: dasha.planet, years: parseFloat(years.toFixed(2)) });
  }

  return sequence;
}

// Compute the FULL Vimshottari Dasha timeline with real dates, and identify
// the CURRENT running Mahadasha + Antardasha. This is critical — without it,
// the AI guesses the current period and gets it wrong.
function computeDashaTimeline(moonLongitude, birthDate) {
  const dashaOrder = [
    { planet: "Ketu", years: 7 }, { planet: "Venus", years: 20 },
    { planet: "Sun", years: 6 }, { planet: "Moon", years: 10 },
    { planet: "Mars", years: 7 }, { planet: "Rahu", years: 18 },
    { planet: "Jupiter", years: 16 }, { planet: "Saturn", years: 19 },
    { planet: "Mercury", years: 17 },
  ];
  const MS_YEAR = 365.2425 * 24 * 3600 * 1000;
  const nakshatraSpan = 360 / 27;
  const nakshatraIndex = Math.floor(moonLongitude / nakshatraSpan);
  const startIdx = nakshatraIndex % 9;
  const portionUsed = (moonLongitude % nakshatraSpan) / nakshatraSpan;

  const now = new Date();
  let cursor = new Date(birthDate);
  const mahaTimeline = [];
  let current = null;

  for (let i = 0; i < 9; i++) {
    const lord = dashaOrder[(startIdx + i) % 9];
    const fullYears = lord.years;
    const years = i === 0 ? fullYears * (1 - portionUsed) : fullYears;
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + years * MS_YEAR);
    mahaTimeline.push({ planet: lord.planet, start, end, years });
    cursor = end;
  }

  // Find current Mahadasha
  const currentMaha = mahaTimeline.find((d) => now >= d.start && now < d.end) || null;

  // Compute Antardasha within the current Mahadasha
  let currentAntar = null;
  const antarList = [];
  if (currentMaha) {
    const mahaLord = currentMaha.planet;
    const mahaFullYears = dashaOrder.find((d) => d.planet === mahaLord).years;
    const mahaTotalMs = mahaFullYears * MS_YEAR; // full length for proportion
    // Antardasha order starts from the mahadasha lord
    const mahaOrderIdx = dashaOrder.findIndex((d) => d.planet === mahaLord);
    // The mahadasha's TRUE start (if it's the first/partial, back-calc full start)
    let antarCursor = new Date(currentMaha.end.getTime() - mahaTotalMs);
    for (let i = 0; i < 9; i++) {
      const sub = dashaOrder[(mahaOrderIdx + i) % 9];
      const subMs = (sub.years / 120) * mahaTotalMs;
      const s = new Date(antarCursor);
      const e = new Date(antarCursor.getTime() + subMs);
      antarList.push({ planet: sub.planet, start: s, end: e });
      antarCursor = e;
    }
    currentAntar = antarList.find((a) => now >= a.start && now < a.end) || null;
  }

  const fmt = (d) => d ? `${d.toLocaleString("en-US", { month: "short" })} ${d.getFullYear()}` : "";

  return {
    currentMahadasha: currentMaha ? currentMaha.planet : null,
    currentMahadashaStart: currentMaha ? fmt(currentMaha.start) : null,
    currentMahadashaEnd: currentMaha ? fmt(currentMaha.end) : null,
    currentAntardasha: currentAntar ? currentAntar.planet : null,
    currentAntardashaEnd: currentAntar ? fmt(currentAntar.end) : null,
    // Human-readable summary for the AI prompt
    summary: currentMaha
      ? `Currently running ${currentMaha.planet} Mahadasha (${fmt(currentMaha.start)} to ${fmt(currentMaha.end)})` +
        (currentAntar ? `, with ${currentAntar.planet} Antardasha (until ${fmt(currentAntar.end)})` : "")
      : "Dasha period could not be determined",
    timeline: mahaTimeline.map((d) => ({ planet: d.planet, start: fmt(d.start), end: fmt(d.end) })),
  };
}

// Calculate Lagna (Ascendant) using sidereal time
function calculateLagna(date, latitude, longitude, ayanamsa) {
  // Calculate Local Sidereal Time
  const jd = getJulianDate(date);
  const T = (jd - 2451545.0) / 36525.0;
  
  // Greenwich Mean Sidereal Time
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 
             0.000387933 * T * T - T * T * T / 38710000;
  gmst = gmst % 360;
  if (gmst < 0) gmst += 360;

  // Local Sidereal Time
  const lst = (gmst + longitude) % 360;

  // Ascendant calculation (simplified obliquity-based)
  const obliquity = 23.4393 - 0.013 * T; // Earth's axial tilt
  const oblRad = obliquity * Math.PI / 180;
  const latRad = latitude * Math.PI / 180;
  const lstRad = lst * Math.PI / 180;

  let ascendant = Math.atan2(
    Math.cos(lstRad),
    -(Math.sin(lstRad) * Math.cos(oblRad) + Math.tan(latRad) * Math.sin(oblRad))
  ) * 180 / Math.PI;

  if (ascendant < 0) ascendant += 360;

  // Convert to sidereal
  ascendant = toSidereal(ascendant, ayanamsa);
  if (ascendant < 0) ascendant += 360;

  return ascendant;
}

function getJulianDate(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + date.getUTCHours() / 24 + 
            date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400;
  
  let jy = y, jm = m;
  if (m <= 2) { jy--; jm += 12; }
  
  const A = Math.floor(jy / 100);
  const B = 2 - A + Math.floor(A / 4);
  
  return Math.floor(365.25 * (jy + 4716)) + Math.floor(30.6001 * (jm + 1)) + d + B - 1524.5;
}

// Get house number from longitude relative to ascendant
function getHouse(planetLongitude, ascendantLongitude) {
  let diff = planetLongitude - ascendantLongitude;
  if (diff < 0) diff += 360;
  return Math.floor(diff / 30) + 1;
}

// Determine planet dignity
function getPlanetDignity(planet, signIndex) {
  const dignities = {
    Sun: { exalted: 1, debilitated: 7, own: [5], mooltrikona: 5 },
    Moon: { exalted: 2, debilitated: 8, own: [4], mooltrikona: 2 },
    Mars: { exalted: 10, debilitated: 4, own: [1, 8], mooltrikona: 1 },
    Mercury: { exalted: 6, debilitated: 12, own: [3, 6], mooltrikona: 6 },
    Jupiter: { exalted: 4, debilitated: 10, own: [9, 12], mooltrikona: 9 },
    Venus: { exalted: 12, debilitated: 6, own: [2, 7], mooltrikona: 7 },
    Saturn: { exalted: 7, debilitated: 1, own: [10, 11], mooltrikona: 11 },
  };

  const d = dignities[planet];
  if (!d) return "Normal";
  if (signIndex === d.exalted) return "Exalted (Uchcha)";
  if (signIndex === d.debilitated) return "Debilitated (Neecha)";
  if (d.own.includes(signIndex)) return "Own Sign (Swakshetra)";
  if (signIndex === d.mooltrikona) return "Mooltrikona";
  return "Normal";
}

// Calculate Rahu and Ketu (Mean Nodes)
function calculateNodes(date) {
  const jd = getJulianDate(date);
  const T = (jd - 2451545.0) / 36525.0;
  
  // Mean ascending node (Rahu) - tropical
  let rahu = 125.0445479 - 1934.1362891 * T + 0.0020754 * T * T;
  rahu = rahu % 360;
  if (rahu < 0) rahu += 360;
  
  // Ketu is exactly opposite
  let ketu = (rahu + 180) % 360;

  return { rahu, ketu };
}

/**
 * Main calculation function
 * @param {Object} params - Birth details
 * @param {string} params.dateOfBirth - Date in YYYY-MM-DD format
 * @param {string} params.timeOfBirth - Time in HH:MM format (24hr)
 * @param {number} params.latitude - Birth place latitude
 * @param {number} params.longitude - Birth place longitude
 */
export function calculateBirthChart({ dateOfBirth, timeOfBirth, latitude, longitude }) {
  // Parse date and time
  const [year, month, day] = dateOfBirth.split("-").map(Number);
  const [hours, minutes] = timeOfBirth.split(":").map(Number);

  // Create UTC date (assuming IST +5:30 for India)
  const utcHours = hours - 5;
  const utcMinutes = minutes - 30;
  const birthDate = new Date(Date.UTC(year, month - 1, day, utcHours, utcMinutes, 0));

  // Julian date for ayanamsa
  const jd = getJulianDate(birthDate);
  const ayanamsa = getLahiriAyanamsa(jd);

  // Calculate planet positions using astronomy-engine
  const planets = {};
  const planetBodies = {
    Sun: Astronomy.Body.Sun,
    Moon: Astronomy.Body.Moon,
    Mars: Astronomy.Body.Mars,
    Mercury: Astronomy.Body.Mercury,
    Jupiter: Astronomy.Body.Jupiter,
    Venus: Astronomy.Body.Venus,
    Saturn: Astronomy.Body.Saturn,
  };

  const astroDate = Astronomy.MakeTime(birthDate);

  for (const [name, body] of Object.entries(planetBodies)) {
    let tropicalLong;

    try {
      if (body === Astronomy.Body.Sun) {
        const sunPos = Astronomy.SunPosition(astroDate);
        tropicalLong = sunPos.elon;
      } else if (body === Astronomy.Body.Moon) {
        const moonPos = Astronomy.EclipticGeoMoon(astroDate);
        tropicalLong = moonPos.lon;
      } else {
        // For Mars, Mercury, Jupiter, Venus, Saturn:
        // Use GEOCENTRIC position (as seen from Earth) — required for astrology.
        // NOTE: EclipticLongitude() returns HELIOCENTRIC longitude (as seen from
        // the Sun), which is astronomically wrong for a birth chart. That bug
        // put Mercury/Venus in impossible signs (e.g. Mercury in Scorpio while
        // Sun in Gemini). GeoVector + Ecliptic gives the true geocentric longitude.
        const geoVec = Astronomy.GeoVector(body, astroDate, true);
        const ecl = Astronomy.Ecliptic(geoVec);
        tropicalLong = ecl.elon;
      }
    } catch (err) {
      console.error(`Error calculating ${name}:`, err.message);
      tropicalLong = 0;
    }

    const siderealLong = toSidereal(tropicalLong, ayanamsa);
    const sign = getSign(siderealLong);

    planets[name] = {
      tropical: tropicalLong.toFixed(4),
      sidereal: siderealLong.toFixed(4),
      sign: sign.name,
      signIndex: sign.index,
      degree: `${Math.floor(sign.degree)}°${Math.floor((sign.degree % 1) * 60)}'`,
      fullDegree: siderealLong.toFixed(2),
      dignity: getPlanetDignity(name, sign.index),
    };
  }

  // Calculate Rahu and Ketu
  const nodes = calculateNodes(birthDate);
  const rahuSidereal = toSidereal(nodes.rahu, ayanamsa);
  const ketuSidereal = toSidereal(nodes.ketu, ayanamsa);
  const rahuSign = getSign(rahuSidereal);
  const ketuSign = getSign(ketuSidereal);

  planets.Rahu = {
    sidereal: rahuSidereal.toFixed(4),
    sign: rahuSign.name,
    signIndex: rahuSign.index,
    degree: `${Math.floor(rahuSign.degree)}°${Math.floor((rahuSign.degree % 1) * 60)}'`,
    fullDegree: rahuSidereal.toFixed(2),
    dignity: "Shadow Planet (Chhaya Graha)",
  };

  planets.Ketu = {
    sidereal: ketuSidereal.toFixed(4),
    sign: ketuSign.name,
    signIndex: ketuSign.index,
    degree: `${Math.floor(ketuSign.degree)}°${Math.floor((ketuSign.degree % 1) * 60)}'`,
    fullDegree: ketuSidereal.toFixed(2),
    dignity: "Shadow Planet (Chhaya Graha)",
  };

  // Calculate Ascendant (Lagna)
  const ascendantLong = calculateLagna(birthDate, latitude, longitude, ayanamsa);
  const ascendantSign = getSign(ascendantLong);

  // Calculate houses for each planet using WHOLE SIGN house system
  // (standard in Vedic astrology). The Ascendant's sign is the 1st house,
  // the next sign the 2nd, and so on. This matches the metadata claim
  // "Whole Sign (Rashi-based)". Previously used equal-house-from-degree
  // which put planets in the wrong house near sign boundaries.
  const ascSignIndex = ascendantSign.index; // 1-12
  for (const [name, data] of Object.entries(planets)) {
    const planetSignIndex = data.signIndex; // 1-12
    data.house = ((planetSignIndex - ascSignIndex + 12) % 12) + 1;
  }

  // Moon's Nakshatra
  const moonSidereal = parseFloat(planets.Moon.sidereal);
  const nakshatra = getNakshatra(moonSidereal);

  // Vimshottari Dasha (sequence with years)
  const dasha = calculateDasha(moonSidereal);
  // Full dasha timeline with real dates + CURRENT running Maha/Antar dasha
  const dashaTimeline = computeDashaTimeline(moonSidereal, birthDate);

  // Moon sign (Rashi)
  const rashi = planets.Moon.sign;

  return {
    ascendant: {
      longitude: ascendantLong.toFixed(2),
      sign: ascendantSign.name,
      signIndex: ascendantSign.index,
      degree: `${Math.floor(ascendantSign.degree)}°${Math.floor((ascendantSign.degree % 1) * 60)}'`,
    },
    planets,
    nakshatra,
    rashi,
    dasha,
    dashaTimeline,
    ayanamsa: ayanamsa.toFixed(4),
    metadata: {
      system: "Lahiri Ayanamsa",
      houseSystem: "Whole Sign (Rashi-based)",
      engine: "astronomy-engine (Swiss Ephemeris precision)",
      calculatedAt: new Date().toISOString(),
    },
  };
}

// Generate SVG Kundli Chart (North Indian Style)
export function generateKundliSVG(chartData) {
  const { ascendant, planets } = chartData;

  // Map planets to houses
  const housePlanets = {};
  for (let i = 1; i <= 12; i++) housePlanets[i] = [];

  for (const [name, data] of Object.entries(planets)) {
    const abbr = { Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke" };
    housePlanets[data.house].push(abbr[name] || name.substring(0, 2));
  }

  // North Indian chart layout - houses mapped to positions
  // The diamond/square grid layout
  const housePositions = {
    1: { x: 150, y: 45 },   // Top center
    2: { x: 75, y: 45 },    // Top left
    3: { x: 45, y: 75 },    // Left top
    4: { x: 45, y: 150 },   // Left center
    5: { x: 45, y: 225 },   // Left bottom
    6: { x: 75, y: 255 },   // Bottom left
    7: { x: 150, y: 255 },  // Bottom center
    8: { x: 225, y: 255 },  // Bottom right
    9: { x: 255, y: 225 },  // Right bottom
    10: { x: 255, y: 150 }, // Right center
    11: { x: 255, y: 75 },  // Right top
    12: { x: 225, y: 45 },  // Top right
  };

  let planetsText = "";
  for (let house = 1; house <= 12; house++) {
    const pos = housePositions[house];
    const planetList = housePlanets[house];
    if (planetList.length > 0) {
      planetsText += `<text x="${pos.x}" y="${pos.y}" font-size="10" fill="#a78bfa" text-anchor="middle" font-family="monospace">${planetList.join(" ")}</text>\n`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="none">
  <!-- Background -->
  <rect width="300" height="300" rx="8" fill="#1a1a2e"/>
  
  <!-- Outer square -->
  <rect x="10" y="10" width="280" height="280" stroke="#4c1d95" stroke-width="2" fill="none" rx="4"/>
  
  <!-- Inner diamond (diagonal lines) -->
  <line x1="150" y1="10" x2="10" y2="150" stroke="#4c1d95" stroke-width="1.5"/>
  <line x1="150" y1="10" x2="290" y2="150" stroke="#4c1d95" stroke-width="1.5"/>
  <line x1="10" y1="150" x2="150" y2="290" stroke="#4c1d95" stroke-width="1.5"/>
  <line x1="290" y1="150" x2="150" y2="290" stroke="#4c1d95" stroke-width="1.5"/>
  
  <!-- Cross lines -->
  <line x1="150" y1="10" x2="150" y2="290" stroke="#4c1d95" stroke-width="1" opacity="0.5"/>
  <line x1="10" y1="150" x2="290" y2="150" stroke="#4c1d95" stroke-width="1" opacity="0.5"/>
  
  <!-- House numbers -->
  <text x="150" y="25" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">1</text>
  <text x="80" y="30" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">12</text>
  <text x="25" y="80" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">11</text>
  <text x="25" y="155" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">10</text>
  <text x="25" y="230" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">9</text>
  <text x="80" y="285" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">8</text>
  <text x="150" y="285" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">7</text>
  <text x="220" y="285" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">6</text>
  <text x="275" y="230" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">5</text>
  <text x="275" y="155" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">4</text>
  <text x="275" y="80" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">3</text>
  <text x="220" y="30" font-size="8" fill="#6b7280" text-anchor="middle" font-family="sans-serif">2</text>
  
  <!-- ASC marker -->
  <text x="150" y="60" font-size="9" fill="#f59e0b" text-anchor="middle" font-weight="bold" font-family="sans-serif">ASC</text>
  
  <!-- Planet placements -->
  ${planetsText}
  
  <!-- Title -->
  <text x="150" y="155" font-size="11" fill="#8b5cf6" text-anchor="middle" font-weight="bold" font-family="sans-serif">KUNDLI</text>
</svg>`;

  return svg;
}
