import { WolfxDeduper, P2PDeduper } from '../src/dedupe.js';
import { formatWolfxEEW, formatP2P551, formatScale, getScaleColor } from '../src/formatters.js';

let failedTests = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
  } else {
    console.error(`[FAIL] ${testName}`);
    failedTests++;
  }
}

console.log('=== Running Unit Tests for Deduplication & Formatter ===\n');

// --- Test WolfxDeduper (Deferred initial alert test) ---
const wolfxDeferred = new WolfxDeduper();

const reportNoIntensity = {
  type: 'jma_eew',
  Title: '緊急地震速報（予報）',
  EventID: '20260728180000',
  Serial: 1,
  Hypocenter: '伊豆大島近海',
  MaxIntensity: '', // Unknown/empty max intensity in 1st report
  Magunitude: 3.8,
  Depth: 10,
  isWarn: false,
};

// 1st report without intensity -> skipped waiting for intensity
const resDeferred1 = wolfxDeferred.checkAndValidate(reportNoIntensity);
assert(!resDeferred1.valid && resDeferred1.reason?.includes('MaxIntensity not available yet'), '1st report without MaxIntensity skipped');

// 2nd report with intensity -> accepted as initial alert!
const reportWithIntensity = {
  ...reportNoIntensity,
  Serial: 2,
  MaxIntensity: '3',
  Magunitude: 3.8,
};
const resDeferred2 = wolfxDeferred.checkAndValidate(reportWithIntensity);
assert(resDeferred2.valid && resDeferred2.data?.Serial === 2, '2nd report with MaxIntensity accepted as initial alert');
wolfxDeferred.recordSentNote('20260728180000', 'note_id_123456', reportWithIntensity as any);

// 3rd report with SAME intensity & magnitude -> skipped
const reportNoChange = {
  ...reportNoIntensity,
  Serial: 3,
  MaxIntensity: '3',
  Magunitude: 3.8,
};
const resDeferred3 = wolfxDeferred.checkAndValidate(reportNoChange);
assert(!resDeferred3.valid && resDeferred3.reason?.includes('No change in MaxIntensity or Magnitude'), '3rd report with no change skipped');

// 4th report with CHANGED MaxIntensity (3 -> 4) -> accepted as intermediate update!
const reportIntensityChanged = {
  ...reportNoIntensity,
  Serial: 4,
  MaxIntensity: '4',
  Magunitude: 3.8,
};
const resDeferredChange = wolfxDeferred.checkAndValidate(reportIntensityChanged);
assert(resDeferredChange.valid && resDeferredChange.data?.Serial === 4, '4th report with changed MaxIntensity (3 -> 4) accepted');
wolfxDeferred.recordSentNote('20260728180000', 'note_id_123456', reportIntensityChanged as any);

// 5th report with CHANGED Magnitude (3.8 -> 4.5) -> accepted as intermediate update!
const reportMagChanged = {
  ...reportNoIntensity,
  Serial: 5,
  MaxIntensity: '4',
  Magunitude: 4.5,
};
const resDeferredMagChange = wolfxDeferred.checkAndValidate(reportMagChanged);
assert(resDeferredMagChange.valid && resDeferredMagChange.data?.Serial === 5, '5th report with changed Magnitude (3.8 -> 4.5) accepted');
wolfxDeferred.recordSentNote('20260728180000', 'note_id_123456', reportMagChanged as any);

// 6th report (final) -> accepted as final alert!
const reportFinal = {
  ...reportNoIntensity,
  Serial: 6,
  MaxIntensity: '4',
  Magunitude: 4.5,
  isFinal: true,
};
const resDeferred6 = wolfxDeferred.checkAndValidate(reportFinal);
assert(resDeferred6.valid && resDeferred6.data?.isFinal === true, '6th report accepted as final alert');

// Test noteId recording & retrieval for renoteId
wolfxDeferred.recordNoteId('20260728180000', 'note_id_123456');
assert(wolfxDeferred.getFirstNoteId('20260728180000') === 'note_id_123456', 'firstNoteId successfully recorded and retrieved');

const eewReport1 = {
  type: 'jma_eew',
  Title: '緊急地震速報（予報）',
  EventID: '20260728170000',
  Serial: 1,
  Hypocenter: '千葉県東方沖',
  MaxIntensity: '3',
  Magunitude: 4.5,
  Depth: 30,
  isWarn: false,
};

// --- Test P2PDeduper ---
const p2pDeduper = new P2PDeduper();

// 1. Non-551 code check
const p2p552 = { code: 552, id: 'id123', time: '2026/07/28 17:00:00' };
const p2p552Res = p2pDeduper.checkAndValidate(p2p552);
assert(!p2p552Res.valid && p2p552Res.reason?.includes('Ignored non-551 code'), 'P2P non-551 code filtered');

// 2. Valid 551 code check
const p2p551Valid = {
  code: 551,
  id: '551_test_id_001',
  time: '2026/07/28 17:00:00',
  issue: {
    time: '2026/07/28 17:00:00',
    type: 'ScalePrompt',
    correct: 'None',
  },
  earthquake: {
    time: '2026/07/28 16:59:00',
    maxScale: 40,
    domesticTsunami: 'None',
    hypocenter: {
      name: '茨城県南部',
      latitude: 36.1,
      longitude: 140.1,
      depth: 50,
      magnitude: 4.8,
    },
  },
  points: [
    { pref: '茨城県', addr: '水戸市', scale: 40, isScaleAfterprepare: false },
    { pref: '茨城県', addr: 'つくば市', scale: 30, isScaleAfterprepare: false },
  ],
};

const p2pRes1 = p2pDeduper.checkAndValidate(p2p551Valid);
assert(p2pRes1.valid && p2pRes1.data?.id === '551_test_id_001', 'P2P 551 valid payload accepted');

// Duplicate 551 id
const p2pResDup = p2pDeduper.checkAndValidate(p2p551Valid);
assert(!p2pResDup.valid && p2pResDup.reason?.includes('Duplicate id'), 'P2P 551 duplicate id blocked');

// --- Test Formatters & Colors ---
assert(formatScale(40) === '震度4', 'Scale 40 maps to 震度4');
assert(formatScale(45) === '震度5弱', 'Scale 45 maps to 震度5弱');
assert(formatScale(70) === '震度7', 'Scale 70 maps to 震度7');

assert(getScaleColor(40) === 'e6b800', 'Scale 40 color maps to JMA Yellow (e6b800)');
assert(getScaleColor(45) === 'ff9600', 'Scale 45 color maps to JMA Orange (ff9600)');
assert(getScaleColor(50) === 'ff4500', 'Scale 50 color maps to JMA Red-Orange (ff4500)');
assert(getScaleColor(70) === '960078', 'Scale 70 color maps to JMA Purple (960078)');

const wolfxText = formatWolfxEEW(eewReport1);
assert(wolfxText.includes('千葉県東方沖') && wolfxText.includes('震度 3') && !wolfxText.includes('#'), 'Wolfx formatter outputs hypocenter and scale without hashtags');

const p2pText = formatP2P551(p2p551Valid as any);
assert(p2pText.includes('震度速報') && p2pText.includes('茨城県: 水戸市') && !p2pText.includes('#'), 'P2P formatter outputs scale prompt and points without hashtags');

console.log('\n-----------------------------------------------');
if (failedTests === 0) {
  console.log('SUCCESS: All unit tests passed!');
  process.exit(0);
} else {
  console.error(`FAILURE: ${failedTests} test(s) failed.`);
  process.exit(1);
}
