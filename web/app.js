import {parseSpeech, parseReply} from './protocol.js';
const $ = id => document.getElementById(id);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let port, reader, readTask, pending, ready = false, closing = false, listening = false;
let sequence = Math.floor(Math.random() * 100000000), recognition;
let queuedSpeech = '';

function speak(message) {
  if (!$('voiceReply').checked || !window.speechSynthesis) return;
  if (listening) { queuedSpeech = message; return; }
  queuedSpeech = '';
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'zh-TW';
  const voices = window.speechSynthesis.getVoices();
  utterance.voice = voices.find(v => /^zh[-_]TW$/i.test(v.lang)) || voices.find(v => /^zh/i.test(v.lang)) || null;
  utterance.onstart = () => { $('voiceReplyStatus').textContent = '正在播放語音回覆…'; };
  utterance.onend = () => { $('voiceReplyStatus').textContent = '語音回覆播放完成。'; };
  utterance.onerror = event => {
    if (!['canceled', 'interrupted'].includes(event.error)) $('voiceReplyStatus').textContent = '語音播放失敗，請查看文字回饋。';
  };
  try { window.speechSynthesis.speak(utterance); }
  catch { $('voiceReplyStatus').textContent = '語音播放失敗，請查看文字回饋。'; }
}

function outcome(message, error = false) { feedback(message, error); speak(message); }
$('voiceReply').onchange = () => {
  queuedSpeech = ''; window.speechSynthesis?.cancel();
  if ($('voiceReply').checked) speak('語音回覆已開啟');
};
if (!window.speechSynthesis) {
  $('voiceReply').checked = false; $('voiceReply').disabled = true;
  $('voiceReplyStatus').textContent = '此瀏覽器不支援語音回覆，仍可查看文字結果。';
}

function feedback(message, error = false) {
  $('feedback').textContent = message;
  $('feedback').classList.toggle('error', error);
  const item = document.createElement('li');
  item.textContent = `${new Date().toLocaleTimeString()} · ${message}`;
  $('log').prepend(item);
  while ($('log').children.length > 40) $('log').lastChild.remove();
}

function controls() {
  $('connect').disabled = !!port || closing;
  $('disconnect').hidden = !port;
  $('refresh').disabled = !ready || !!pending || listening;
  $('send').disabled = !ready || !!pending || listening;
  $('listen').disabled = !ready || !!pending || !Recognition;
}

function unknown() {
  for (const color of ['blue', 'green']) {
    $(color + 'State').textContent = '未知';
    $(color + 'Orb').classList.remove('on', 'off');
  }
  $('updated').textContent = '目前狀態未知，請重新讀取開發板。';
}

function applyReply(r) {
  for (const color of ['blue', 'green']) {
    $(color + 'State').textContent = r[color] ? '亮起' : '熄滅';
    $(color + 'Orb').classList.toggle('on', r[color]);
    $(color + 'Orb').classList.toggle('off', !r[color]);
  }
  $('updated').textContent = `開發板 GPIO 回報 · ${new Date().toLocaleTimeString()}`;
}

function settle(error, reply) {
  if (!pending) return;
  const p = pending; pending = null; clearTimeout(p.timer);
  if (error) { unknown(); p.reject(error); } else { applyReply(reply); p.resolve(reply); }
  controls();
}

async function receive(selectedPort) {
  reader = selectedPort.readable.getReader();
  const decoder = new TextDecoder(); let buffer = '', dropping = false;
  try {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      for (const char of decoder.decode(value, {stream: true})) {
        if (char === '\n') {
          const r = dropping ? null : parseReply(buffer.trim()); buffer = ''; dropping = false;
          if (r && pending && r.id === pending.id) {
            settle(r.ok ? null : new Error('開發板拒絕此指令。'), r);
          }
        } else if (!dropping) {
          buffer += char;
          if (buffer.length > 512) { buffer = ''; dropping = true; }
        }
      }
    }
  } catch (error) {
    if (!closing) feedback(`序列埠讀取失敗：${error.message}`, true);
  } finally {
    reader.releaseLock(); reader = null;
    if (!closing) {
      ready = false; unknown(); recognition?.abort();
      settle(new Error('開發板連線中斷，執行結果未知。'));
      $('connection').textContent = '連線中斷'; controls();
      // Let this read task finish before closing its port.
      setTimeout(() => disconnect(), 0);
    }
  }
}

function request(command) {
  if (!port?.writable || pending) return Promise.reject(new Error('尚未連線，或上一筆指令仍在執行。'));
  const id = ++sequence;
  const result = new Promise((resolve, reject) => {
    pending = {id, resolve, reject, timer: setTimeout(() => settle(new Error('通訊逾時，執行結果未知；請重新讀取狀態，不會自動重送。')), command.endsWith('_BLINK3') ? 5000 : 3000)};
  });
  controls();
  const writer = port.writable.getWriter();
  writer.write(new TextEncoder().encode(`V1 ${id} ${command}\n`))
    .catch(error => { if (pending?.id === id) settle(new Error(`傳送失敗：${error.message}`)); })
    .finally(() => writer.releaseLock());
  return result;
}

async function disconnect() {
  if (closing) return;
  closing = true; ready = false; recognition?.abort();
  settle(new Error('連線已中斷，執行結果未知。')); unknown(); controls();
  try { await reader?.cancel(); await readTask; await port?.close(); }
  catch (error) { feedback(`關閉序列埠：${error.message}`, true); }
  finally { port = null; closing = false; $('connection').textContent = '尚未連接開發板'; controls(); }
}
$('connect').onclick = async () => {
  $('connect').disabled = true;
  try {
    const selected = await navigator.serial.requestPort();
    await selected.open({baudRate: 115200}); port = selected;
    $('connection').textContent = '正在確認開發板…'; controls();
    readTask = receive(port);
    await request('STATUS'); ready = true;
    $('connection').textContent = '已連接 · AMB82-MINI';
    $('device').textContent = '115200 baud · 已收到韌體 V1 回應';
    $('speechStatus').textContent = Recognition ? '點擊開始說話' : '此瀏覽器不支援語音辨識，請使用電腦版 Chrome';
    feedback('連線成功，已讀取開發板狀態。'); controls();
  } catch (error) {
    feedback(`連線未完成：${error.message}。請確認韌體、USB 與序列埠是否被其他程式占用。`, true);
    await disconnect();
  }
};
$('disconnect').onclick = () => disconnect();
$('refresh').onclick = async () => {
  try { await request('STATUS'); feedback('已重新讀取開發板狀態。'); }
  catch (error) { feedback(error.message, true); }
};

async function execute(text) {
  $('transcript').textContent = text;
  const command = parseSpeech(text);
  if (!command) { outcome('無法辨識為單一控制指令，未傳送，LED 維持原狀。', true); return; }
  if (!ready || pending) { outcome('尚未連線或正在執行其他指令，本次未傳送。', true); return; }
  feedback(`已辨識「${text}」，正在等待開發板確認…`);
  if (command.endsWith('_BLINK3')) {
    unknown(); $('updated').textContent = '閃爍指令執行中，等待完成後的 GPIO 回報。';
  }
  try {
    const r = await request(command);
    const color = command.startsWith('BLUE') ? 'blue' : 'green';
    if (!command.endsWith('_BLINK3') && r[color] !== command.endsWith('_ON')) throw new Error('GPIO 回報與要求不符，請檢查板卡。');
    const name = command.startsWith('BOTH') ? '藍燈與綠燈' : color === 'blue' ? '藍燈' : '綠燈';
    outcome(command.endsWith('_BLINK3') ? `${name}已閃爍三次，並恢復原本狀態。` : `${name}已${r[color] ? '開啟' : '關閉'}。`);
  } catch (error) { outcome(error.message, true); }
}
$('textForm').onsubmit = event => { event.preventDefault(); if (!listening) execute($('text').value); };
if (Recognition) {
  recognition = new Recognition(); recognition.lang = 'zh-TW';
  recognition.continuous = false; recognition.interimResults = false; recognition.maxAlternatives = 1;
  let received = false;
  recognition.onresult = event => {
    if (received) return;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) { received = true; execute(event.results[i][0].transcript); break; }
    }
  };
  recognition.onerror = event => {
    received = true;
    const errors = {'not-allowed':'麥克風權限遭拒，請在網址列允許麥克風。', 'audio-capture':'找不到可用麥克風。', 'network':'語音服務連線失敗，請檢查網路。', 'no-speech':'沒有聽到語音，請再試一次。', 'aborted':'已停止語音辨識。'};
    outcome(errors[event.error] || `語音辨識失敗：${event.error}`, true);
  };
  recognition.onend = () => {
    listening = false; $('listen').classList.remove('listening');
    $('speechStatus').textContent = ready ? '點擊開始說話' : '連接後即可開始說話';
    if (!received) outcome('未收到可辨識語音，未傳送任何指令。', true);
    if (queuedSpeech) speak(queuedSpeech);
    controls();
  };
  $('listen').onclick = () => {
    if (listening) { recognition.abort(); return; }
    try {
      queuedSpeech = ''; window.speechSynthesis?.cancel();
      received = false; recognition.start(); listening = true;
      $('listen').classList.add('listening'); $('speechStatus').textContent = '正在聆聽… 再點一下停止'; controls();
    } catch (error) { feedback(`無法啟動辨識：${error.message}`, true); }
  };
}
if (!navigator.serial || !window.isSecureContext) {
  $('connect').disabled = true;
  feedback('請使用電腦版 Chrome，並透過 http://localhost:8000 開啟此頁面。', true);
}

// Poll only while idle. A missing reply invalidates the displayed states.
setInterval(async () => {
  if (ready && !pending && !listening && !document.hidden) {
    try { await request('STATUS'); } catch (error) { feedback(error.message, true); }
  }
}, 5000);
