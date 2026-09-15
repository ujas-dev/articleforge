import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * F8 regression guard: every foreground/background pair the UI actually uses
 * must clear WCAG 2.2 AA (4.5:1 for text, 3:1 for control borders). The values
 * are read straight out of src/styles/global.css, so editing the palette
 * without re-checking contrast fails the suite.
 */
const css = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8');

type Rgb = [number, number, number];

function readTheme(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`Selector ${selector} not found in global.css`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  // Strip comments first, and split on the FIRST colon only, so `rgba(...)`
  // values and commented-out declarations cannot confuse the reader.
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens: Record<string, string> = {};
  for (const declaration of body.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator === -1) continue;
    const name = declaration.slice(0, separator).trim();
    if (name.startsWith('--af-')) tokens[name] = declaration.slice(separator + 1).trim();
  }
  return tokens;
}

const THEMES = {
  light: readTheme(':root'),
  dark: readTheme('html.dark')
} as const;

function parseColor(value: string): Rgb {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const channels = value.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/);
  if (channels) return [Number(channels[1]), Number(channels[2]), Number(channels[3])];
  throw new Error(`Cannot parse colour "${value}"`);
}

function token(theme: keyof typeof THEMES, name: string): Rgb {
  const value = THEMES[theme][`--af-${name}`];
  if (!value) throw new Error(`Missing --af-${name} in ${theme}`);
  return parseColor(value);
}

function luminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha-composites `fg` at `alpha` over `bg`, the way the browser does for bg-ink-900/60. */
function composite(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as Rgb;
}

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe.each(['light', 'dark'] as const)('%s theme palette (F8)', (theme) => {
  const pageBg = token(theme, 'page-bg');
  // bg-ink-900/60 cards and bg-ink-900/80 inputs sit on the page background.
  const card = composite(token(theme, 'ink-900'), 0.6, pageBg);
  const field = composite(token(theme, 'ink-900'), 0.8, pageBg);
  const raised = token(theme, 'ink-800');

  it('muted body text meets AA on the page background', () => {
    for (const name of ['ink-300', 'ink-400', 'ink-500'] as const) {
      expect(contrast(token(theme, name), pageBg), `${name} on page`).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });

  it('muted body text meets AA on cards and form fields', () => {
    for (const background of [card, field]) {
      for (const name of ['ink-300', 'ink-400', 'ink-500'] as const) {
        expect(contrast(token(theme, name), background), `${name} on surface`).toBeGreaterThanOrEqual(AA_TEXT);
      }
    }
  });

  it('accent text meets AA on the page background and on cards', () => {
    expect(contrast(token(theme, 'brand-300'), pageBg)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(token(theme, 'brand-300'), card)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('text on a brand button meets AA', () => {
    expect(contrast(token(theme, 'on-brand'), token(theme, 'brand-400'))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('control borders meet the 3:1 non-text requirement', () => {
    expect(contrast(token(theme, 'ink-600'), pageBg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrast(token(theme, 'ink-700'), pageBg), 'ink-700 on page').toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrast(token(theme, 'ink-700'), field), 'ink-700 on field').toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it('card hover surfaces are distinguishable but not inverted', () => {
    expect(luminance(raised)).not.toBe(luminance(token(theme, 'ink-900')));
    expect(contrast(raised, pageBg)).toBeLessThan(contrast(token(theme, 'ink-500'), pageBg));
  });

  it('heading, body, muted and link colours in article prose meet AA', () => {
    for (const name of ['prose-heading', 'prose-body', 'prose-muted', 'link'] as const) {
      expect(contrast(token(theme, name), pageBg), `${name} on page`).toBeGreaterThanOrEqual(AA_TEXT);
    }
    expect(contrast(token(theme, 'prose-body'), card)).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('palettes stay coherent across themes', () => {
  it('inverts the foreground ramp and the surface ramp', () => {
    for (const name of ['ink-50', 'ink-100', 'ink-200', 'ink-300', 'ink-400']) {
      expect(luminance(token('light', name))).toBeLessThan(luminance(token('dark', name)));
    }
    for (const name of ['ink-800', 'ink-900', 'ink-950']) {
      expect(luminance(token('light', name))).toBeGreaterThan(luminance(token('dark', name)));
    }
  });

  it('keeps the brand button colours identical in both themes', () => {
    expect(token('light', 'brand-400')).toEqual(token('dark', 'brand-400'));
    expect(token('light', 'brand-500')).toEqual(token('dark', 'brand-500'));
    expect(token('light', 'on-brand')).toEqual(token('dark', 'on-brand'));
  });

  it('declares the same token names in both themes', () => {
    expect(Object.keys(THEMES.light).sort()).toEqual(Object.keys(THEMES.dark).sort());
  });
});
