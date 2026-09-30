export function parseSpeech(text) {
  const normalized = text.trim().replace(/[\s，。！？、,.!?]/gu, '').replaceAll('边', '邊').replaceAll('灯', '燈').replaceAll('开', '開').replaceAll('关', '關').replaceAll('蓝', '藍').replaceAll('绿', '綠').replaceAll('闪', '閃').replaceAll('烁', '爍').replaceAll('3', '三');
  return new Map([
    ['左邊開燈', 'BLUE_ON'], ['藍燈開燈', 'BLUE_ON'], ['開藍燈', 'BLUE_ON'],
    ['左邊關燈', 'BLUE_OFF'], ['藍燈關燈', 'BLUE_OFF'], ['關藍燈', 'BLUE_OFF'],
    ['右邊開燈', 'GREEN_ON'], ['綠燈開燈', 'GREEN_ON'], ['開綠燈', 'GREEN_ON'],
    ['右邊關燈', 'GREEN_OFF'], ['綠燈關燈', 'GREEN_OFF'], ['關綠燈', 'GREEN_OFF'],
    ['左邊閃爍三次', 'BLUE_BLINK3'], ['藍燈閃爍三次', 'BLUE_BLINK3'],
    ['右邊閃爍三次', 'GREEN_BLINK3'], ['綠燈閃爍三次', 'GREEN_BLINK3'],
    ['閃爍三次', 'BOTH_BLINK3'], ['全部閃爍三次', 'BOTH_BLINK3'],
  ]).get(normalized) ?? null;
}

export function parseReply(line) {
  try {
    const r = JSON.parse(line);
    if (r.protocol !== 1 || r.board !== 'AMB82-MINI' || !Number.isInteger(r.id) || r.id <= 0 ||
        typeof r.ok !== 'boolean' || typeof r.blue !== 'boolean' || typeof r.green !== 'boolean') return null;
    return r;
  } catch { return null; }
}
