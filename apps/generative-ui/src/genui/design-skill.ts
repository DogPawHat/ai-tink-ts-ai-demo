import css from "@/style.css?raw";

/**
 * Design guidance for Open Generative UI widgets. The sandbox iframe can't see
 * the page's CSS variables, so the guidance carries the site's light and dark
 * token values for the widget to declare itself.
 */

const TOKENS = [
  "background",
  "foreground",
  "card",
  "muted",
  "muted-foreground",
  "primary",
  "primary-foreground",
  "border",
  "destructive",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "radius",
];

function tokenValues(block: string) {
  return TOKENS.map((name) => {
    const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(block);
    return match ? `  --${name}: ${match[1]};` : "";
  })
    .filter(Boolean)
    .join("\n");
}

function themeCss(source: string) {
  const light = /^:root \{([^}]*)\}/m.exec(source)?.[1] ?? "";
  const dark =
    /@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}/m.exec(source)?.[1] ?? "";
  return `:root {\n${tokenValues(light)}\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n${tokenValues(dark).replaceAll("\n", "\n  ").replace(/^/, "  ")}\n  }\n}`;
}

export const designSkill = `Style generated UI to match the host site: a quiet, neutral shadcn/ui look.

Start the css with exactly these theme tokens, and use them through var() for every color. Don't use other colors.

${themeCss(css)}

Rules:
- Body: margin 0, background var(--background), color var(--foreground), font-family system-ui, sans-serif, font-size 14px, line-height 1.5.
- Surfaces: cards and panels use background var(--card), a 1px solid var(--border) border, border-radius var(--radius), and padding 12 to 16px. No drop shadows or gradients.
- Text: secondary text uses var(--muted-foreground). Headings are 16px, weight 600. Numbers use font-variant-numeric: tabular-nums.
- Controls: buttons and inputs are 32 to 36px tall with radius calc(var(--radius) - 2px). Primary buttons use var(--primary) with var(--primary-foreground) text; others are outlined with var(--border). Inputs have a var(--border) border and var(--background) fill. Use accent-color: var(--primary) on range inputs and checkboxes.
- Data colors: series and highlights use var(--chart-1) to var(--chart-5) in order.
- The widget must work in light and dark mode; the tokens above switch automatically.
- Layout: fill the width, use CSS grid or flexbox with 12px gaps, and stack to one column below 480px.`;
