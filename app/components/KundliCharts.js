"use client";

// North Indian Style Kundli Chart Component
function NorthIndianChart({ planets, ascendant, title = "Rashi Chart (D1)" }) {
  if (!planets || !ascendant) return null;

  // Map planets to houses
  const housePlanets = {};
  for (let i = 1; i <= 12; i++) housePlanets[i] = [];

  const abbr = { Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke" };

  for (const [name, data] of Object.entries(planets)) {
    if (data.house) {
      housePlanets[data.house].push(abbr[name] || name.substring(0, 2));
    }
  }

  // North Indian diamond layout - house positions for text
  const houseTextPos = {
    1: { x: 150, y: 55 },
    2: { x: 75, y: 55 },
    3: { x: 35, y: 95 },
    4: { x: 35, y: 150 },
    5: { x: 35, y: 205 },
    6: { x: 75, y: 250 },
    7: { x: 150, y: 250 },
    8: { x: 225, y: 250 },
    9: { x: 265, y: 205 },
    10: { x: 265, y: 150 },
    11: { x: 265, y: 95 },
    12: { x: 225, y: 55 },
  };

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-sm font-semibold text-primary-light mb-2">{title}</h3>
      <svg viewBox="0 0 300 300" className="w-full max-w-[250px]" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Background */}
        <rect width="300" height="300" rx="8" fill="#1a1a2e"/>
        
        {/* Outer square */}
        <rect x="10" y="10" width="280" height="280" stroke="#4c1d95" strokeWidth="2" fill="none" rx="2"/>
        
        {/* Diamond lines */}
        <line x1="150" y1="10" x2="10" y2="150" stroke="#4c1d95" strokeWidth="1.5"/>
        <line x1="150" y1="10" x2="290" y2="150" stroke="#4c1d95" strokeWidth="1.5"/>
        <line x1="10" y1="150" x2="150" y2="290" stroke="#4c1d95" strokeWidth="1.5"/>
        <line x1="290" y1="150" x2="150" y2="290" stroke="#4c1d95" strokeWidth="1.5"/>
        
        {/* Inner cross */}
        <line x1="150" y1="10" x2="150" y2="290" stroke="#4c1d95" strokeWidth="0.8" opacity="0.4"/>
        <line x1="10" y1="150" x2="290" y2="150" stroke="#4c1d95" strokeWidth="0.8" opacity="0.4"/>

        {/* ASC marker in house 1 */}
        <text x="150" y="35" fontSize="8" fill="#f59e0b" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif">ASC</text>

        {/* House numbers */}
        {Object.entries(houseTextPos).map(([house, pos]) => (
          <text key={`hnum-${house}`} x={pos.x} y={pos.y - 12} fontSize="7" fill="#6b7280" textAnchor="middle" fontFamily="sans-serif">
            {house}
          </text>
        ))}

        {/* Planet placements */}
        {Object.entries(houseTextPos).map(([house, pos]) => {
          const planetList = housePlanets[parseInt(house)];
          if (planetList.length === 0) return null;
          return (
            <text key={`planets-${house}`} x={pos.x} y={pos.y + 3} fontSize="9" fill="#a78bfa" textAnchor="middle" fontFamily="monospace" fontWeight="bold">
              {planetList.join(" ")}
            </text>
          );
        })}

        {/* Center label */}
        <text x="150" y="150" fontSize="9" fill="#8b5cf6" textAnchor="middle" fontWeight="bold" fontFamily="sans-serif" opacity="0.6">
          {ascendant.sign?.split(" ")[0] || ""}
        </text>
      </svg>
    </div>
  );
}

// Moon Chart (Chandra Kundli) - houses re-oriented from Moon's position
function MoonChart({ planets, ascendant }) {
  if (!planets || !planets.Moon) return null;

  const moonHouse = planets.Moon.house;
  // In Moon chart, Moon's house becomes house 1
  const reorientedPlanets = {};
  for (const [name, data] of Object.entries(planets)) {
    let newHouse = data.house - moonHouse + 1;
    if (newHouse <= 0) newHouse += 12;
    reorientedPlanets[name] = { ...data, house: newHouse };
  }

  return (
    <NorthIndianChart
      planets={reorientedPlanets}
      ascendant={{ ...ascendant, sign: planets.Moon.sign }}
      title="Chandra Kundli (Moon Chart)"
    />
  );
}

// Navamsha Chart (D9) - simplified calculation
function NavamshaChart({ planets, ascendant }) {
  if (!planets) return null;

  // Navamsha: divide each sign into 9 parts (3°20' each)
  // The navamsha sign cycles: Aries sign starts from Aries, Taurus from Capricorn, etc.
  const navamshaStart = [1, 10, 7, 4, 1, 10, 7, 4, 1, 10, 7, 4]; // Starting sign for each rashi

  const navamshaPlanets = {};
  for (const [name, data] of Object.entries(planets)) {
    const siderealDeg = parseFloat(data.fullDegree || data.sidereal || 0);
    const signIndex = Math.floor(siderealDeg / 30); // 0-11
    const degInSign = siderealDeg % 30;
    const navamshaNum = Math.floor(degInSign / (30 / 9)); // 0-8 (which navamsha within sign)
    
    let navamshaSign = (navamshaStart[signIndex] - 1 + navamshaNum) % 12 + 1;
    // Calculate navamsha house from navamsha ascendant
    const ascSidereal = parseFloat(ascendant.longitude || 0);
    const ascSignIndex = Math.floor(ascSidereal / 30);
    const ascDegInSign = ascSidereal % 30;
    const ascNavamshaNum = Math.floor(ascDegInSign / (30 / 9));
    const ascNavamshaSign = (navamshaStart[ascSignIndex] - 1 + ascNavamshaNum) % 12 + 1;
    
    let house = navamshaSign - ascNavamshaSign + 1;
    if (house <= 0) house += 12;
    if (house > 12) house -= 12;

    navamshaPlanets[name] = { ...data, house, signIndex: navamshaSign };
  }

  return (
    <NorthIndianChart
      planets={navamshaPlanets}
      ascendant={ascendant}
      title="Navamsha Chart (D9)"
    />
  );
}

// Planet positions table
function PlanetTable({ planets, ascendant }) {
  if (!planets) return null;

  const planetOrder = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
  const planetIcons = { Sun: "☉", Moon: "☽", Mars: "♂", Mercury: "☿", Jupiter: "♃", Venus: "♀", Saturn: "♄", Rahu: "☊", Ketu: "☋" };

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
      <h3 className="text-lg font-bold mb-4 text-primary-light">🪐 Planetary Positions</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-muted">Planet</th>
              <th className="text-left py-2 px-2 text-muted">Sign</th>
              <th className="text-left py-2 px-2 text-muted">Degree</th>
              <th className="text-left py-2 px-2 text-muted">House</th>
              <th className="text-left py-2 px-2 text-muted hidden sm:table-cell">Dignity</th>
            </tr>
          </thead>
          <tbody>
            {/* Ascendant row */}
            <tr className="border-b border-border/50 bg-primary/5">
              <td className="py-2 px-2 font-medium text-accent">🔺 Lagna</td>
              <td className="py-2 px-2 text-foreground">{ascendant.sign}</td>
              <td className="py-2 px-2 text-muted">{ascendant.degree}</td>
              <td className="py-2 px-2 text-muted">1st</td>
              <td className="py-2 px-2 text-muted hidden sm:table-cell">—</td>
            </tr>
            {planetOrder.map((name) => {
              const data = planets[name];
              if (!data) return null;
              const isExalted = data.dignity?.includes("Exalted");
              const isDebilitated = data.dignity?.includes("Debilitated");
              return (
                <tr key={name} className="border-b border-border/50 hover:bg-surface-light/50">
                  <td className="py-2 px-2 font-medium">
                    <span className="mr-1">{planetIcons[name]}</span> {name}
                  </td>
                  <td className="py-2 px-2 text-foreground">{data.sign}</td>
                  <td className="py-2 px-2 text-muted">{data.degree}</td>
                  <td className="py-2 px-2 text-muted">{data.house}</td>
                  <td className={`py-2 px-2 hidden sm:table-cell ${isExalted ? "text-green-400" : isDebilitated ? "text-red-400" : "text-muted"}`}>
                    {data.dignity || "Normal"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Lucky Factors Visual Card
function LuckyFactorsCard({ chartData }) {
  if (!chartData) return null;

  const { ascendant, nakshatra } = chartData;
  
  // Determine lucky factors based on ascendant lord
  const signGems = {
    1: { gem: "Red Coral", color: "#DC2626", lucky: [9, 1, 3], day: "Tuesday", color_name: "Red" },
    2: { gem: "Diamond", color: "#E5E7EB", lucky: [6, 2, 7], day: "Friday", color_name: "White" },
    3: { gem: "Emerald", color: "#10B981", lucky: [5, 3, 8], day: "Wednesday", color_name: "Green" },
    4: { gem: "Pearl", color: "#F9FAFB", lucky: [2, 7, 9], day: "Monday", color_name: "White/Silver" },
    5: { gem: "Ruby", color: "#EF4444", lucky: [1, 4, 9], day: "Sunday", color_name: "Gold/Orange" },
    6: { gem: "Emerald", color: "#10B981", lucky: [5, 3, 6], day: "Wednesday", color_name: "Green" },
    7: { gem: "Diamond", color: "#E5E7EB", lucky: [6, 7, 2], day: "Friday", color_name: "White/Pink" },
    8: { gem: "Red Coral", color: "#DC2626", lucky: [9, 1, 8], day: "Tuesday", color_name: "Dark Red" },
    9: { gem: "Yellow Sapphire", color: "#F59E0B", lucky: [3, 9, 5], day: "Thursday", color_name: "Yellow" },
    10: { gem: "Blue Sapphire", color: "#3B82F6", lucky: [8, 4, 6], day: "Saturday", color_name: "Blue/Black" },
    11: { gem: "Blue Sapphire", color: "#3B82F6", lucky: [8, 4, 7], day: "Saturday", color_name: "Blue" },
    12: { gem: "Yellow Sapphire", color: "#F59E0B", lucky: [3, 9, 7], day: "Thursday", color_name: "Yellow" },
  };

  const signIdx = ascendant.signIndex || 1;
  const lucky = signGems[signIdx] || signGems[1];

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
      <h3 className="text-lg font-bold mb-4 text-primary-light">🍀 Lucky Factors</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Gemstone */}
        <div className="text-center p-4 bg-background rounded-xl border border-border">
          <div className="text-3xl mb-2">💎</div>
          <p className="text-xs text-muted mb-1">Lucky Gem</p>
          <p className="text-sm font-bold text-foreground">{lucky.gem}</p>
        </div>
        {/* Color */}
        <div className="text-center p-4 bg-background rounded-xl border border-border">
          <div className="w-8 h-8 rounded-full mx-auto mb-2 border-2 border-border" style={{ backgroundColor: lucky.color }}></div>
          <p className="text-xs text-muted mb-1">Lucky Color</p>
          <p className="text-sm font-bold text-foreground">{lucky.color_name}</p>
        </div>
        {/* Number */}
        <div className="text-center p-4 bg-background rounded-xl border border-border">
          <div className="text-3xl mb-2 font-bold text-accent">{lucky.lucky[0]}</div>
          <p className="text-xs text-muted mb-1">Lucky Number</p>
          <p className="text-sm font-bold text-foreground">{lucky.lucky.join(", ")}</p>
        </div>
        {/* Day */}
        <div className="text-center p-4 bg-background rounded-xl border border-border">
          <div className="text-3xl mb-2">📅</div>
          <p className="text-xs text-muted mb-1">Lucky Day</p>
          <p className="text-sm font-bold text-foreground">{lucky.day}</p>
        </div>
      </div>

      {/* Nakshatra info */}
      {nakshatra && (
        <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/20">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⭐</span>
            <div>
              <p className="text-sm font-bold text-foreground">Birth Star: {nakshatra.name} (Pada {nakshatra.pada})</p>
              <p className="text-xs text-muted">Ruler: {nakshatra.ruler} | Deity: {nakshatra.deity}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Upay/Remedies Visual Section
function UpaySection({ chartData }) {
  if (!chartData) return null;

  const { planets, ascendant } = chartData;
  
  // Find weak/debilitated planets for remedies
  const weakPlanets = Object.entries(planets || {}).filter(
    ([_, data]) => data.dignity?.includes("Debilitated") || data.dignity?.includes("Normal")
  ).slice(0, 3);

  const remedies = {
    Sun: { mantra: "Om Suryaya Namah", count: "108x Sunday", charity: "Wheat, Jaggery to poor", fast: "Sunday", icon: "☉" },
    Moon: { mantra: "Om Chandraya Namah", count: "108x Monday", charity: "White rice, milk to poor", fast: "Monday", icon: "☽" },
    Mars: { mantra: "Om Mangalaya Namah", count: "108x Tuesday", charity: "Red lentils, jaggery", fast: "Tuesday", icon: "♂" },
    Mercury: { mantra: "Om Budhaya Namah", count: "108x Wednesday", charity: "Green moong dal", fast: "Wednesday", icon: "☿" },
    Jupiter: { mantra: "Om Gurave Namah", count: "108x Thursday", charity: "Yellow dal, turmeric", fast: "Thursday", icon: "♃" },
    Venus: { mantra: "Om Shukraya Namah", count: "108x Friday", charity: "White clothes, sugar", fast: "Friday", icon: "♀" },
    Saturn: { mantra: "Om Shanaischaraya Namah", count: "108x Saturday", charity: "Black sesame, oil to poor", fast: "Saturday", icon: "♄" },
    Rahu: { mantra: "Om Rahave Namah", count: "108x Saturday", charity: "Blue/black cloth", fast: "Saturday", icon: "☊" },
    Ketu: { mantra: "Om Ketave Namah", count: "108x Tuesday", charity: "Seven grains mix", fast: "Tuesday", icon: "☋" },
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
      <h3 className="text-lg font-bold mb-4 text-primary-light">🙏 Upay (Remedies)</h3>
      <div className="space-y-4">
        {weakPlanets.map(([name, data]) => {
          const remedy = remedies[name];
          if (!remedy) return null;
          return (
            <div key={name} className="bg-background border border-border rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{remedy.icon}</span>
                <div>
                  <p className="font-bold text-foreground">{name} — {data.sign}</p>
                  <p className="text-xs text-muted">Status: {data.dignity} | House {data.house}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-accent">🕉️</span>
                  <span className="text-muted"><strong className="text-foreground">Mantra:</strong> {remedy.mantra}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-accent">🔢</span>
                  <span className="text-muted"><strong className="text-foreground">Chant:</strong> {remedy.count}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-accent">🎁</span>
                  <span className="text-muted"><strong className="text-foreground">Charity:</strong> {remedy.charity}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-accent">🍽️</span>
                  <span className="text-muted"><strong className="text-foreground">Fast:</strong> {remedy.fast}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Main Charts Section - exports all chart components
export default function KundliChartsSection({ chartData }) {
  if (!chartData || !chartData.planets) return null;

  return (
    <div className="mb-8">
      {/* Charts Grid */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
        <h3 className="text-lg font-bold mb-6 text-primary-light text-center">📊 Your Kundli Charts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NorthIndianChart
            planets={chartData.planets}
            ascendant={chartData.ascendant}
            title="Rashi Chart (D1 - Lagna)"
          />
          <MoonChart
            planets={chartData.planets}
            ascendant={chartData.ascendant}
          />
          <NavamshaChart
            planets={chartData.planets}
            ascendant={chartData.ascendant}
          />
        </div>
      </div>

      {/* Planet Table */}
      <PlanetTable planets={chartData.planets} ascendant={chartData.ascendant} />

      {/* Lucky Factors */}
      <LuckyFactorsCard chartData={chartData} />

      {/* Upay Remedies */}
      <UpaySection chartData={chartData} />
    </div>
  );
}

export { NorthIndianChart, MoonChart, NavamshaChart, PlanetTable, LuckyFactorsCard, UpaySection };
