/**
 * A static SVG scene meant for iteration: a 4-6-0 steam locomotive (two leading
 * wheels, three large drivers, no trailing wheels) with smokebox, banded boiler,
 * and a cab, pulling three "stem cars" (bass / melody / vocals). Every animated
 * part carries a stable id or class so the render loop can drive it:
 *
 *   .fl-wheel        wheel groups to spin (transform-box: fill-box)
 *   #fl-track        the rail/sleeper group to scroll horizontally
 *   #fl-steam        chimney steam puff container
 *   .fl-window-glow  car window rects whose opacity tracks band energy
 *   #fl-station      the platform + signage, hidden until arrival
 *   #fl-sign-text    the destination song label
 *
 * Colours come from CSS variables so a new song can recolour the whole train.
 */

const STEMS = [
  { label: "BASS", accent: "var(--accent-low)" },
  { label: "MELODY", accent: "var(--accent-mid)" },
  { label: "VOCALS", accent: "var(--accent-high)" },
];

/** A driving/leading wheel with spokes, centered at (0,0), given radius r. */
function wheel(cx: number, cy: number, r: number, drive: boolean): string {
  const spokes = drive ? 8 : 6;
  const lines: string[] = [];
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    lines.push(
      `<line x1="0" y1="0" x2="${(r * 0.82 * Math.cos(a)).toFixed(1)}" y2="${(
        r * 0.82 * Math.sin(a)
      ).toFixed(1)}" />`,
    );
  }
  return `
    <g class="fl-wheel" transform="translate(${cx} ${cy})">
      <circle class="fl-tyre" r="${r}" />
      <g class="fl-spokes" stroke-width="${drive ? 4 : 3}">${lines.join("")}</g>
      <circle class="fl-hub" r="${r * 0.22}" />
    </g>`;
}

function stemCar(x: number, accent: string, label: string): string {
  const w = 210;
  const bodyY = 60;
  const bodyH = 108;
  return `
    <g class="fl-car" transform="translate(${x} 0)">
      <!-- coupler -->
      <rect x="-24" y="${bodyY + bodyH / 2 - 5}" width="30" height="10" rx="3" class="fl-coupler" />
      <!-- body -->
      <rect x="0" y="${bodyY}" width="${w}" height="${bodyH}" rx="10"
            class="fl-car-body" style="stroke:${accent}" />
      <!-- lit window -->
      <rect class="fl-window-glow" x="24" y="${bodyY + 20}" width="${w - 48}" height="46" rx="6"
            style="fill:${accent}" />
      <text x="${w / 2}" y="${bodyY + bodyH - 18}" class="fl-car-label"
            style="fill:${accent}">${label}</text>
      <!-- two axles per car -->
      ${wheel(48, bodyY + bodyH + 14, 26, false)}
      ${wheel(w - 48, bodyY + bodyH + 14, 26, false)}
    </g>`;
}

export function locomotiveSVG(): string {
  // Locomotive occupies roughly x:[560..980]; cars trail to the left.
  const railY = 244;
  const drivers = [640, 728, 816].map((x) => wheel(x, railY - 10, 44, true));
  const leading = wheel(896, railY + 2, 26, false);

  return `
<svg id="fl-train" viewBox="0 0 1220 300" preserveAspectRatio="xMidYMax slice"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Steam train pulling three stem cars">
  <defs>
    <linearGradient id="fl-boiler" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a2f3c"/>
      <stop offset="0.5" stop-color="#171b24"/>
      <stop offset="1" stop-color="#0c0e14"/>
    </linearGradient>
    <radialGradient id="fl-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- ground haze -->
  <rect x="0" y="256" width="1220" height="44" fill="#080a0f"/>

  <!-- STATION: platform + signage, revealed on arrival -->
  <g id="fl-station" opacity="0">
    <rect x="980" y="196" width="240" height="60" rx="4" class="fl-platform"/>
    <rect x="1000" y="120" width="150" height="52" rx="8" class="fl-sign"/>
    <text id="fl-sign-text" x="1075" y="152" class="fl-sign-text"></text>
    <line x1="1010" y1="172" x2="1010" y2="196" class="fl-sign-post"/>
    <line x1="1140" y1="172" x2="1140" y2="196" class="fl-sign-post"/>
  </g>

  <!-- TRACK: rails + sleepers, scrolled left while moving -->
  <g id="fl-track">
    <rect x="-40" y="${railY + 30}" width="1300" height="6" class="fl-rail"/>
    <g class="fl-sleepers">
      ${Array.from({ length: 44 }, (_, i) =>
        `<rect x="${-40 + i * 30}" y="${railY + 28}" width="14" height="12" rx="2" class="fl-sleeper"/>`,
      ).join("")}
    </g>
  </g>

  <!-- CARS (behind the loco) -->
  ${stemCar(60, STEMS[2].accent, STEMS[2].label)}
  ${stemCar(300, STEMS[1].accent, STEMS[1].label)}
  ${stemCar(540, STEMS[0].accent, STEMS[0].label)}

  <!-- ===================== LOCOMOTIVE (4-6-0) ===================== -->
  <g id="fl-loco">
    <!-- tender/cab back wall -->
    <rect x="588" y="70" width="18" height="110" class="fl-frame"/>

    <!-- CAB -->
    <g class="fl-cab">
      <rect x="600" y="44" width="96" height="140" rx="6" fill="url(#fl-boiler)" stroke="#3a4152"/>
      <rect x="618" y="64" width="60" height="52" rx="6" class="fl-cab-window"/>
      <rect x="600" y="176" width="96" height="14" class="fl-frame"/>
    </g>

    <!-- roof -->
    <rect x="592" y="34" width="116" height="14" rx="4" class="fl-roof"/>

    <!-- BOILER -->
    <rect x="690" y="86" width="196" height="92" rx="30" fill="url(#fl-boiler)" stroke="#3a4152"/>
    <!-- boiler bands -->
    ${[724, 762, 800, 838].map((x) => `<line x1="${x}" y1="88" x2="${x}" y2="176" class="fl-band"/>`).join("")}

    <!-- dome + steam whistle -->
    <path d="M742 86 q18 -30 36 0 z" class="fl-dome"/>
    <rect x="792" y="66" width="10" height="22" rx="3" class="fl-dome"/>

    <!-- SMOKEBOX + chimney at the front -->
    <rect x="874" y="82" width="44" height="100" rx="14" class="fl-smokebox"/>
    <circle cx="896" cy="132" r="15" class="fl-smokebox-door"/>
    <rect x="884" y="40" width="26" height="44" rx="4" class="fl-chimney"/>
    <rect x="878" y="34" width="38" height="12" rx="4" class="fl-chimney"/>

    <!-- headlamp -->
    <circle cx="918" cy="118" r="9" fill="url(#fl-glow)"/>
    <circle cx="918" cy="118" r="5" class="fl-lamp"/>

    <!-- running board / frame -->
    <rect x="600" y="178" width="330" height="12" class="fl-frame"/>
    <!-- cowcatcher -->
    <path d="M930 190 L980 244 L930 244 Z" class="fl-cowcatcher"/>

    <!-- wheels: three drivers + one leading truck -->
    ${drivers.join("")}
    ${leading}

    <!-- connecting rod across the drivers -->
    <line x1="640" y1="${railY - 10}" x2="816" y2="${railY - 10}" class="fl-rod"/>

    <!-- STEAM -->
    <g id="fl-steam" transform="translate(897 30)"></g>
  </g>
</svg>`;
}
