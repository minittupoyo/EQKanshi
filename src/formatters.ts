import { WolfxEEWPayload, P2PQuake551Payload } from './types.js';

/**
 * JMA (Japan Meteorological Agency) Seismic Intensity Color Scheme
 */
export function getScaleColor(scale: number | string): string {
  const s = String(scale).trim();
  if (s === '10' || s === '1') return '3c82e6'; // 震度1: 青
  if (s === '20' || s === '2') return '0099ff'; // 震度2: 水色/青
  if (s === '30' || s === '3') return '00c896'; // 震度3: 緑
  if (s === '40' || s === '4') return 'e6b800'; // 震度4: 黄
  if (s === '45' || s === '5-' || s === '5弱') return 'ff9600'; // 震度5弱: 橙
  if (s === '50' || s === '5+' || s === '5強') return 'ff4500'; // 震度5強: 赤橙
  if (s === '55' || s === '6-' || s === '6弱') return 'f02828'; // 震度6弱: 赤
  if (s === '60' || s === '6+' || s === '6強') return 'b40028'; // 震度6強: 深紅
  if (s === '70' || s === '7') return '960078'; // 震度7: 紫
  return '888888';
}

export function colorize(text: string, colorHex: string): string {
  return `$[fg.color=${colorHex} ${text}]`;
}

export function formatScale(scale: number): string {
  switch (scale) {
    case 10: return '震度1';
    case 20: return '震度2';
    case 30: return '震度3';
    case 40: return '震度4';
    case 45: return '震度5弱';
    case 50: return '震度5強';
    case 55: return '震度6弱';
    case 60: return '震度6強';
    case 70: return '震度7';
    default: return '不明';
  }
}

export function formatColoredScale(scale: number): string {
  const text = formatScale(scale);
  const color = getScaleColor(scale);
  return colorize(text, color);
}

export function formatTsunami(domesticTsunami?: string): string {
  switch (domesticTsunami) {
    case 'None':
      return 'この地震による津波の心配はありません。';
    case 'NonEffective':
      return '若干の海面変動が予想されますが、被害の心配はありません。';
    case 'Watch':
      return colorize('⚠️ 津波注意報が発表されています。海岸や河口付近から離れてください。', 'ff9600');
    case 'Warning':
      return colorize('🚨 津波警報または大津波警報が発表されています！ただちに高台へ避難してください！', 'f02828');
    case 'Checking':
      return '津波の影響について調査中です。';
    case 'Unknown':
    default:
      return '津波の有無は不明です。';
  }
}

export function formatP2PIssueType(type: string): string {
  switch (type) {
    case 'ScalePrompt': return '震度速報';
    case 'Destination': return '震源に関する情報';
    case 'ScaleAndDestination': return '震源・震度に関する情報';
    case 'DetailScale': return '各地の震度に関する情報';
    case 'Foreign': return '遠地地震情報';
    default: return '地震情報';
  }
}

/**
 * Format Wolfx EEW Payload to Misskey Note with MFM colors
 */
export function formatWolfxEEW(data: WolfxEEWPayload): string {
  if (data.isCancel) {
    return [
      colorize('ℹ️【緊急地震速報 取消】', '3c82e6'),
      `先ほどの緊急地震速報 (EventID: ${data.EventID || '不明'}) は取り消されました。`,
    ].join('\n');
  }

  const isWarn = Boolean(data.isWarn);
  const rawTitle = isWarn ? '🚨【緊急地震速報（警報）】' : '⚠️【緊急地震速報（予報）】';
  const titleColor = isWarn ? 'f02828' : 'e6b800';
  const titleTag = colorize(rawTitle, titleColor);

  const serialText = data.Serial ? ` (第${data.Serial}報)` : '';
  const finalTag = data.isFinal ? ' [最終報]' : '';

  const hypocenter = data.Hypocenter || '不明';

  let coloredIntensity = '不明';
  if (data.MaxIntensity) {
    const color = getScaleColor(data.MaxIntensity);
    coloredIntensity = colorize(`震度 ${data.MaxIntensity}`, color);
  }

  const mag = (data.Magunitude ?? data.Magnitude);
  const magText = mag !== undefined ? `M${mag}` : '不明';
  const depthText = data.Depth ? `${data.Depth}km` : '不明';
  const timeText = data.AnnouncedTime || (data.timestamp ? new Date(data.timestamp).toLocaleString('ja-JP') : '');

  const lines = [
    `${titleTag}${serialText}${finalTag}`,
    `震源地: ${hypocenter}`,
    `最大予測震度: ${coloredIntensity}`,
    `規模: ${magText}`,
    `深さ: ${depthText}`,
  ];

  if (timeText) {
    lines.push(`発表時刻: ${timeText}`);
  }

  return lines.join('\n');
}

/**
 * Format P2P Quake 551 Payload to Misskey Note with MFM colors
 */
export function formatP2P551(data: P2PQuake551Payload): string {
  const issueTypeName = formatP2PIssueType(data.issue.type);
  const eq = data.earthquake;

  const lines: string[] = [
    colorize(`🌏【地震情報 (${issueTypeName})】`, '0099ff'),
  ];

  if (eq) {
    if (eq.time) {
      lines.push(`発生時刻: ${eq.time}`);
    }
    if (eq.hypocenter && eq.hypocenter.name) {
      const hyp = eq.hypocenter;
      const depthStr = typeof hyp.depth === 'number'
        ? (hyp.depth === 0 ? 'ごく浅い' : hyp.depth > 0 ? `約${hyp.depth}km` : '不明')
        : String(hyp.depth || '不明');
      const magStr = hyp.magnitude !== undefined && hyp.magnitude >= 0 ? `M${hyp.magnitude}` : '不明';
      lines.push(`震源地: ${hyp.name} (深さ: ${depthStr}, 規模: ${magStr})`);
    }
    if (eq.maxScale !== undefined && eq.maxScale >= 0) {
      lines.push(`最大震度: ${formatColoredScale(eq.maxScale)}`);
    }
    if (eq.domesticTsunami) {
      lines.push(`津波情報: ${formatTsunami(eq.domesticTsunami)}`);
    }
  }

  // Format observation points by scale
  if (data.points && data.points.length > 0) {
    lines.push('');
    lines.push('■ 各地の震度');

    // Group points by scale (descending order)
    const pointsByScale: Map<number, Map<string, string[]>> = new Map();

    for (const pt of data.points) {
      if (pt.scale < 10) continue; // ignore less than scale 1
      if (!pointsByScale.has(pt.scale)) {
        pointsByScale.set(pt.scale, new Map());
      }
      const prefMap = pointsByScale.get(pt.scale)!;
      if (!prefMap.has(pt.pref)) {
        prefMap.set(pt.pref, []);
      }
      prefMap.get(pt.pref)!.push(pt.addr);
    }

    const sortedScales = Array.from(pointsByScale.keys()).sort((a, b) => b - a);

    // Limit display to avoid exceeding Misskey character limits
    let scaleCount = 0;
    for (const scale of sortedScales) {
      if (scaleCount >= 6) {
        lines.push(`…その他省略`);
        break;
      }
      scaleCount++;
      const coloredScaleLabel = formatColoredScale(scale);
      lines.push(`[${coloredScaleLabel}]`);
      const prefMap = pointsByScale.get(scale)!;
      for (const [pref, addrs] of prefMap.entries()) {
        const addrStr = addrs.slice(0, 8).join('、') + (addrs.length > 8 ? ` 他` : '');
        lines.push(`  ${pref}: ${addrStr}`);
      }
    }
  }

  return lines.join('\n');
}
