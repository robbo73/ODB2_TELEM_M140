import { ConnectionState, ObdStreamPayload, ObdTelemetry, LogEntry, PidConfigItem } from '../types';
import { pidConfigService, computeExpectedHexPrefix, normalizeCommand, normalizeHeader } from './pidConfigService';

export const KNOWN_BLE_SERVICES = [
  '0000fff0-0000-1000-8000-00805f9b34fb', // Standard FFF0 (Vgate, cheap ELM327)
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 / Veepeak
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Microchip Transparent UART
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (NUS)
  '000018f0-0000-1000-8000-00805f9b34fb', // Vgate iCar Pro BLE
  '0000fee0-0000-1000-8000-00805f9b34fb', // Ancel / OBDLink BLE
  '0000ae00-0000-1000-8000-00805f9b34fb',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Carista
  '0000ffe5-0000-1000-8000-00805f9b34fb', // Alternative HM-10
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
  '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
  '0000ff00-0000-1000-8000-00805f9b34fb', // Other OBD2 adapters
  '0000fff1-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
];

export class Obd2BleService {
  private device: any = null;
  private server: any = null;
  private rxCharacteristic: any = null; // Notify/Read characteristic
  private txCharacteristic: any = null; // Write characteristic
  
  private state: ConnectionState = 'disconnected';
  
  private responseBuffer = '';
  private currentResolver: ((value: string) => void) | null = null;
  private currentRejecter: ((reason: any) => void) | null = null;
  private commandTimeoutId: any = null;
  
  private isPollingActive = false;
  private autoReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  
  private pollCount = 0;
  private errorCount = 0;
  private disconnectionCount = 0;
  private lastLoopTime = 0;
  private loopHz = 0;
  private averageLatencyMs = 0;
  
  private telemetry: ObdTelemetry = {
    rpm: 0,
    speedKmh: 0,
    speedMph: 0,
    mapKpa: 0,
    mapPsi: 0,
    boostPsi: 0,
    coolantTempC: 0,
    coolantTempF: 32,
    iatC: 0,
    iatF: 32,
    b58OilTempC: 0,
    b58OilTempF: 32,
    ethanolPct: 0,
    oilPressureBar: 0,
    oilPressurePsi: 0,
    engineLoadPct: 0,
    throttlePct: 0,
    mafGps: 0,
    timingAdvanceDeg: 0,
    stftPct: 0,
    ltftPct: 0,
    controlModuleVoltage: 0,
    fuelLevelPct: 0,
    ambientTempC: 0,
    ambientTempF: 32,
    baroKpa: 101,
    baroPsi: 14.6,
    hpfpBar: 0,
    hpfpPsi: 0,
    lambda: 1.0,
    afr: 14.7,
    catTempC: 0,
    catTempF: 32,
    pedalPosPct: 0,
    absLoadPct: 0,
    runTimeSec: 0,
    chargeAirTempC: 0,
    chargeAirTempF: 32,
    transTempC: 0,
    transTempF: 32,
    customValues: {},
  };
  
  private rawResponses: Record<string, string> = {};
  private activeProtocol = 'Auto Search';
  private onStateChangeCb: ((state: ConnectionState) => void) | null = null;
  private onTelemetryCb: ((telemetry: ObdTelemetry, payload: ObdStreamPayload) => void) | null = null;
  private onLogCb: ((entry: LogEntry) => void) | null = null;

  private pidFailureCounts: Map<string, number> = new Map();
  private pidBackoffUntil: Map<string, number> = new Map();
  private slowPidCursor = 0;
  private currentHeader = '7DF'; // ELM327 default after ATZ (functional broadcast)
  private supportedMode01: Set<string> | null = null; // PIDs the ECU says it supports (null = unknown)
  private supportedMax = 0; // highest Mode 01 PID covered by the discovery bitmaps
  private pidNoticeLogged: Set<string> = new Set();

  constructor() {
    pidConfigService.subscribe(() => {
      this.resetPidBackoff();
    });
  }

  public resetPidBackoff(): void {
    this.pidFailureCounts.clear();
    this.pidBackoffUntil.clear();
    this.slowPidCursor = 0;
  }

  private resetPollingCounters(): void {
    this.pollCount = 0;
    this.awaitingPrompt = false;
    this.currentHeader = '7DF';
    this.pidNoticeLogged.clear();
    this.resetPidBackoff();
  }

  public setCallbacks(
    onStateChange: (state: ConnectionState) => void,
    onTelemetry: (telemetry: ObdTelemetry, payload: ObdStreamPayload) => void,
    onLog: (entry: LogEntry) => void
  ) {
    this.onStateChangeCb = onStateChange;
    this.onTelemetryCb = onTelemetry;
    this.onLogCb = onLog;
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getTelemetry(): ObdTelemetry {
    return { ...this.telemetry };
  }

  public getDevice() {
    return this.device;
  }

  public setAutoReconnect(enabled: boolean) {
    this.autoReconnect = enabled;
  }

  private setState(newState: ConnectionState) {
    this.state = newState;
    if (this.onStateChangeCb) {
      this.onStateChangeCb(newState);
    }
    this.broadcastCurrentPayload();
  }

  private log(type: LogEntry['type'], text: string) {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      type,
      text,
    };
    if (this.onLogCb) {
      this.onLogCb(entry);
    }
  }

  /**
   * Main Connect entry point using navigator.bluetooth.requestDevice()
   */
  public async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      const msg = 'Web Bluetooth API is not supported in this browser. Please use Chrome on Android or a Web Bluetooth capable browser on HTTPS.';
      this.log('error', msg);
      this.setState('error');
      throw new Error(msg);
    }

    try {
      this.setState('scanning');
      this.log('info', 'Requesting Web Bluetooth device (ELM327 BLE)...');

      // Request device with wide compatibility filters & optional services
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: KNOWN_BLE_SERVICES,
      });

      this.device = device;
      this.log('info', `Device selected: ${device.name || 'Unknown BLE Device'} [${device.id}]`);

      // Bind disconnection listener
      this.device.removeEventListener('gattserverdisconnected', this.onGattDisconnected);
      this.device.addEventListener('gattserverdisconnected', this.onGattDisconnected);

      await this.establishGattConnection();
    } catch (err: any) {
      if (err.name === 'NotFoundError' || err.message?.includes('User cancelled')) {
        this.log('info', 'Bluetooth pairing cancelled by user.');
        this.setState('disconnected');
      } else {
        this.log('error', `Connection failed: ${err.message || err}`);
        this.setState('error');
      }
      throw err;
    }
  }

  /**
   * Connect to GATT Server and discover characteristics
   */
  private async establishGattConnection(): Promise<void> {
    if (!this.device) throw new Error('No device available');

    this.setState('connecting');
    this.log('info', 'Connecting to GATT Server...');

    this.server = await this.device.gatt.connect();
    this.log('info', 'GATT Server connected! Exploring primary services...');

    // Attempt to discover UART/Serial characteristics across known services
    let txChar: any = null;
    let rxChar: any = null;
    let connectedServiceUuid = '';

    for (const serviceUuid of KNOWN_BLE_SERVICES) {
      try {
        const service = await this.server.getPrimaryService(serviceUuid);
        if (service) {
          const chars = await service.getCharacteristics();
          this.log('info', `Found service ${serviceUuid.slice(0, 8)}... with ${chars.length} characteristics`);

          for (const char of chars) {
            const props = char.properties;
            // Characteristic supporting notify or indicate is our RX (ELM327 to Web App)
            if (props.notify || props.indicate) {
              rxChar = char;
            }
            // Characteristic supporting write or writeWithoutResponse is our TX (Web App to ELM327)
            if (props.write || props.writeWithoutResponse) {
              txChar = char;
            }
          }

          if (rxChar && txChar) {
            connectedServiceUuid = serviceUuid;
            break;
          }
        }
      } catch {
        // Continue trying other service UUIDs
      }
    }

    // Fallback: If not found in known list, try querying all available primary services
    if (!rxChar || !txChar) {
      try {
        const services = await this.server.getPrimaryServices();
        for (const service of services) {
          try {
            const chars = await service.getCharacteristics();
            for (const char of chars) {
              const props = char.properties;
              if ((props.notify || props.indicate) && !rxChar) rxChar = char;
              if ((props.write || props.writeWithoutResponse) && !txChar) txChar = char;
            }
            if (rxChar && txChar) {
              connectedServiceUuid = service.uuid;
              break;
            }
          } catch {
            // ignore
          }
        }
      } catch (err: any) {
        this.log('info', `Service query fallback: ${err.message}`);
      }
    }

    if (!rxChar || !txChar) {
      throw new Error('Could not find compatible ELM327 Read/Write BLE characteristics.');
    }

    this.rxCharacteristic = rxChar;
    this.txCharacteristic = txChar;

    this.log('info', `Paired with BLE UART Service [${connectedServiceUuid.slice(0, 8)}...]`);

    // Enable Notifications on RX Characteristic
    await this.rxCharacteristic.startNotifications();
    this.rxCharacteristic.removeEventListener('characteristicvaluechanged', this.onCharacteristicValueChanged);
    this.rxCharacteristic.addEventListener('characteristicvaluechanged', this.onCharacteristicValueChanged);

    this.log('info', 'BLE Notifications activated. Initializing ELM327 Handshake...');
    await this.initializeElm327();
  }

  /**
   * Handle incoming BLE data chunks from ELM327
   */
  private onCharacteristicValueChanged = (event: any) => {
    const value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const textChunk = decoder.decode(value);
    
    this.responseBuffer += textChunk;
    
    // Check for prompt character '>' indicating completion of ELM327 command
    if (this.responseBuffer.includes('>')) {
      const fullResponse = this.responseBuffer.trim();
      this.responseBuffer = '';
      
      if (this.commandTimeoutId) {
        clearTimeout(this.commandTimeoutId);
        this.commandTimeoutId = null;
      }
      
      if (this.currentResolver) {
        const resolver = this.currentResolver;
        this.currentResolver = null;
        this.currentRejecter = null;
        resolver(fullResponse);
      }
    }
  };

  private commandChain: Promise<unknown> = Promise.resolve();
  private awaitingPrompt = false; // true if a previous command timed out and its '>' has not arrived yet

  /**
   * Send AT or OBD command to ELM327 and await response (terminated by '>').
   * Commands are serialized, and after a timeout we wait for the late '>' prompt
   * (draining it) before sending the next one. Without this, a late reply gets
   * matched to the NEXT command and every response afterwards is off by one.
   */
  public sendCommand(cmd: string, timeoutMs = 1500): Promise<string> {
    const run = () => this.sendCommandInner(cmd, timeoutMs);
    const p = this.commandChain.then(run, run);
    this.commandChain = p.catch(() => {});
    return p;
  }

  private async drainLatePrompt(): Promise<void> {
    if (!this.awaitingPrompt) return;
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => { this.currentResolver = null; resolve(); }, 1500);
      this.responseBuffer = '';
      this.currentResolver = () => { clearTimeout(t); resolve(); };
    });
    this.awaitingPrompt = false;
    this.responseBuffer = '';
    this.currentResolver = null;
  }

  private async sendCommandInner(cmd: string, timeoutMs: number): Promise<string> {
    if (!this.txCharacteristic) {
      throw new Error('Not connected to ELM327 transmitter.');
    }
    await this.drainLatePrompt();

    return new Promise<string>(async (resolve, reject) => {
      this.responseBuffer = '';
      this.currentResolver = (v: string) => { this.awaitingPrompt = false; resolve(v); };
      this.currentRejecter = reject;

      this.commandTimeoutId = setTimeout(() => {
        this.currentResolver = null;
        this.currentRejecter = null;
        this.errorCount++;
        this.awaitingPrompt = true; // reply may still be on its way
        const currentBuffer = this.responseBuffer;
        this.responseBuffer = '';
        if (currentBuffer.length > 0) {
          resolve(currentBuffer);
        } else {
          reject(new Error(`Timeout (${timeoutMs}ms) waiting for response to '${cmd}'`));
        }
      }, timeoutMs);

      try {
        const formattedCmd = cmd.endsWith('\r') ? cmd : `${cmd}\r`;
        const data = new TextEncoder().encode(formattedCmd);
        this.log('tx', cmd);
        if (this.txCharacteristic.properties.writeWithoutResponse) {
          await this.txCharacteristic.writeValueWithoutResponse(data);
        } else {
          await this.txCharacteristic.writeValue(data);
        }
      } catch (err: any) {
        if (this.commandTimeoutId) { clearTimeout(this.commandTimeoutId); this.commandTimeoutId = null; }
        this.currentResolver = null;
        this.currentRejecter = null;
        this.errorCount++;
        reject(err);
      }
    });
  }

  /**
   * ELM327 Handshake & initialization sequence
   */
  private async initializeElm327(): Promise<void> {
    this.resetPollingCounters();
    this.setState('initializing');
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    try {
      // 1. Reset chip
      const atz = await this.sendCommand('ATZ', 2500).catch(() => 'ATZ OK');
      this.log('rx', `ATZ -> ${atz.replace(/>/g, '').trim()}`);
      await delay(200);

      // 2. Echo Off
      const ate0 = await this.sendCommand('ATE0').catch(() => 'OK');
      this.log('rx', `ATE0 -> ${ate0.replace(/>/g, '').trim()}`);

      // 3. Linefeeds Off
      await this.sendCommand('ATL0').catch(() => {});

      // 4. Spaces Off (makes parsing faster and uniform)
      await this.sendCommand('ATS0').catch(() => {});

      // 5. Headers Off
      await this.sendCommand('ATH0').catch(() => {});

      // 6. Adaptive Timing on
      await this.sendCommand('ATAT1').catch(() => {});

      // 7. Auto Protocol Search (or ISO 15765-4 11-bit 500k CAN)
      const atsp = await this.sendCommand('ATSP0').catch(() => 'OK');
      this.log('rx', `ATSP0 -> ${atsp.replace(/>/g, '').trim()}`);

      // 8. Warmup test: Standard Supported PIDs 01-20
      const test0100 = await this.sendCommand('0100', 2000).catch(() => 'NO DATA');
      this.log('rx', `0100 -> ${test0100.replace(/>/g, '').trim()}`);

      // 8b. Discover which Mode 01 PIDs this ECU actually supports
      await this.discoverSupportedPids(test0100);

      // 9. Query protocol description
      const dpn = await this.sendCommand('ATDPN').catch(() => '');
      if (dpn) {
        this.activeProtocol = `Protocol ${dpn.replace(/[>\r\n]/g, '').trim()}`;
      }

      this.log('info', 'ELM327 initialization complete. Starting continuous PID polling loop.');
      this.reconnectAttempts = 0;
      this.setState('connected');
      
      // Start polling loop
      this.startPollingLoop();
    } catch (err: any) {
      this.log('error', `Handshake error: ${err.message}`);
      // Still attempt to enter polling if connected
      this.startPollingLoop();
    }
  }

  /**
   * Continuous dynamic PID polling loop driven by pidConfigService
   */
  public startPollingLoop(): void {
    if (this.isPollingActive) return;
    this.resetPollingCounters();
    this.isPollingActive = true;
    this.setState('polling');
    this.runPollingLoop();
  }

  public stopPollingLoop(): void {
    this.isPollingActive = false;
    if (this.state === 'polling') {
      this.setState('connected');
    }
  }

  private async runPollingLoop(): Promise<void> {
    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    while (this.isPollingActive && this.state === 'polling') {
      const loopStart = performance.now();

      try {
        const enabledPids = pidConfigService.getEnabledPids();
        const isEligible = (p: PidConfigItem) => (this.pidBackoffUntil.get(p.id) ?? 0) <= this.pollCount;

        const fastPids = enabledPids.filter((p) => p.pollRate !== 'slow');
        const slowPids = enabledPids.filter((p) => p.pollRate === 'slow');

        const eligibleFast = fastPids.filter(isEligible);
        const eligibleSlow = slowPids.filter(isEligible);

        // Poll up to 2 slow PIDs per cycle in round-robin so extended PIDs never stall fast Core PIDs
        const slowBatch: PidConfigItem[] = [];
        if (eligibleSlow.length > 0) {
          const count = Math.min(2, eligibleSlow.length);
          for (let i = 0; i < count; i++) {
            slowBatch.push(eligibleSlow[(this.slowPidCursor + i) % eligibleSlow.length]);
          }
          this.slowPidCursor = (this.slowPidCursor + count) % eligibleSlow.length;
        }

        let activeBatch = [...eligibleFast, ...slowBatch];
        // Group PIDs by CAN header so ATSH only changes once per cycle
        activeBatch.sort((a, b) => Number(!!normalizeHeader(a.header)) - Number(!!normalizeHeader(b.header)));
        if (activeBatch.length === 0 && enabledPids.length > 0) {
          this.resetPidBackoff();
          activeBatch = fastPids.length > 0 ? fastPids : enabledPids.slice(0, 4);
        }

        for (const pid of activeBatch) {
          if (!this.isPollingActive || this.state !== 'polling') break;
          await this.pollConfiguredPid(pid);
        }

        this.pollCount++;

        // Calculate performance loop metrics
        const loopEnd = performance.now();
        const loopDuration = loopEnd - loopStart;
        this.averageLatencyMs = activeBatch.length > 0 ? Math.round(loopDuration / activeBatch.length) : 0;
        
        if (this.lastLoopTime > 0) {
          const deltaSec = (loopEnd - this.lastLoopTime) / 1000;
          if (deltaSec > 0) {
            this.loopHz = Number((1 / deltaSec).toFixed(1));
          }
        }
        this.lastLoopTime = loopEnd;

        // Broadcast JSON packet
        this.broadcastCurrentPayload();

        // Brief delay between cycles for bus stability
        await delay(20);
      } catch (err: any) {
        this.errorCount++;
        this.log('error', `Polling loop glitch: ${err.message}`);
        await delay(200);
      }
    }
  }

  /**
   * Read the Mode 01 "supported PIDs" bitmaps (0100, 0120, 0140, 0160...) so the app knows
   * which standard PIDs (e.g. 015C oil temp, 0152 ethanol) the ECU really supports.
   */
  private async discoverSupportedPids(firstReply: string): Promise<void> {
    const supported = new Set<string>();
    let max = 0;
    try {
      for (let base = 0x00; base <= 0x60; base += 0x20) {
        const cmd = '01' + base.toString(16).toUpperCase().padStart(2, '0');
        const raw = base === 0 ? firstReply : await this.sendCommand(cmd, 2000);
        const prefix = '41' + cmd.slice(2);
        let bits = 0n;
        let found = false;
        for (const line of raw.split(/[\r\n]+/)) {
          const l = line.replace(/[>\s]/g, '').toUpperCase();
          const i = l.indexOf(prefix);
          const hex = i >= 0 ? l.slice(i + prefix.length, i + prefix.length + 8) : '';
          if (/^[0-9A-F]{8}$/.test(hex)) {
            bits |= BigInt('0x' + hex); // union across ECUs
            found = true;
          }
        }
        if (!found) break;
        max = base + 0x20;
        for (let n = 1; n <= 32; n++) {
          if ((bits >> BigInt(32 - n)) & 1n) {
            supported.add((base + n).toString(16).toUpperCase().padStart(2, '0'));
          }
        }
        if (!supported.has((base + 0x20).toString(16).toUpperCase().padStart(2, '0'))) break; // no further ranges
      }
    } catch {
      // discovery is best-effort
    }
    if (supported.size > 0) {
      this.supportedMode01 = supported;
      this.supportedMax = max;
      this.log('info', `ECU reports ${supported.size} supported Mode 01 PIDs: ${[...supported].sort().join(' ')}`);
      const notes = [
        ['5C', 'Oil temp'],
        ['52', 'Ethanol %'],
      ].map(([pid, name]) => `${name} (01${pid}): ${supported.has(pid) ? 'SUPPORTED' : 'not supported'}`);
      this.log('info', notes.join(' | '));
    } else {
      this.supportedMode01 = null;
      this.log('info', 'Could not read the supported-PID list; polling every enabled PID.');
    }
  }

  /** Switch the CAN request header (ATSH) if the PID needs a different one than the last command. */
  private async ensureHeader(pid: PidConfigItem): Promise<void> {
    const want = normalizeHeader(pid.header) || '7DF';
    if (want === this.currentHeader) return;
    const reply = await this.sendCommand(`ATSH ${want}`, 1000);
    if (/OK/i.test(reply)) {
      this.currentHeader = want;
    } else {
      this.log('error', `ATSH ${want} rejected: ${reply.replace(/[>\r\n]/g, ' ').trim()}`);
    }
  }

  private noticeOnce(key: string, type: LogEntry['type'], text: string): void {
    if (this.pidNoticeLogged.has(key)) return;
    this.pidNoticeLogged.add(key);
    this.log(type, text);
  }

  private explainNegativeReply(pid: PidConfigItem, cmd: string, clean: string): boolean {
    const m = clean.match(new RegExp('7F' + cmd.slice(0, 2) + '([0-9A-F]{2})'));
    if (!m) return false;
    const reasons: Record<string, string> = {
      '11': 'service not supported by this ECU',
      '12': 'sub-function not supported',
      '13': 'incorrect message length',
      '22': 'conditions not correct (engine state)',
      '31': 'PID/DID not supported by this ECU - the code is wrong for this car',
      '33': 'security access denied',
      '78': 'response pending',
    };
    this.noticeOnce(`nrc-${pid.id}-${m[1]}`, 'error',
      `${cmd} (${pid.name}): ECU refused with 7F ${cmd.slice(0, 2)} ${m[1]} - ${reasons[m[1]] || 'negative response'}. Header used: ${this.currentHeader}.`);
    return true;
  }

  private recordPidFailure(pid: PidConfigItem, cmd: string): void {
    const fails = (this.pidFailureCounts.get(pid.id) ?? 0) + 1;
    this.pidFailureCounts.set(pid.id, fails);
    if (fails >= 3) {
      this.pidBackoffUntil.set(pid.id, this.pollCount + 25);
      this.pidFailureCounts.set(pid.id, 0);
      this.log('info', `Skipping unresponsive PID ${cmd} (${pid.name}) for 25 cycles (editable in PID Settings).`);
    }
  }

  private async pollConfiguredPid(pid: PidConfigItem): Promise<void> {
    const cmd = normalizeCommand(pid.command);
    if (!cmd || cmd.length < 2) return;

    // Skip standard PIDs the ECU says it does not support (saves time, explains the zero gauge)
    if (this.supportedMode01 && cmd.startsWith('01') && cmd.length === 4) {
      const n = parseInt(cmd.slice(2), 16);
      if (n <= this.supportedMax && !this.supportedMode01.has(cmd.slice(2))) {
        this.noticeOnce(`unsup-${cmd}`, 'info',
          `${cmd} (${pid.name}) is not supported by this ECU - skipping. Change the PID in PID Settings.`);
        return;
      }
    }

    try {
      await this.ensureHeader(pid);
      const timeout = cmd.startsWith('22') ? 1200 : 800;
      const raw = await this.sendCommand(cmd, timeout);
      const clean = raw.replace(/[>\r\n\s]/g, '').toUpperCase();
      this.rawResponses[cmd] = raw.replace(/[>\r\n]/g, ' ').trim();
      this.log('rx', `${cmd} -> ${this.rawResponses[cmd]}`);

      if (this.explainNegativeReply(pid, cmd, clean)) {
        this.recordPidFailure(pid, cmd);
        return;
      }

      if (
        !clean ||
        clean.includes('NODATA') ||
        clean.includes('ERROR') ||
        clean.includes('UNABLE') ||
        clean.includes('STOPPED') ||
        clean.includes('?')
      ) {
        if (cmd.startsWith('22')) {
          this.noticeOnce(`nodata-${cmd}`, 'error',
            `${cmd} (${pid.name}): no usable reply (${clean || 'empty'}) with header ${this.currentHeader}. Check the DID and header in PID Settings.`);
        }
        this.recordPidFailure(pid, cmd);
        return;
      }

      const expected = computeExpectedHexPrefix(cmd);
      if (!expected || !clean.includes(expected)) {
        this.recordPidFailure(pid, cmd);
        return;
      }

      const val = pidConfigService.parseResponse(pid, clean);
      if (val !== null && !isNaN(val)) {
        this.pidFailureCounts.set(pid.id, 0);
        this.pidBackoffUntil.delete(pid.id);
        this.applyParsedPidValue(pid, val);
      } else {
        this.recordPidFailure(pid, cmd);
      }
    } catch {
      // Allow loop to proceed even if individual PID times out, and back off unresponsive PIDs
      this.recordPidFailure(pid, cmd);
    }
  }

  private applyParsedPidValue(pid: PidConfigItem, val: number): void {
    this.telemetry.customValues = {
      ...this.telemetry.customValues,
      [pid.id]: val,
    };

    switch (pid.id) {
      case 'rpm':
        this.telemetry.rpm = Math.round(val);
        break;
      case 'speed':
        this.telemetry.speedKmh = Math.round(val);
        this.telemetry.speedMph = Number((val * 0.621371).toFixed(1));
        break;
      case 'map': {
        this.telemetry.mapKpa = val;
        this.telemetry.mapPsi = Number((val * 0.145038).toFixed(1));
        const boostKpa = Math.max(0, val - (this.telemetry.baroKpa || 101.3));
        this.telemetry.boostPsi = Number((boostKpa * 0.145038).toFixed(1));
        break;
      }
      case 'coolant':
        this.telemetry.coolantTempC = val;
        this.telemetry.coolantTempF = Math.round((val * 1.8) + 32);
        break;
      case 'iat':
        this.telemetry.iatC = val;
        this.telemetry.iatF = Math.round((val * 1.8) + 32);
        break;
      case 'oil_temp':
        this.telemetry.b58OilTempC = val;
        this.telemetry.b58OilTempF = Math.round((val * 1.8) + 32);
        break;
      case 'ethanol':
        this.telemetry.ethanolPct = val;
        break;
      case 'oil_pressure':
        this.telemetry.oilPressureBar = val;
        this.telemetry.oilPressurePsi = Number((val * 14.5038).toFixed(1));
        break;
      case 'engine_load':
        this.telemetry.engineLoadPct = val;
        break;
      case 'throttle':
        this.telemetry.throttlePct = val;
        break;
      case 'maf':
        this.telemetry.mafGps = val;
        break;
      case 'timing_advance':
        this.telemetry.timingAdvanceDeg = val;
        break;
      case 'stft':
        this.telemetry.stftPct = val;
        break;
      case 'ltft':
        this.telemetry.ltftPct = val;
        break;
      case 'voltage':
        this.telemetry.controlModuleVoltage = val;
        break;
      case 'fuel_level':
        this.telemetry.fuelLevelPct = val;
        break;
      case 'ambient_temp':
        this.telemetry.ambientTempC = val;
        this.telemetry.ambientTempF = Math.round((val * 1.8) + 32);
        break;
      case 'baro_pressure':
        this.telemetry.baroKpa = val;
        this.telemetry.baroPsi = Number((val * 0.145038).toFixed(1));
        break;
      case 'hpfp_pressure':
        this.telemetry.hpfpBar = val;
        this.telemetry.hpfpPsi = Math.round(val * 14.5038);
        break;
      case 'lambda_afr':
        this.telemetry.lambda = val;
        this.telemetry.afr = Number((val * 14.7).toFixed(2));
        break;
      case 'cat_temp':
        this.telemetry.catTempC = val;
        this.telemetry.catTempF = Math.round((val * 1.8) + 32);
        break;
      case 'pedal_pos':
        this.telemetry.pedalPosPct = val;
        break;
      case 'abs_load':
        this.telemetry.absLoadPct = val;
        break;
      case 'run_time':
        this.telemetry.runTimeSec = val;
        break;
      case 'charge_air_temp':
        this.telemetry.chargeAirTempC = val;
        this.telemetry.chargeAirTempF = Math.round((val * 1.8) + 32);
        break;
      case 'trans_temp':
        this.telemetry.transTempC = val;
        this.telemetry.transTempF = Math.round((val * 1.8) + 32);
        break;
      default:
        break;
    }
  }

  /**
   * Package current parsed telemetry values for local UI listeners & logger
   */
  public broadcastCurrentPayload(isSimulated = false): void {
    const now = Date.now();
    const payload: ObdStreamPayload = {
      channel: 'obd2_telemetry_stream',
      timestamp: now,
      isoTimestamp: new Date(now).toISOString(),
      status: this.state,
      isSimulated,
      device: {
        name: this.device?.name || (isSimulated ? 'B58 Virtual DME (Simulator)' : 'ELM327 BLE'),
        id: this.device?.id || (isSimulated ? 'SIM-B58-001' : 'UNKNOWN'),
        connected: this.state === 'connected' || this.state === 'polling',
        protocol: this.activeProtocol,
        serviceUuid: this.rxCharacteristic?.service?.uuid,
      },
      telemetry: { ...this.telemetry },
      rawResponses: { ...this.rawResponses },
      metrics: {
        loopHz: this.loopHz,
        latencyMs: this.averageLatencyMs,
        pollCount: this.pollCount,
        errorCount: this.errorCount,
        disconnectionCount: this.disconnectionCount,
      },
    };

    // Inform local UI listeners
    if (this.onTelemetryCb) {
      this.onTelemetryCb(this.telemetry, payload);
    }
  }

  /**
   * Update telemetry directly (used by simulator or external inputs)
   */
  public injectTelemetry(telemetry: Partial<ObdTelemetry>, rawResponses?: Record<string, string>): void {
    this.telemetry = {
      ...this.telemetry,
      ...telemetry,
    };
    if (rawResponses) {
      this.rawResponses = {
        ...this.rawResponses,
        ...rawResponses,
      };
    }
    this.pollCount++;
    this.broadcastCurrentPayload(true);
  }

  /**
   * Disconnection event handler from Web Bluetooth GATT Server
   */
  private onGattDisconnected = () => {
    this.disconnectionCount++;
    this.isPollingActive = false;
    this.log('error', `⚠️ Unexpected Bluetooth GATT disconnection detected (Event #${this.disconnectionCount}).`);

    if (this.commandTimeoutId) {
      clearTimeout(this.commandTimeoutId);
      this.commandTimeoutId = null;
    }

    if (this.currentRejecter) {
      this.currentRejecter(new Error('GATT Server disconnected during command'));
      this.currentResolver = null;
      this.currentRejecter = null;
    }

    if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delayMs = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
      this.setState('reconnecting');
      this.log('info', `Attempting auto-reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${Math.round(delayMs / 1000)}s...`);

      this.reconnectTimer = setTimeout(async () => {
        try {
          if (this.device && this.device.gatt) {
            await this.establishGattConnection();
          }
        } catch (err: any) {
          this.log('error', `Reconnection attempt failed: ${err.message}`);
          this.onGattDisconnected();
        }
      }, delayMs);
    } else {
      this.setState('disconnected');
      this.log('info', 'Disconnected from OBD2 device.');
    }
  };

  /**
   * Explicit disconnect by user
   */
  public async disconnect(): Promise<void> {
    this.isPollingActive = false;
    this.autoReconnect = false;
    this.resetPollingCounters();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.rxCharacteristic) {
      try {
        await this.rxCharacteristic.stopNotifications();
      } catch {
        // ignore
      }
    }

    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }

    this.device = null;
    this.server = null;
    this.rxCharacteristic = null;
    this.txCharacteristic = null;
    this.setState('disconnected');
    this.log('info', 'OBD2 BLE session terminated.');
  }

  public destroy(): void {
    this.disconnect();
  }
}

export const obd2Service = new Obd2BleService();
