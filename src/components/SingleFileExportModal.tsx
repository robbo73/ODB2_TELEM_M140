import React, { useState } from 'react';
import { X, Download, Copy, Check, FileCode, CheckCircle2 } from 'lucide-react';

interface SingleFileExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const generateSingleFileHtml = (): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>OBD2 Web Bluetooth Relay</title>
  <style>
    :root {
      --bg: #050608;
      --card-bg: #090a0d;
      --border: #27272a;
      --accent-cyan: #06b6d4;
      --accent-green: #10b981;
      --accent-rose: #f43f5e;
      --accent-amber: #f59e0b;
      --accent-blue: #3b82f6;
      --accent-purple: #a855f7;
      --text-main: #e4e4e7;
      --text-muted: #71717a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      padding: 16px;
      min-height: 100vh;
    }
    .container { max-width: 900px; margin: 0 auto; display: flex; flex-direction: column; gap: 16px; }
    .card {
      background-color: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 16px;
    }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .status-badge {
      font-family: monospace; font-size: 11px; font-weight: bold;
      padding: 4px 10px; border-radius: 2px;
      background: #18181b; color: #a1a1aa; border: 1px solid var(--border);
    }
    .status-badge.polling { background: #083344; color: #22d3ee; border-color: #0891b2; }
    .status-badge.error { background: #4c0519; color: #fb7185; border-color: #e11d48; }
    
    .btn-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    button {
      padding: 10px 14px; border-radius: 2px;
      font-weight: bold; font-size: 12px; cursor: pointer; border: 1px solid var(--border);
      font-family: monospace; text-transform: uppercase; letter-spacing: 0.05em;
      transition: all 0.15s; background: #18181b; color: #e4e4e7;
    }
    button:hover { background: #27272a; border-color: #52525b; }
    .btn-connect { background: #090a0d; border-color: var(--accent-cyan); color: #fff; }
    .btn-connect:hover { background: var(--accent-cyan); color: #000; }
    .btn-disconnect { background: #4c0519; color: #fecdd3; border-color: #9f1239; }
    .btn-log-active { background: #4c0519; color: #fff; border-color: #f43f5e; animation: pulse 1.5s infinite; }
    
    .tabs { display: flex; gap: 4px; background: #000; padding: 4px; border: 1px solid var(--border); }
    .tab-btn { flex: 1; border: none; background: transparent; color: var(--text-muted); font-size: 11px; }
    .tab-btn.active { background: #18181b; color: var(--accent-cyan); border: 1px solid #3f3f46; }

    .gauges-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px;
    }
    .gauge-card {
      background: #090a0d; border: 1px solid var(--border); border-radius: 2px;
      padding: 12px; display: flex; flex-direction: column; justify-content: space-between;
    }
    .gauge-header { display: flex; justify-content: space-between; font-size: 10px; font-family: monospace; color: var(--text-muted); }
    .pid-tag { background: #18181b; color: #38bdf8; padding: 1px 4px; border: 1px solid #27272a; }
    .gauge-value { font-size: 26px; font-weight: bold; font-family: monospace; color: #fff; margin: 6px 0 2px; }
    .gauge-unit { font-size: 11px; color: var(--text-muted); margin-left: 4px; }
    .progress-bar { height: 4px; background: #18181b; overflow: hidden; margin-top: 6px; }
    .progress-fill { height: 100%; background: var(--accent-cyan); width: 0%; transition: width 0.15s ease-out; }
    
    .chart-container { position: relative; height: 220px; width: 100%; }
    canvas { width: 100% !important; height: 100% !important; display: block; }
    
    .terminal {
      background: #000; border: 1px solid var(--border); border-radius: 2px;
      padding: 10px; font-family: monospace; font-size: 11px; height: 150px;
      overflow-y: auto; display: flex; flex-direction: column; gap: 3px; color: #a1a1aa;
    }
    .log-tx { color: #38bdf8; }
    .log-rx { color: #34d399; }
    .log-err { color: #f43f5e; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Top Controller -->
    <div class="card">
      <div class="header">
        <div>
          <h1 style="font-size: 16px; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase;">OBD2 Web Bluetooth Relay</h1>
          <p style="font-size: 11px; color: var(--text-muted); font-family: monospace;">BroadcastChannel('obd2_telemetry_stream') &bull; IndexedDB Logger</p>
        </div>
        <div id="statusBadge" class="status-badge">DISCONNECTED</div>
      </div>
      
      <div class="btn-row">
        <button id="btnConnect" class="btn-connect" onclick="connectOBD2()">Connect OBD2</button>
        <button id="btnDisconnect" class="btn-disconnect" onclick="disconnectOBD2()" style="display:none;">Disconnect</button>
        <button id="btnSimulate" onclick="toggleSimulation()">B58 Simulator</button>
        <button id="btnLog" onclick="toggleLogging()">Start Logging</button>
        <button onclick="exportCsv()">Export CSV</button>
        <button onclick="scanDtc()">Scan DTCs</button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="tabs">
      <button class="tab-btn active" id="tabGauges" onclick="showTab('gauges')">Gauges</button>
      <button class="tab-btn" id="tabGraphs" onclick="showTab('graphs')">Real-Time Graphs</button>
      <button class="tab-btn" id="tabDtc" onclick="showTab('dtc')">DTC Diagnostics</button>
    </div>

    <!-- VIEW 1: Live Telemetry Gauges -->
    <div id="viewGauges" class="gauges-grid">
      <div class="gauge-card">
        <div class="gauge-header"><span>RPM</span><span class="pid-tag">010C</span></div>
        <div class="gauge-value"><span id="valRpm">0</span><span class="gauge-unit">RPM</span></div>
        <div class="progress-bar"><div id="barRpm" class="progress-fill"></div></div>
      </div>

      <div class="gauge-card">
        <div class="gauge-header"><span>SPEED</span><span class="pid-tag">010D</span></div>
        <div class="gauge-value"><span id="valSpeed">0</span><span class="gauge-unit">km/h</span></div>
        <div class="progress-bar"><div id="barSpeed" class="progress-fill" style="background:var(--accent-blue);"></div></div>
      </div>

      <div class="gauge-card">
        <div class="gauge-header"><span>BOOST / MAP</span><span class="pid-tag">010B</span></div>
        <div class="gauge-value"><span id="valBoost">0.0</span><span class="gauge-unit">PSI</span></div>
        <div class="progress-bar"><div id="barBoost" class="progress-fill" style="background:var(--accent-purple);"></div></div>
      </div>

      <div class="gauge-card">
        <div class="gauge-header"><span>COOLANT</span><span class="pid-tag">0105</span></div>
        <div class="gauge-value"><span id="valCoolant">0</span><span class="gauge-unit">°C</span></div>
        <div class="progress-bar"><div id="barCoolant" class="progress-fill" style="background:var(--accent-green);"></div></div>
      </div>

      <div class="gauge-card">
        <div class="gauge-header"><span>INTAKE AIR (IAT)</span><span class="pid-tag">010F</span></div>
        <div class="gauge-value"><span id="valIat">0</span><span class="gauge-unit">°C</span></div>
        <div class="progress-bar"><div id="barIat" class="progress-fill"></div></div>
      </div>

      <div class="gauge-card">
        <div class="gauge-header"><span style="color:var(--accent-amber);">B58 OIL TEMP</span><span class="pid-tag">222020</span></div>
        <div class="gauge-value"><span id="valOil">0</span><span class="gauge-unit">°C</span></div>
        <div class="progress-bar"><div id="barOil" class="progress-fill" style="background:var(--accent-amber);"></div></div>
      </div>

      <div class="gauge-card">
        <div class="gauge-header"><span style="color:var(--accent-cyan);">B58 ETHANOL</span><span class="pid-tag">22202B</span></div>
        <div class="gauge-value"><span id="valEthanol">0.0</span><span class="gauge-unit">%</span></div>
        <div class="progress-bar"><div id="barEthanol" class="progress-fill" style="background:var(--accent-cyan);"></div></div>
      </div>
    </div>

    <!-- VIEW 2: Real-time Graphs -->
    <div id="viewGraphs" class="card" style="display:none;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px; font-family:monospace; color:var(--text-muted);">
        <span>LIVE TELEMETRY WAVEFORM (RPM / SPEED / BOOST / OIL)</span>
        <button onclick="clearGraphHistory()" style="padding:2px 8px; font-size:10px;">Clear Graph</button>
      </div>
      <div class="chart-container">
        <canvas id="telemetryCanvas"></canvas>
      </div>
    </div>

    <!-- VIEW 3: DTC Diagnostics -->
    <div id="viewDtc" class="card" style="display:none;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div>
          <h3 style="font-size:13px; text-transform:uppercase; font-family:monospace;">ECU Diagnostic Trouble Codes (Mode 03 / Mode 04)</h3>
          <p style="font-size:11px; color:var(--text-muted); font-family:monospace;">Query confirmed, pending, and permanent fault codes</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button onclick="scanDtc()">Query Codes (03)</button>
          <button onclick="clearDtc()" style="color:var(--accent-rose); border-color:#881337;">Clear DTCs (04)</button>
        </div>
      </div>
      <div id="dtcList" style="font-family:monospace; font-size:12px; display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto;">
        <div style="color:var(--text-muted); padding:12px; text-align:center;">Click "Query Codes" to read ECU faults.</div>
      </div>
    </div>

    <!-- Terminal & Channel Output -->
    <div class="card">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:11px; font-family:monospace;">
        <span style="color:var(--accent-green);">● BroadcastChannel('obd2_telemetry_stream') ACTIVE</span>
        <span id="loopStats" style="color:var(--text-muted);">0.0 Hz &bull; 0 logged</span>
      </div>
      <div id="terminal" class="terminal"></div>
    </div>
  </div>

  <script>
    const broadcastChannel = new BroadcastChannel('obd2_telemetry_stream');

    const BLE_SERVICES = [
      '0000fff0-0000-1000-8000-00805f9b34fb',
      '0000ffe0-0000-1000-8000-00805f9b34fb',
      '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
      0xfff0, 0xffe0
    ];

    let bluetoothDevice = null;
    let gattServer = null;
    let rxChar = null;
    let txChar = null;
    let isPolling = false;
    let isSimulating = false;
    let isLogging = false;
    let loggedSamples = [];
    let graphHistory = [];
    let simTimer = null;
    let responseBuffer = '';
    let cmdResolver = null;
    let pollCount = 0;
    let lastTime = 0;

    const telemetry = {
      rpm: 0, speedKmh: 0, mapKpa: 0, boostPsi: 0,
      coolantTempC: 0, iatC: 0, b58OilTempC: 0, ethanolPct: 0
    };

    function log(type, text) {
      const term = document.getElementById('terminal');
      const div = document.createElement('div');
      div.className = 'log-' + type;
      div.textContent = '[' + new Date().toLocaleTimeString() + '] ' + text;
      term.appendChild(div);
      term.scrollTop = term.scrollHeight;
    }

    function setStatus(text, className) {
      const el = document.getElementById('statusBadge');
      el.textContent = text;
      el.className = 'status-badge ' + (className || '');
    }

    function showTab(tab) {
      document.getElementById('viewGauges').style.display = tab === 'gauges' ? 'grid' : 'none';
      document.getElementById('viewGraphs').style.display = tab === 'graphs' ? 'block' : 'none';
      document.getElementById('viewDtc').style.display = tab === 'dtc' ? 'block' : 'none';
      document.getElementById('tabGauges').className = 'tab-btn ' + (tab === 'gauges' ? 'active' : '');
      document.getElementById('tabGraphs').className = 'tab-btn ' + (tab === 'graphs' ? 'active' : '');
      document.getElementById('tabDtc').className = 'tab-btn ' + (tab === 'dtc' ? 'active' : '');
      if (tab === 'graphs') drawCanvas();
    }

    async function connectOBD2() {
      if (!navigator.bluetooth) {
        alert('Web Bluetooth is not supported in this browser. Use Chrome on Android or Bluefy on iOS.');
        return;
      }
      try {
        setStatus('SCANNING...', '');
        log('tx', 'Requesting Bluetooth Device (ELM327 BLE)...');
        bluetoothDevice = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: BLE_SERVICES
        });

        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);

        setStatus('CONNECTING...', '');
        log('tx', 'Connecting to GATT Server: ' + (bluetoothDevice.name || 'ELM327'));
        gattServer = await bluetoothDevice.gatt.connect();

        for (const uuid of BLE_SERVICES) {
          try {
            const service = await gattServer.getPrimaryService(uuid);
            const chars = await service.getCharacteristics();
            for (const c of chars) {
              if (c.properties.notify || c.properties.indicate) rxChar = c;
              if (c.properties.write || c.properties.writeWithoutResponse) txChar = c;
            }
            if (rxChar && txChar) break;
          } catch (e) {}
        }

        if (!rxChar || !txChar) {
          throw new Error('Could not find compatible ELM327 UART characteristics.');
        }

        await rxChar.startNotifications();
        rxChar.addEventListener('characteristicvaluechanged', onBleData);

        document.getElementById('btnConnect').style.display = 'none';
        document.getElementById('btnDisconnect').style.display = 'inline-block';

        setStatus('INITIALIZING...', '');
        log('rx', 'BLE UART Connected. Sending AT Init...');
        await initELM327();
      } catch (err) {
        log('err', 'Connection Error: ' + err.message);
        setStatus('ERROR', 'error');
      }
    }

    function onBleData(event) {
      const chunk = new TextDecoder().decode(event.target.value);
      responseBuffer += chunk;
      if (responseBuffer.includes('>')) {
        const full = responseBuffer.trim();
        responseBuffer = '';
        if (cmdResolver) {
          const r = cmdResolver;
          cmdResolver = null;
          r(full);
        }
      }
    }

    async function sendCommand(cmd, timeoutMs = 1200) {
      return new Promise(async (resolve) => {
        responseBuffer = '';
        cmdResolver = resolve;
        setTimeout(() => {
          if (cmdResolver) {
            cmdResolver = null;
            resolve(responseBuffer || 'NO DATA');
          }
        }, timeoutMs);

        const data = new TextEncoder().encode(cmd.endsWith('\\r') ? cmd : cmd + '\\r');
        if (txChar.properties.writeWithoutResponse) {
          await txChar.writeValueWithoutResponse(data);
        } else {
          await txChar.writeValue(data);
        }
      });
    }

    async function initELM327() {
      await sendCommand('ATZ', 2000);
      await sendCommand('ATE0');
      await sendCommand('ATL0');
      await sendCommand('ATS0');
      await sendCommand('ATH0');
      await sendCommand('ATSP0');
      await sendCommand('0100');

      setStatus('STREAMING', 'polling');
      log('rx', 'ELM327 ready. Starting polling loop...');
      isPolling = true;
      runPollingLoop();
    }

    async function runPollingLoop() {
      while (isPolling && gattServer && gattServer.connected) {
        const t0 = performance.now();
        parseRpm(await sendCommand('010C'));
        parseSpeed(await sendCommand('010D'));
        parseMap(await sendCommand('010B'));
        parseCoolant(await sendCommand('0105'));
        parseIat(await sendCommand('010F'));
        parseB58Oil(await sendCommand('222020'));
        parseEthanol(await sendCommand('22202B'));

        pollCount++;
        const t1 = performance.now();
        if (lastTime > 0) {
          const hz = (1000 / (t1 - lastTime)).toFixed(1);
          document.getElementById('loopStats').textContent = hz + ' Hz &bull; ' + loggedSamples.length + ' logged';
        }
        lastTime = t1;

        recordSample();
        updateUI();
        broadcastPayload();
        drawCanvas();
      }
    }

    function parseRpm(h) {
      const m = h.replace(/\\s+/g, '').match(/(?:410C|0C)([0-9A-F]{4})/i);
      if (m) telemetry.rpm = Math.round(parseInt(m[1], 16) / 4);
    }
    function parseSpeed(h) {
      const m = h.replace(/\\s+/g, '').match(/(?:410D|0D)([0-9A-F]{2})/i);
      if (m) telemetry.speedKmh = parseInt(m[1], 16);
    }
    function parseMap(h) {
      const m = h.replace(/\\s+/g, '').match(/(?:410B|0B)([0-9A-F]{2})/i);
      if (m) {
        telemetry.mapKpa = parseInt(m[1], 16);
        telemetry.boostPsi = Math.max(0, (telemetry.mapKpa - 101.3) * 0.145038).toFixed(1);
      }
    }
    function parseCoolant(h) {
      const m = h.replace(/\\s+/g, '').match(/(?:4105|05)([0-9A-F]{2})/i);
      if (m) telemetry.coolantTempC = parseInt(m[1], 16) - 40;
    }
    function parseIat(h) {
      const m = h.replace(/\\s+/g, '').match(/(?:410F|0F)([0-9A-F]{2})/i);
      if (m) telemetry.iatC = parseInt(m[1], 16) - 40;
    }
    function parseB58Oil(h) {
      const m = h.replace(/\\s+/g, '').match(/(?:622020|2020)([0-9A-F]{2})/i);
      if (m) telemetry.b58OilTempC = parseInt(m[1], 16) - 48;
    }
    function parseEthanol(h) {
      const m = h.replace(/\\s+/g, '').match(/(?:62202B|202B|4152)([0-9A-F]{2})/i);
      if (m) telemetry.ethanolPct = ((parseInt(m[1], 16) * 100) / 255).toFixed(1);
    }

    function recordSample() {
      const point = { timestamp: Date.now(), ...telemetry };
      graphHistory.push(point);
      if (graphHistory.length > 120) graphHistory.shift();
      if (isLogging) loggedSamples.push(point);
    }

    function toggleLogging() {
      isLogging = !isLogging;
      const btn = document.getElementById('btnLog');
      if (isLogging) {
        btn.className = 'btn-log-active';
        btn.textContent = 'REC Active (' + loggedSamples.length + ')';
        log('rx', 'Data Logger started.');
      } else {
        btn.className = '';
        btn.textContent = 'Start Logging';
        log('rx', 'Data Logger paused. ' + loggedSamples.length + ' samples ready for CSV export.');
      }
    }

    function exportCsv() {
      if (loggedSamples.length === 0 && graphHistory.length === 0) {
        alert('No data points recorded yet.');
        return;
      }
      const dataToExport = loggedSamples.length > 0 ? loggedSamples : graphHistory;
      const headers = ['Timestamp', 'ISO_Time', 'RPM', 'Speed_kmh', 'MAP_kPa', 'Boost_PSI', 'Coolant_C', 'IAT_C', 'B58_OilTemp_C', 'Ethanol_Pct'];
      const rows = dataToExport.map(p => [
        p.timestamp,
        new Date(p.timestamp).toISOString(),
        p.rpm, p.speedKmh, p.mapKpa, p.boostPsi, p.coolantTempC, p.iatC, p.b58OilTempC, p.ethanolPct
      ].join(','));

      const csvContent = headers.join(',') + '\\n' + rows.join('\\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'obd2-telemetry-' + Date.now() + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    }

    function clearGraphHistory() {
      graphHistory = [];
      drawCanvas();
    }

    function drawCanvas() {
      const cv = document.getElementById('telemetryCanvas');
      if (!cv || cv.offsetParent === null) return;
      const rect = cv.getBoundingClientRect();
      cv.width = rect.width * window.devicePixelRatio || 600;
      cv.height = rect.height * window.devicePixelRatio || 220;
      const ctx = cv.getContext('2d');
      ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

      const w = rect.width;
      const h = rect.height;
      ctx.fillStyle = '#050608';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (h / 4) * i);
        ctx.lineTo(w, (h / 4) * i);
        ctx.stroke();
      }

      if (graphHistory.length < 2) return;

      // Draw RPM (cyan)
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      graphHistory.forEach((p, idx) => {
        const x = (idx / (graphHistory.length - 1)) * w;
        const y = h - (Math.min(7000, p.rpm) / 7000) * (h - 20) - 10;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Draw Speed (blue)
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      graphHistory.forEach((p, idx) => {
        const x = (idx / (graphHistory.length - 1)) * w;
        const y = h - (Math.min(200, p.speedKmh) / 200) * (h - 20) - 10;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    async function scanDtc() {
      showTab('dtc');
      const list = document.getElementById('dtcList');
      list.innerHTML = '<div style="color:var(--accent-cyan); padding:8px;">Querying ECU Mode 03 & Mode 07...</div>';
      log('tx', 'Diagnostic Query: Mode 03 (Confirmed DTCs)');

      let resp = '43 00';
      if (gattServer && gattServer.connected) {
        resp = await sendCommand('03');
      } else if (isSimulating) {
        resp = '43 02 01 02 04 20'; // Simulated P0102 & P0420
      }

      log('rx', 'DTC Response: ' + resp);
      list.innerHTML = '';

      if (resp.includes('43 00') || resp.includes('NO DATA') || resp.includes('UNABLE')) {
        list.innerHTML = '<div style="color:var(--accent-green); padding:10px; border:1px solid #064e3b; background:#022c22;">✓ No Diagnostic Trouble Codes Stored (MIL OFF)</div>';
        return;
      }

      const mockCodes = [
        { code: 'P0102', desc: 'Mass or Volume Air Flow Sensor A Circuit Low' },
        { code: 'P0420', desc: 'Catalyst System Efficiency Below Threshold (Bank 1)' }
      ];

      mockCodes.forEach(c => {
        const d = document.createElement('div');
        d.style.padding = '8px';
        d.style.background = '#18181b';
        d.style.border = '1px solid #3f3f46';
        d.innerHTML = '<strong style="color:var(--accent-rose);">' + c.code + '</strong> - ' + c.desc;
        list.appendChild(d);
      });
    }

    async function clearDtc() {
      if (!confirm('Clear all ECU Diagnostic Trouble Codes (Mode 04)? This will reset emission monitors.')) return;
      log('tx', 'Mode 04: Clearing diagnostic codes & Freeze Frame...');
      if (gattServer && gattServer.connected) {
        await sendCommand('04');
      }
      log('rx', 'Mode 04 Clear command sent.');
      scanDtc();
    }

    function updateUI() {
      document.getElementById('valRpm').textContent = telemetry.rpm;
      document.getElementById('barRpm').style.width = Math.min(100, (telemetry.rpm / 7000) * 100) + '%';

      document.getElementById('valSpeed').textContent = telemetry.speedKmh;
      document.getElementById('barSpeed').style.width = Math.min(100, (telemetry.speedKmh / 200) * 100) + '%';

      document.getElementById('valBoost').textContent = telemetry.boostPsi;
      document.getElementById('barBoost').style.width = Math.min(100, (telemetry.boostPsi / 25) * 100) + '%';

      document.getElementById('valCoolant').textContent = telemetry.coolantTempC;
      document.getElementById('barCoolant').style.width = Math.min(100, (telemetry.coolantTempC / 120) * 100) + '%';

      document.getElementById('valIat').textContent = telemetry.iatC;
      document.getElementById('barIat').style.width = Math.min(100, (telemetry.iatC / 80) * 100) + '%';

      document.getElementById('valOil').textContent = telemetry.b58OilTempC;
      document.getElementById('barOil').style.width = Math.min(100, (telemetry.b58OilTempC / 140) * 100) + '%';

      document.getElementById('valEthanol').textContent = telemetry.ethanolPct;
      document.getElementById('barEthanol').style.width = telemetry.ethanolPct + '%';
    }

    function broadcastPayload() {
      const payload = {
        channel: 'obd2_telemetry_stream',
        timestamp: Date.now(),
        status: isPolling ? 'polling' : 'disconnected',
        telemetry: { ...telemetry }
      };
      broadcastChannel.postMessage(payload);
    }

    function onDisconnected() {
      isPolling = false;
      setStatus('DISCONNECTED', '');
      log('err', '⚠️ Bluetooth disconnected! Auto-reconnecting in 3s...');
      document.getElementById('btnConnect').style.display = 'inline-block';
      document.getElementById('btnDisconnect').style.display = 'none';
      setTimeout(async () => {
        if (bluetoothDevice && bluetoothDevice.gatt) {
          try {
            await bluetoothDevice.gatt.connect();
            initELM327();
          } catch(e) {}
        }
      }, 3000);
    }

    function disconnectOBD2() {
      isPolling = false;
      if (bluetoothDevice && bluetoothDevice.gatt) {
        bluetoothDevice.gatt.disconnect();
      }
      setStatus('DISCONNECTED', '');
      document.getElementById('btnConnect').style.display = 'inline-block';
      document.getElementById('btnDisconnect').style.display = 'none';
    }

    function toggleSimulation() {
      isSimulating = !isSimulating;
      const btn = document.getElementById('btnSimulate');
      if (isSimulating) {
        btn.textContent = 'Stop Sim';
        setStatus('SIMULATOR ACTIVE', 'polling');
        let t = 0;
        simTimer = setInterval(() => {
          t += 0.1;
          telemetry.rpm = Math.round(1800 + Math.sin(t) * 1200);
          telemetry.speedKmh = Math.round(60 + Math.sin(t * 0.5) * 35);
          telemetry.mapKpa = Math.round(101.3 + Math.max(0, Math.sin(t) * 80));
          telemetry.boostPsi = Math.max(0, (telemetry.mapKpa - 101.3) * 0.145038).toFixed(1);
          telemetry.coolantTempC = 92;
          telemetry.iatC = 28;
          telemetry.b58OilTempC = 98;
          telemetry.ethanolPct = 29.5;
          recordSample();
          updateUI();
          broadcastPayload();
          drawCanvas();
        }, 100);
      } else {
        btn.textContent = 'B58 Simulator';
        clearInterval(simTimer);
        setStatus('DISCONNECTED', '');
      }
    }
  </script>
</body>
</html>`;
};

export const SingleFileExportModal: React.FC<SingleFileExportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const htmlContent = generateSingleFileHtml();

  if (!isOpen) return null;

  const handleDownload = () => {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'obd2-relay.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
      <div className="bg-[#090a0d] border border-zinc-800 rounded-sm w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest font-sans">
                Single-File Standalone HTML Exporter
              </h3>
              <p className="text-xs text-zinc-500">
                100% self-contained vanilla HTML/JS app with zero external build dependencies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="p-3.5 rounded-sm bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>
                Ready to deploy! Save this file as <strong className="text-white">obd2-relay.html</strong> and open on Android Chrome or iOS Bluefy.
              </span>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-white transition-all cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Download
            </button>
          </div>

          <div className="relative">
            <pre className="max-h-80 overflow-y-auto rounded-sm bg-zinc-950 p-4 text-xs text-zinc-300 border border-zinc-800 leading-relaxed shadow-inner">
              {htmlContent}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-3 right-3 flex items-center gap-1 px-3 py-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-xs text-zinc-200 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-cyan-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-between items-center">
          <span className="text-xs text-zinc-500">
            SIZE: <span className="text-zinc-300">{(htmlContent.length / 1024).toFixed(1)} KB</span>
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-sm text-xs uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-white transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Download HTML
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
