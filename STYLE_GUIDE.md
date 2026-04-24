# TackEff Visual Style Guide

The source of truth is `static/styles.css` (the dashboard palette) and
`static/admin.css` (the editing surfaces). This document translates those
CSS tokens into forms usable by HTML, PowerPoint (PPTX), and Word (DOCX).

The look is **dark-mode-first, command-center**: near-black cool-gray
surfaces, a single bright accent (electric blue), and four status colors
(green / amber / red / blue) used consistently across every view.

---

## 1. Color palette

CSS uses `oklch()` for perceptual consistency. The **hex** column is a pre-
computed sRGB equivalent — use it anywhere `oklch()` is not supported
(Office, most email clients, Figma < 116, etc.).

### 1.1 Surfaces (dark UI)

| Token        | Hex       | RGB                | Usage                                     |
|--------------|-----------|--------------------|-------------------------------------------|
| `--bg-0`     | `#090E12` | 9, 14, 18          | Page / canvas background                  |
| `--bg-1`     | `#12171C` | 18, 23, 28         | Cards, panels, inputs                     |
| `--bg-2`     | `#1A2026` | 26, 32, 38         | Card headers, inset fields, hover wells   |
| `--bg-3`     | `#232A30` | 35, 42, 48         | Elevated chips, slider tracks             |
| `--line`     | `#2D343A` | 45, 52, 58         | Primary border (1 px)                     |
| `--line-soft`| `#1F252B` | 31, 37, 43         | Soft divider / grid gap                   |

### 1.2 Text

| Token    | Hex       | RGB            | Usage                                         |
|----------|-----------|----------------|-----------------------------------------------|
| `--fg-0` | `#F6F9FB` | 246, 249, 251  | Primary headings, key numbers                 |
| `--fg-1` | `#C0C5C9` | 192, 197, 201  | Body text, input values                       |
| `--fg-2` | `#82878C` | 130, 135, 140  | Secondary / metadata                          |
| `--fg-3` | `#53595F` | 83, 89, 95     | Tertiary / field labels / placeholders        |

### 1.3 Accent + status

| Token      | Hex       | RGB             | Meaning                                |
|------------|-----------|-----------------|----------------------------------------|
| `--accent` | `#07ACFF` | 7, 172, 255     | Brand accent (electric blue)           |
| `--ok`     | `#5FD37F` | 95, 211, 127    | On track / healthy                     |
| `--warn`   | `#FAB72A` | 250, 183, 42    | Tight / at risk                        |
| `--bad`    | `#FF5F5B` | 255, 95, 91     | Over budget / behind                   |
| `--done`   | `#4DACF6` | 77, 172, 246    | Delivered / complete (cooler blue)     |
| `--idle`   | `#44484C` | 68, 72, 76      | Not started / disabled                 |

### 1.4 "Soft" variants (badges, hover tints)

In CSS these are `oklch(... / 0.14)` overlays — compositing the accent or
status color at **~14% opacity** on the current background.
For Office documents, where additive alpha isn't ergonomic, use these
pre-blended fills on top of `--bg-1` (`#12171C`):

| Derived from | Fill on `#12171C` |
|--------------|-------------------|
| accent       | `#132433`         |
| ok           | `#172B1E`         |
| warn         | `#2B2619`         |
| bad          | `#2B1B1A`         |
| done         | `#192634`         |

### 1.5 Calendar/category accents (secondary hues)

Used for the 5 iCal categories. Reusable anywhere you need up to 5
distinguishable stripes.

| Cat | Role       | Hex       |
|-----|------------|-----------|
| 1   | Sync       | `#07ACFF` (accent) |
| 2   | Review     | `#5FD37F` (ok)     |
| 3   | External   | `#FAB72A` (warn)   |
| 4   | Field      | `#FF5F5B` (bad)    |
| 5   | Offsite    | `#D080E2` (magenta)|

### 1.6 Print / light-mode equivalents

For printed DOCX and light-template PPTX, keep the **accent + status**
palette (it's tuned to remain legible on white) and swap surfaces:

| Dark token         | Light equivalent            |
|--------------------|-----------------------------|
| `--bg-0` page      | `#FFFFFF`                   |
| `--bg-1` card      | `#F6F8FA`                   |
| `--bg-2` card head | `#EAEEF2`                   |
| `--line`           | `#D0D7DE`                   |
| `--line-soft`      | `#E3E7EC`                   |
| `--fg-0` heading   | `#0B1116`                   |
| `--fg-1` body      | `#3A434C`                   |
| `--fg-2` meta      | `#5C656E`                   |
| `--fg-3` label     | `#8A93A0`                   |

---

## 2. Typography

### 2.1 Families

| Role       | Primary          | Office-safe fallback stack                     |
|------------|------------------|------------------------------------------------|
| Sans       | **Inter Tight**  | Inter → Segoe UI → Calibri → system-ui         |
| Monospace  | **JetBrains Mono**| Consolas → "Cascadia Mono" → Menlo → monospace|

Inter Tight and JetBrains Mono are both freely licensed (OFL). Install
them on any workstation producing PPTX/DOCX templates; for untrusted
distribution embed them, or fall back to **Segoe UI** (sans) and
**Consolas** (mono), which ship with Windows/Office.

### 2.2 Scale

Web sizes use the 3840×2160 canvas. For normal-density screens and Office
docs, divide web px by 2 to approximate — the "pt" column already does
that. Use tabular numerals (`font-variant-numeric: tabular-nums`) for any
metric/KPI.

| Role                  | Web   | Office pt | Weight | Tracking | Case    |
|-----------------------|-------|-----------|--------|----------|---------|
| View title (display)  | 72 px | 36 pt     | 500    | -2%      | Mixed   |
| Section heading       | 32 px | 16 pt     | 500    | -1%      | Mixed   |
| Card title            | 22 px | 11 pt     | 500    | 0        | Mixed   |
| Body                  | 15 px | 10 pt     | 400    | 0        | Mixed   |
| Label (mono)          | 13 px | 9 pt      | 400    | +22%     | UPPER   |
| Caption / metadata    | 12 px | 8 pt      | 400    | +18%     | UPPER   |
| Big metric number     | 54 px | 28 pt     | 400    | -2%      | —       |

**Italic ≠ emphasis.** The brand mark renders `<em>` as *non-italic
accent-colored* text (see `.gh-brand em` etc.). Reproduce in Office by
coloring the run `#07ACFF` with weight 400 instead of italicizing.

### 2.3 Numeric display

Large numbers (countdown days, overall %, done/total counts) are always
**monospace, tabular, weight 500**, often with a subtle accent-color
glow in the web UI (`text-shadow: 0 0 32px var(--accent)` — drop this
for print).

---

## 3. Spacing and layout

The design uses a 4 px base unit on the web canvas (8 px doubled for
4K). For Office docs, a **6 pt** base works well.

| Token               | Web   | Office |
|---------------------|-------|--------|
| Tight (inline)      | 8 px  | 4 pt   |
| Compact             | 12 px | 6 pt   |
| Default             | 18 px | 9 pt   |
| Roomy (section gap) | 28 px | 14 pt  |
| Panel outer padding | 48 px | 18 pt  |

### 3.1 Page-level (HTML)

- Canvas padding: `48 px 64 px` (top/bottom / left/right).
- Header strip height: 140 px (web) — ~0.75" in slides.
- Footer strip height: 100 px (web) — ~0.55" in slides.

### 3.2 Cards / panels

- Background: `--bg-1`
- Border: 1 px solid `--line-soft`
- Inner padding: 20–28 px (web) / 10–14 pt (print)
- Header row: `--bg-2` fill, 18–22 px padding, bottom border `--line-soft`
- Gap between cards in a grid: 2 px (tight separator) or 18 px (breathing)
  — the dashboard uses 2 px inside matrices and 18 px between stand-alone
  cards.

### 3.3 Grids

- Project Status matrix: `280 px | repeat(9, 1fr) | 200 px`, 2 px gap,
  rows equal height.
- Capability cards: `repeat(3, 1fr)`, 20 px gap.
- Calendar: 7 columns, rows equal height, 2 px gap on `--line-soft`.

---

## 4. Component patterns

All patterns share: 1 px borders, sharp corners (no border-radius), the
"mono-upper label + mixed-case value" rhythm, and the single-accent rule
(one accent color per view; status colors are reserved for status).

### 4.1 Buttons

| Variant   | Border      | Background   | Text color  | Notes             |
|-----------|-------------|--------------|-------------|-------------------|
| Default   | `--line`    | `--bg-1`     | `--fg-1`    | Hover → accent border + `--fg-0` |
| Accent    | `--accent`  | `#132433`    | `--fg-0`    | "Soft" ghost accent               |
| Primary   | `--accent`  | `--accent`   | `#090E12`   | Solid; weight 600                  |
| Danger    | `--line`    | `--bg-1`     | `--fg-1`    | Hover → `--bad` border + text     |

Padding: `10 px 18 px` / `14 px 22 px` (large). Font: mono, 12 px, +22%
tracking, UPPER.

### 4.2 Status chip / dot

A 10 px circle with a 0–10 px glow (`box-shadow: 0 0 10px <color>`) and
optional upper-mono label in the status color. For print, drop the glow —
a solid colored dot + text is enough.

### 4.3 Progress bar

- Track: 6–10 px high, `--bg-2` fill, 1 px `--line` border.
- Fill: solid color (accent or status). On the web, add
  `box-shadow: 0 0 10px <fill>` for the neon feel — omit for print.
- Pair with a mono tabular-% label aligned to the right.

### 4.4 Tab bar (admin)

- Container: 1 px `--line`, `--bg-0` background, 4 px inner padding.
- Tab: transparent default, `--fg-2` text. Active: `#132433` fill,
  `--fg-0` text, `inset 0 -2px 0 --accent` underline.

### 4.5 Tables / matrices

- Background: `--line-soft` (acts as the gridline color).
- Cell background: `--bg-1`; gap between cells: 2 px (so the
  `--line-soft` below shows through as a hairline divider).
- Header row: `--bg-2` fill, mono +18% tracking UPPER, `--fg-2` text.

### 4.6 Header strip

Gradient `#1A2026 → #12171C @ 60%`, 1 px bottom border `--line-soft`,
brand on the left (square logo mark + uppercase wordmark), view title in
the center (mono), live status + clock on the right. Translates well to
slide masters.

---

## 5. PowerPoint (PPTX) template

**Slide size:** widescreen 16:9, 13.333" × 7.5".
**Page background:** solid `#090E12`.
**Default text color:** `#F6F9FB`.

### 5.1 Slide master

- Top band: 0.7" tall, fill `#1A2026`, no border; 1 pt rule `#1F252B` at
  its bottom edge.
- Bottom band: 0.5" tall, same fill + top rule.
- Content area: 0.5" inset on every side inside the bands.

### 5.2 Brand mark (reusable group)

- Square frame 0.45" × 0.45", 1.5 pt line `#07ACFF`, fill `#132433`.
- Inner filled square 0.15" × 0.15", fill `#07ACFF`.
- Wordmark to the right: "Tack" + "Eff" (accent color) + " · " + module name,
  mono or sans, 14 pt, +24% tracking, UPPERCASE.

### 5.3 Title slide

- Big display: 48–60 pt, weight 500, tracking -2%, `#F6F9FB`.
- Sub-title one line below: mono, 14 pt, tracking +22%, UPPER, `#53595F`.
- Optional subtle horizontal rule `#1F252B`, 1 pt, beneath the title.

### 5.4 Metric card

- Rectangle fill `#12171C`, 0.75 pt line `#1F252B`.
- Label: top-left, mono 9 pt, tracking +26%, UPPER, `#53595F`.
- Value: 28–36 pt, weight 500, tabular, `#F6F9FB`; accent portions in
  `#07ACFF` (non-italic).
- Progress bar: 4 pt high, 1 pt `#2D343A` border, fill in `#07ACFF` / status.

### 5.5 Status callout

- Pill: 1 pt border in the status color, fill = blended soft variant
  (`#132433` / `#172B1E` / `#2B2619` / `#2B1B1A`).
- Dot: 6 pt diameter, same status color, no shadow.
- Label: mono 10 pt, +22% tracking, UPPER, same status color.

### 5.6 Theme colors (Office "Design → Variants → Colors")

Define a custom theme so chart colors match:

| Theme slot | Hex       |
|------------|-----------|
| Background 1 | `#090E12` |
| Text 1       | `#F6F9FB` |
| Background 2 | `#1A2026` |
| Text 2       | `#C0C5C9` |
| Accent 1     | `#07ACFF` |
| Accent 2     | `#5FD37F` |
| Accent 3     | `#FAB72A` |
| Accent 4     | `#FF5F5B` |
| Accent 5     | `#4DACF6` |
| Accent 6     | `#D080E2` |
| Hyperlink    | `#07ACFF` |
| Followed link| `#4DACF6` |

---

## 6. Word (DOCX) template

Most DOCX output goes on white paper. Use the light-mode surface swaps
from §1.6, keep the accent + status colors. Page size US Letter or A4,
margins 1" / 2.5 cm.

### 6.1 Paragraph styles

| Style name         | Base | Font            | Size | Weight | Color     | Spacing before/after | Notes                         |
|--------------------|------|-----------------|------|--------|-----------|----------------------|-------------------------------|
| Title              | —    | Inter Tight     | 28 pt| 500    | `#0B1116` | 0 / 18 pt            | Tracking -2%                  |
| Heading 1          | —    | Inter Tight     | 18 pt| 500    | `#0B1116` | 18 / 6 pt            | 1 pt bottom border `#E3E7EC`  |
| Heading 2          | —    | Inter Tight     | 14 pt| 500    | `#0B1116` | 14 / 4 pt            |                               |
| Heading 3 (label)  | —    | JetBrains Mono  | 9 pt | 400    | `#5C656E` | 10 / 2 pt            | Letter-spacing +22%, UPPER    |
| Body               | —    | Inter Tight     | 10 pt| 400    | `#3A434C` | 0 / 6 pt             | Line height 1.4               |
| Caption            | —    | JetBrains Mono  | 8 pt | 400    | `#8A93A0` | 0 / 4 pt             | +18% tracking, UPPER          |
| Code               | —    | JetBrains Mono  | 9 pt | 400    | `#0B1116` | 0 / 6 pt             | `#F6F8FA` shading             |
| Status-OK / -Warn / -Bad / -Done | Body | JetBrains Mono | 9 pt | 500 | status hex | 0 / 0 | Pair with a colored leading dot |

### 6.2 Tables

- Grid lines: 0.5 pt `#D0D7DE`.
- Header row: fill `#EAEEF2`, mono 9 pt +22% UPPER `#5C656E`.
- Body rows: white, 10 pt body, no banding (preserve the sparse feel).
- Emphasis cells: fill the cell with the corresponding soft variant
  (`#E7F4FE` for accent, `#E8F6EC` for ok, `#FBF1DB` for warn,
  `#FCE3E2` for bad) — use these light tints on white, *not* the dark-
  blended ones from §1.4.

---

## 7. Iconography and decoration

- **No border-radius.** Everything is sharp-cornered rectangles.
- **1 px hairlines**, never thicker unless signalling emphasis (2 px
  accent underline on active tab, 2 px accent frame on active card).
- **Mono labels lead values**: every data cell is
  `<mono upper label>` on top of `<mixed-case value>`.
- **Glows are optional decoration.** On-screen only. Never print them.
- **One accent per view.** Don't mix `--accent` and `--done` as "two
  blues" — if you need a second cool hue, use category 5 magenta
  `#D080E2` or reduce the accent to `--accent-dim` `#2677B2`.

---

## 8. Accessibility quick reference

Contrast ratios on the dark canvas (`#090E12`):

| Foreground   | Ratio  | WCAG        |
|--------------|--------|-------------|
| `--fg-0` text| 17.9 : 1 | AAA body  |
| `--fg-1` text| 11.2 : 1 | AAA body  |
| `--fg-2` text|  5.3 : 1 | AA body   |
| `--fg-3` text|  2.7 : 1 | **Large text / decorative only** |
| `--accent`   |  7.9 : 1 | AAA body  |
| `--ok`       | 12.1 : 1 | AAA body  |
| `--warn`     | 13.6 : 1 | AAA body  |
| `--bad`      |  6.4 : 1 | AA body   |

Do not pair `--fg-3` with `--bg-0` for running text — it's a decorative
label tone. Do not pair body-size status text with the matching *soft*
fill; keep status text on `--bg-0`/`--bg-1`.
