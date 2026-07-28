export const ansi = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m',

  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',

  rgb: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,
};

/**
 * Get ANSI RGB color code for terminal output based on JMA Seismic Intensity
 */
export function getAnsiScaleColor(scale: number | string): string {
  const s = String(scale).trim();
  if (s === '10' || s === '1') return ansi.rgb(60, 130, 230);   // 震度1: 青
  if (s === '20' || s === '2') return ansi.rgb(0, 153, 255);    // 震度2: 水色
  if (s === '30' || s === '3') return ansi.rgb(0, 200, 150);    // 震度3: 緑
  if (s === '40' || s === '4') return ansi.rgb(230, 184, 0);    // 震度4: 黄
  if (s === '45' || s === '5-' || s === '5弱') return ansi.rgb(255, 150, 0); // 震度5弱: 橙
  if (s === '50' || s === '5+' || s === '5強') return ansi.rgb(255, 69, 0);  // 震度5強: 赤橙
  if (s === '55' || s === '6-' || s === '6弱') return ansi.rgb(240, 40, 40);  // 震度6弱: 赤
  if (s === '60' || s === '6+' || s === '6強') return ansi.rgb(180, 0, 40);   // 震度6強: 深紅
  if (s === '70' || s === '7') return ansi.rgb(150, 0, 120);   // 震度7: 紫
  return ansi.gray;
}

export function colorizeAnsiScale(scaleText: string, scaleValue: number | string): string {
  const color = getAnsiScaleColor(scaleValue);
  return `${ansi.bold}${color}${scaleText}${ansi.reset}`;
}
