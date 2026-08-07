/**
 * Predefined talas -- ported exactly from
 * CMNT-Notation-Studio-source/src/cmnt/core/Talas.java (itself ported from
 * the Python cmnt/talas.py).
 */
import { Fraction } from "../model/Fraction.js";
import { Gati } from "../model/Gati.js";
import { Tala, TalaPart, TalaSegment, TalaRow } from "../model/Tala.js";

type MarkerSpec = readonly [index: number, gati: number, code: number];
type SegSpec = readonly [num: number, den: number, gati: number];

function row(segs: readonly SegSpec[], durNum: number): TalaRow {
  const list: TalaSegment[] = [];
  for (const s of segs) list.push(new TalaSegment(s[0], s[1], s[2]));
  return new TalaRow(list, Fraction.of(durNum));
}

function standardRow(n: number, gati: number): TalaRow {
  const segs: SegSpec[] = [];
  for (let i = 0; i < n; i++) segs.push([1, 1, gati]);
  return row(segs, n);
}

function make(
  name: string,
  aksharas: number,
  predef: string,
  markers: readonly MarkerSpec[],
  rows: readonly TalaRow[],
  layoutName: string | null,
): Tala {
  const t = new Tala(name, aksharas, predef);
  for (const m of markers) {
    const marker = m[2] === 2 ? Tala.END_MARKER : m[2] === 1 ? Tala.MIDDLE_MARKER : Tala.EMPTY_MARKER;
    t.parts.push(new TalaPart(m[0], m[1], marker));
  }
  t.layoutRows = [...rows];
  t.layoutName = layoutName == null ? "krithi" : layoutName;
  t.defaultGati = t.parts.length === 0 ? Gati.CATUSRA : t.parts[0]!.gati;
  return t;
}

// marker code: 2=END("||"), 1=MIDDLE("|"), 0=EMPTY("")

export function adiTala(gati: number, layout: string | null): Tala {
  const vg = layout === "varnam" || layout === "gitam";
  const name = gati === Gati.CATUSRA ? "Adi" : `Adi - ${gati}`;
  let rows: TalaRow[];
  let markers: MarkerSpec[];
  if (vg) {
    markers = [
      [0, gati, 2],
      [1, gati, 0],
      [2, gati, 0],
      [3, gati, 0],
      [4, gati, 1],
      [5, gati, 0],
      [6, gati, 1],
      [7, gati, 0],
    ];
    rows = [standardRow(8, gati)];
  } else {
    markers = [
      [0, gati, 2],
      [4, gati, 1],
      [6, gati, 1],
    ];
    rows = [
      row(
        [
          [1, 4, gati],
          [1, 2, gati],
          [1, 2, gati],
        ],
        8,
      ),
    ];
  }
  return make(name, 8, `Adi-${gati}`, markers, rows, layout);
}

export function adi2KalaiTala(gati: number, layout: string | null): Tala {
  const markers: MarkerSpec[] = [
    [0, gati, 2],
    [8, gati, 1],
    [12, gati, 1],
  ];
  const rows = [
    row(
      [
        [1, 8, gati],
        [1, 4, gati],
        [1, 4, gati],
      ],
      16,
    ),
  ];
  return make("Adi", 16, `Adi2Kalai-${gati}`, markers, rows, layout);
}

export function ekaTala(laghu: number, gati: number, layout: string | null): Tala {
  const n = laghu === Gati.CATUSRA ? 4 : laghu;
  const name = "Eka" + (laghu !== Gati.CATUSRA ? ` - laghu ${laghu}` : "");
  const vg = layout === "varnam" || layout === "gitam";
  let rows: TalaRow[];
  const markerList: MarkerSpec[] = [[0, gati, 2]];
  if (vg) {
    for (let i = 1; i < n; i++) markerList.push([i, gati, 0]);
    rows = [standardRow(n, gati)];
  } else {
    rows = [
      row(
        [
          [1, n, gati],
          [1, n, gati],
        ],
        2 * n,
      ),
    ];
  }
  return make(name, n, `Eka-${laghu}-${gati}`, markerList, rows, layout);
}

export function rupakaVogueTala(gati: number, layout: string | null): Tala {
  const markers: MarkerSpec[] = [
    [0, gati, 2],
    [1, gati, 1],
  ];
  const vg = layout === "varnam" || layout === "gitam";
  const rows = vg
    ? [standardRow(3, gati)]
    : [
        row(
          [
            [1, 1, gati],
            [1, 2, gati],
            [1, 1, gati],
            [1, 2, gati],
          ],
          6,
        ),
      ];
  return make("Rupaka", 3, `RupakaVogue-${gati}`, markers, rows, layout);
}

export function catusraRupakaTala(laghu: number, gati: number, layout: string | null): Tala {
  const laghuAk = laghu === Gati.CATUSRA ? 4 : laghu;
  const n = laghuAk + 2;
  const markers: MarkerSpec[] = [
    [0, gati, 2],
    [2, gati, 1],
  ];
  const vg = layout === "varnam" || layout === "gitam";
  const rows = vg
    ? [standardRow(n, gati)]
    : [
        row(
          [
            [1, 2, gati],
            [1, laghuAk, gati],
            [1, 2, gati],
            [1, laghuAk, gati],
          ],
          n * 2,
        ),
      ];
  let jati: string;
  switch (laghu) {
    case Gati.TISRA:
      jati = "Tisra";
      break;
    case Gati.KHANDA:
      jati = "Khanda";
      break;
    case Gati.MISRA:
      jati = "Misra";
      break;
    case Gati.SANKIRNA:
      jati = "Sankirna";
      break;
    default:
      jati = "Catusra";
  }
  return make(`${jati} Rupaka`, n, `Rupaka-${laghu}-${gati}`, markers, rows, layout);
}

export function roopakaChapu(gati: number, withInternal: boolean, layout: string | null): Tala {
  const markerList: MarkerSpec[] = [[0, gati, 2]];
  const vg = layout === "varnam" || layout === "gitam";
  let rows: TalaRow[];
  if (withInternal) {
    markerList.push([1, gati, 1]);
    markerList.push([2, gati, 1]);
  }
  if (vg || withInternal) {
    rows = [
      row(
        [
          [1, 1, gati],
          [1, 2, gati],
          [1, 1, gati],
          [1, 2, gati],
        ],
        6,
      ),
    ];
  } else {
    rows = [
      row(
        [
          [1, 3, gati],
          [1, 3, gati],
        ],
        6,
      ),
    ];
  }
  return make("rUpaka (cApu)", 3, `RoopakaChapu-${gati}`, markerList, rows, layout);
}

/**
 * Chapu talas (special 35-tala variants): the cApu anga is always 3 counts
 * (gesture: 3 accounted in the span of 2, one silent). Remaining angas make the
 * jati total — Khanda 5, Misra 7, Sankirna 9. Viloma reverses the anga order.
 *
 *   Khanda  3|2     Viloma 2|3
 *   Misra   3|4     Viloma 4|3   (second anga = 2+2 drutam feel, one bar)
 *   Sankirna 3|2|4  Viloma 2|4|3
 */

/** Misra Chapu: 7 = cApu(3) + drutam(4). Markers 3|4. */
export function misraChapu(layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [3, g, 1],
  ];
  const rows = [
    row(
      [
        [1, 3, g],
        [1, 4, g],
      ],
      7,
    ),
  ];
  return make("Misra Chapu", 7, "MisraChapu", markers, rows, layout);
}

/** Khanda Chapu: 5 = cApu(3) + 2. Markers 3|2. */
export function khandaChapu(fourCycles: boolean, layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [3, g, 1],
  ];
  const cyclesPerRow = fourCycles ? 4 : 2;
  const segs: SegSpec[] = [];
  for (let i = 0; i < cyclesPerRow; i++) {
    segs.push([1, 3, g]);
    segs.push([1, 2, g]);
  }
  const rows = [row(segs, 5 * cyclesPerRow)];
  const predef = fourCycles ? "KhandaChapu" : "KhandaChapu2";
  return make("Khanda Chapu", 5, predef, markers, rows, layout);
}

/** Viloma Misra Chapu: 7, reversed — 4|3. */
export function vilomaMisraChapu(layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [4, g, 1],
  ];
  const rows = [
    row(
      [
        [1, 4, g],
        [1, 3, g],
      ],
      7,
    ),
  ];
  return make("Viloma Misra Chapu", 7, "VilomaMisraChapu", markers, rows, layout);
}

/** Viloma Khanda Chapu: 5, reversed — 2|3. */
export function vilomaKhandaChapu(fourCycles: boolean, layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [2, g, 1],
  ];
  const cyclesPerRow = fourCycles ? 4 : 2;
  const segs: SegSpec[] = [];
  for (let i = 0; i < cyclesPerRow; i++) {
    segs.push([1, 2, g]);
    segs.push([1, 3, g]);
  }
  const rows = [row(segs, 5 * cyclesPerRow)];
  const predef = fourCycles ? "VilomaKhandaChapu" : "VilomaKhandaChapu2";
  return make("Viloma Khanda Chapu", 5, predef, markers, rows, layout);
}

/** Sankirna Chapu: 9 = cApu(3) + 2 + 4. Markers 3|2|4. */
export function sankirnaChapu(layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [3, g, 1],
    [5, g, 1],
  ];
  const rows = [
    row(
      [
        [1, 3, g],
        [1, 2, g],
        [1, 4, g],
      ],
      9,
    ),
  ];
  return make("Sankirna Chapu", 9, "SankirnaChapu", markers, rows, layout);
}

/** Viloma Sankirna Chapu: 9, reversed — 2|4|3. */
export function vilomaSankirnaChapu(layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [2, g, 1],
    [6, g, 1],
  ];
  const rows = [
    row(
      [
        [1, 2, g],
        [1, 4, g],
        [1, 3, g],
      ],
      9,
    ),
  ];
  return make("Viloma Sankirna Chapu", 9, "VilomaSankirnaChapu", markers, rows, layout);
}

export function tisraTriputa(layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [3, g, 1],
    [5, g, 1],
  ];
  const rows = [
    row(
      [
        [1, 3, g],
        [1, 2, g],
        [1, 2, g],
      ],
      7,
    ),
  ];
  return make("tripuTa", 7, "tripuTa", markers, rows, layout);
}

export function khandaTriputa(layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [5, g, 1],
    [7, g, 1],
  ];
  const rows = [
    row(
      [
        [1, 5, g],
        [1, 2, g],
        [1, 2, g],
      ],
      9,
    ),
  ];
  return make("khaNDA tripuTa", 9, "khaNDA tripuTa", markers, rows, layout);
}

export function dhruva(twoRows: boolean, layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [4, g, 1],
    [6, g, 1],
    [10, g, 1],
  ];
  const rows = twoRows
    ? [
        row(
          [
            [1, 4, g],
            [1, 2, g],
          ],
          6,
        ),
        row(
          [
            [1, 4, g],
            [1, 4, g],
          ],
          8,
        ),
      ]
    : [
        row(
          [
            [1, 4, g],
            [1, 2, g],
            [1, 4, g],
            [1, 4, g],
          ],
          14,
        ),
      ];
  return make("dhruva", 14, "dhruva", markers, rows, layout);
}

export function matya(layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [4, g, 1],
    [6, g, 1],
  ];
  const rows = [
    row(
      [
        [1, 4, g],
        [1, 2, g],
        [1, 4, g],
      ],
      10,
    ),
  ];
  return make("matya", 10, "matya", markers, rows, layout);
}

export function ata(layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const vg = layout === "varnam" || layout === "gitam";
  let markers: MarkerSpec[];
  let rows: TalaRow[];
  if (vg) {
    rows = [standardRow(14, g)];
    markers = [
      [0, g, 2],
      [1, g, 0],
      [2, g, 0],
      [3, g, 0],
      [4, g, 0],
      [5, g, 1],
      [6, g, 0],
      [7, g, 0],
      [8, g, 0],
      [9, g, 0],
      [10, g, 1],
      [11, g, 0],
      [12, g, 1],
      [13, g, 0],
    ];
  } else {
    markers = [
      [0, g, 2],
      [5, g, 1],
      [10, g, 1],
      [12, g, 1],
    ];
    rows = [
      row(
        [
          [1, 5, g],
          [1, 5, g],
          [1, 2, g],
          [1, 2, g],
        ],
        14,
      ),
    ];
  }
  return make("aTa", 14, "aTa", markers, rows, layout);
}

export function jhampa(layout: string | null): Tala {
  const g = Gati.CATUSRA;
  const markers: MarkerSpec[] = [
    [0, g, 2],
    [7, g, 1],
    [8, g, 1],
  ];
  const rows = [
    row(
      [
        [1, 7, g],
        [1, 1, g],
        [1, 2, g],
      ],
      10,
    ),
  ];
  return make("jhampa", 10, "jhampa", markers, rows, layout);
}

export function manualTala(layout: string | null): Tala {
  const t = make(
    "manual",
    1000,
    "manual",
    [[0, Gati.CATUSRA, 2]],
    [row([[1, 1000, Gati.CATUSRA]], 1000)],
    layout,
  );
  t.gatiSwitchable = false;
  return t;
}

function normalizeKey(name: string): string {
  // Collapse spaces ("Misra Chapu"); keep underscores (Tisra_Adi) and hyphens (adi-2).
  // English "chapu" (with h) → CMNT "capu".
  const key = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/chapu/g, "capu")
    .replace(/_capu/g, "capu"); // misra_capu → misracapu (keep Tisra_Adi underscores)
  switch (key) {
    case "roopakacapu-2":
      return "roopakacapu2";
    case "rupakacapu-2":
      return "rupakacapu2";
    case "adi-2":
    case "adi-4":
      return "adi";
    case "adi-3":
      return "tisra_adi";
    case "catusra_eka":
      return "eka";
    case "catusra_roopaka":
    case "chatusra_rupaka":
    case "chatusra_roopaka":
    case "rupaka_suladi":
      return "catusra_rupaka";
    case "tisra_roopaka":
      return "tisra_rupaka";
    case "khanda_roopaka":
      return "khanda_rupaka";
    case "misra_roopaka":
      return "misra_rupaka";
    case "sankirna_roopaka":
      return "sankirna_rupaka";
    default:
      return key;
  }
}

/**
 * Chapu talas count TKT / TKDM (etc.) beats as aksharas. DefaultSpeed 0/1/2
 * therefore means 1/2/4 notes per beat — same as Gitam — not the krithi-tier
 * +2 shift (4/8/16 notes per suladi akshara).
 */
export function isChapuTala(tala: Tala | null | undefined): boolean {
  if (tala == null) return false;
  const p = tala.predefName.toLowerCase();
  return p.includes("capu") || p.includes("chapu");
}

/** Extra speed octaves applied for krithi/varnam notation (0 for gitam & chapu). */
export function notationSpeedShift(layout: string | null | undefined, tala: Tala | null | undefined): number {
  if (layout != null && layout.toLowerCase() === "gitam") return 0;
  if (isChapuTala(tala)) return 0;
  return 2;
}

export function fromPredefinedName(name: string, layout: string | null): Tala | null {
  const layoutN = layout == null ? "krithi" : layout.toLowerCase();
  const key = normalizeKey(name);
  switch (key) {
    case "misracapu":
      return misraChapu(layoutN);
    case "vilomamisracapu":
      return vilomaMisraChapu(layoutN);
    case "khandacapu":
      return khandaChapu(true, layoutN);
    case "khandacapu2":
      return khandaChapu(false, layoutN);
    case "vilomakhandacapu":
      return vilomaKhandaChapu(true, layoutN);
    case "vilomakhandacapu2":
      return vilomaKhandaChapu(false, layoutN);
    case "sankirnacapu":
    case "sankeernacapu":
      return sankirnaChapu(layoutN);
    case "vilomasankirnacapu":
    case "vilomasankeernacapu":
      return vilomaSankirnaChapu(layoutN);
    case "triputa":
      return tisraTriputa(layoutN);
    case "khanda_triputa":
      return khandaTriputa(layoutN);
    case "dhruva":
      return dhruva(false, layoutN);
    case "dhruva2":
      return dhruva(true, layoutN);
    case "matya":
      return matya(layoutN);
    case "ata":
      return ata(layoutN);
    case "jhampa":
      return jhampa(layoutN);
    case "manual":
      return manualTala(layoutN);
    case "adi":
      return adiTala(Gati.CATUSRA, layoutN);
    case "adi2kalai":
      return adi2KalaiTala(Gati.CATUSRA, layoutN);
    case "tisra_adi":
      return adiTala(Gati.TISRA, layoutN);
    case "roopakacapu":
    case "rupakacapu":
      return roopakaChapu(Gati.CATUSRA, false, layoutN);
    case "roopakacapu2":
    case "rupakacapu2":
      return roopakaChapu(Gati.CATUSRA, true, layoutN);
    case "eka":
      return ekaTala(Gati.CATUSRA, Gati.CATUSRA, layoutN);
    case "tisra_eka":
      return ekaTala(Gati.TISRA, Gati.CATUSRA, layoutN);
    case "khanda_eka":
      return ekaTala(Gati.KHANDA, Gati.CATUSRA, layoutN);
    case "misra_eka":
      return ekaTala(Gati.MISRA, Gati.CATUSRA, layoutN);
    case "sankirna_eka":
      return ekaTala(Gati.SANKIRNA, Gati.CATUSRA, layoutN);
    case "rupaka":
    case "roopaka":
    case "rupaka_vogue":
    case "roopaka_vogue":
      return rupakaVogueTala(Gati.CATUSRA, layoutN);
    case "catusra_rupaka":
      return catusraRupakaTala(Gati.CATUSRA, Gati.CATUSRA, layoutN);
    case "tisra_rupaka":
      return catusraRupakaTala(Gati.TISRA, Gati.CATUSRA, layoutN);
    case "khanda_rupaka":
      return catusraRupakaTala(Gati.KHANDA, Gati.CATUSRA, layoutN);
    case "misra_rupaka":
      return catusraRupakaTala(Gati.MISRA, Gati.CATUSRA, layoutN);
    case "sankirna_rupaka":
      return catusraRupakaTala(Gati.SANKIRNA, Gati.CATUSRA, layoutN);
    default:
      return null;
  }
}

/** A short anga breakdown for display next to the tala's name, e.g. "L+D+D" for
 *  Adi (laghu+drutam+drutam) -- computed directly from the tala's own marker
 *  structure, so it always matches what's actually drawn as barlines. Segments
 *  of 1 akshara are Anudrutam ("A"), 2 aksharas Drutam ("D"), anything else a
 *  Laghu ("L") of that jati. Returns null if the tala has no marker structure
 *  to derive this from (e.g. a bare Manual tala). */
export function angaBreakdown(tala: Tala): string | null {
  if (tala.parts.length === 0) return null;
  const parts = [...tala.parts].sort((a, b) => a.index - b.index);
  const segs: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const start = parts[i]!.index;
    const end = i + 1 < parts.length ? parts[i + 1]!.index : tala.aksharaCount;
    const len = end - start;
    if (len <= 0) continue;
    segs.push(len === 1 ? "A" : len === 2 ? "D" : "L");
  }
  return segs.length === 0 ? null : segs.join("+");
}

/** Names offered in the UI tala picker. */
export const TALA_NAMES: readonly string[] = [
  "Adi",
  "Adi2Kalai",
  "Tisra_Adi",
  "Rupaka",
  "Catusra_Rupaka",
  "Tisra_Rupaka",
  "RoopakaCapu",
  "RoopakaCapu-2",
  "MisraCapu",
  "VilomaMisraCapu",
  "KhandaCapu",
  "KhandaCapu2",
  "VilomaKhandaCapu",
  "VilomaKhandaCapu2",
  "SankirnaCapu",
  "VilomaSankirnaCapu",
  "Eka",
  "Tisra_Eka",
  "Khanda_Eka",
  "Misra_Eka",
  "Sankirna_Eka",
  "Triputa",
  "Khanda_Triputa",
  "Dhruva",
  "Dhruva2",
  "Matya",
  "Ata",
  "Jhampa",
  "Manual",
];
