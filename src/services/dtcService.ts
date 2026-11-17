import { DtcCode, DtcScanResult, DtcSeverity, DtcSystem } from '../types';
import { obd2Service } from './obd2BleService';

// Built-in OBD-II & BMW B58 Diagnostic Trouble Code Definitions
export const DTC_DATABASE: Record<
  string,
  {
    description: string;
    explanation: string;
    system: DtcSystem;
    severity: DtcSeverity;
    causes: string[];
  }
> = {
  // Common Generic Powertrain P0xxx
  P0300: {
    description: 'Random / Multiple Cylinder Misfire Detected',
    explanation: 'The powertrain control module (PCM) detected irregular crankshaft acceleration indicating one or more cylinders are failing to fire properly.',
    system: 'Powertrain',
    severity: 'critical',
    causes: ['Worn spark plugs or ignition coils', 'Fuel injector clog/failure', 'Low fuel pressure', 'Vacuum leak or boost leak'],
  },
  P0301: {
    description: 'Cylinder 1 Misfire Detected',
    explanation: 'Cylinder #1 combustion failure detected by DME/ECU.',
    system: 'Powertrain',
    severity: 'critical',
    causes: ['Faulty coil pack on cylinder 1', 'Fouled spark plug #1', 'Injector #1 failure'],
  },
  P0302: {
    description: 'Cylinder 2 Misfire Detected',
    explanation: 'Cylinder #2 combustion failure detected by DME/ECU.',
    system: 'Powertrain',
    severity: 'critical',
    causes: ['Faulty coil pack on cylinder 2', 'Fouled spark plug #2', 'Injector #2 failure'],
  },
  P0303: {
    description: 'Cylinder 3 Misfire Detected',
    explanation: 'Cylinder #3 combustion failure detected by DME/ECU.',
    system: 'Powertrain',
    severity: 'critical',
    causes: ['Faulty coil pack on cylinder 3', 'Fouled spark plug #3', 'Injector #3 failure'],
  },
  P0304: {
    description: 'Cylinder 4 Misfire Detected',
    explanation: 'Cylinder #4 combustion failure detected by DME/ECU.',
    system: 'Powertrain',
    severity: 'critical',
    causes: ['Faulty coil pack on cylinder 4', 'Fouled spark plug #4', 'Injector #4 failure'],
  },
  P0305: {
    description: 'Cylinder 5 Misfire Detected',
    explanation: 'Cylinder #5 combustion failure detected by DME/ECU.',
    system: 'Powertrain',
    severity: 'critical',
    causes: ['Faulty coil pack on cylinder 5', 'Fouled spark plug #5', 'Injector #5 failure'],
  },
  P0306: {
    description: 'Cylinder 6 Misfire Detected (B58 Cyl 6)',
    explanation: 'Cylinder #6 combustion failure detected on inline-6 cylinder #6.',
    system: 'Powertrain',
    severity: 'critical',
    causes: ['Faulty coil pack on cylinder 6', 'Fouled spark plug #6', 'Injector #6 failure'],
  },
  P0420: {
    description: 'Catalyst System Efficiency Below Threshold (Bank 1)',
    explanation: 'Post-catalytic O2 sensor signal mimics pre-catalytic sensor, indicating reduced catalytic converter efficiency or aftermarket decat/high-flow downpipe.',
    system: 'Powertrain',
    severity: 'warning',
    causes: ['High-flow or decat downpipe installed', 'Downstream O2 oxygen sensor failure', 'Exhaust leak before or at O2 bung', 'Aged catalytic converter'],
  },
  P0171: {
    description: 'System Too Lean (Bank 1)',
    explanation: 'Air-fuel ratio is running excessively lean; DME has reached max positive short/long-term fuel trim (+25%).',
    system: 'Powertrain',
    severity: 'warning',
    causes: ['Unmetered intake vacuum leak', 'High ethanol blend without proper DME fuel scaling', 'Dirty or failing MAF sensor', 'Low fuel rail pressure'],
  },
  P0172: {
    description: 'System Too Rich (Bank 1)',
    explanation: 'DME detected excess fuel in exhaust gases; negative fuel trim limit reached.',
    system: 'Powertrain',
    severity: 'warning',
    causes: ['Leaking fuel injector', 'Faulty high pressure fuel pump (HPFP)', 'Restricted air intake filter'],
  },
  P0128: {
    description: 'Coolant Thermostat (Coolant Temp Below Regulating Temp)',
    explanation: 'Engine fails to reach operating coolant temperature within the expected time window.',
    system: 'Powertrain',
    severity: 'warning',
    causes: ['Thermostat stuck open', 'Defective engine coolant temperature (ECT) sensor', 'Low coolant level in cooling circuit'],
  },
  P0234: {
    description: 'Turbocharger / Supercharger Overboost Condition',
    explanation: 'Manifold absolute pressure (MAP) exceeded the commanded target boost pressure table.',
    system: 'Powertrain',
    severity: 'critical',
    causes: ['Wastegate actuator stuck or out of calibration', 'Faulty boost control solenoid (EWG)', 'Aggressive aftermarket tune overboost'],
  },
  P0299: {
    description: 'Turbocharger / Supercharger Underboost Condition',
    explanation: 'Boost pressure is significantly below target requested by DME.',
    system: 'Powertrain',
    severity: 'warning',
    causes: ['Boost leak (charge pipe, intercooler hose, O-ring)', 'Defective diverter valve / blow-off valve', 'Faulty wastegate'],
  },
  P0113: {
    description: 'Intake Air Temperature Sensor 1 Circuit High',
    explanation: 'IAT sensor circuit open or voltage reading above maximum threshold.',
    system: 'Powertrain',
    severity: 'warning',
    causes: ['Disconnected charge pipe IAT harness', 'Damaged temperature sensor wire', 'Defective IAT probe'],
  },
  P0507: {
    description: 'Idle Air Control System RPM Higher Than Expected',
    explanation: 'Engine idle speed is higher than commanded target idle table.',
    system: 'Powertrain',
    severity: 'info',
    causes: ['Intake vacuum leak after throttle body', 'PCV valve membrane tear or valve cover leak', 'Throttle body carbon buildup'],
  },
  // BMW B58 & Extended DTCs
  P1083: {
    description: 'BMW Fuel Control Mixture Lean (Bank 1 Sensor 1)',
    explanation: 'BMW DME specific closed-loop air/fuel ratio correction exceeded upper additive trim limit.',
    system: 'BMW Special',
    severity: 'warning',
    causes: ['Ethanol blend scaling mismatch', 'Intake plenum leak', 'Primary wideband O2 sensor degradation'],
  },
  P1400: {
    description: 'BMW Heated Catalyst Battery Voltage / Power Circuit Low',
    explanation: 'Pre-heating circuit for catalytic emission monitoring below nominal voltage.',
    system: 'BMW Special',
    severity: 'info',
    causes: ['Low auxiliary 12V battery voltage', 'Relay contact resistance', 'O2 heater fuse'],
  },
  '120408': {
    description: 'BMW B58 Charging Pressure Control: Deactivation (Emergency Safe Mode)',
    explanation: 'DME triggered boost safety deactivation due to target deviation, exhaust gas temperature, or knock threshold.',
    system: 'BMW Special',
    severity: 'critical',
    causes: ['Electronic Wastegate (EWG) mechanical bind', 'Overboost safety trip', 'Charge pipe pressure leak'],
  },
  '108A01': {
    description: 'BMW B58 Intake Manifold Absolute Pressure: Plausibility Error',
    explanation: 'Pressure delta between throttle body pre-MAP and manifold T-MAP sensor out of tolerance.',
    system: 'BMW Special',
    severity: 'warning',
    causes: ['Loose TMAP sensor on intake manifold', 'Damaged O-ring seal', 'Faulty MAP sensor harness'],
  },
  '118001': {
    description: 'BMW B58 Mixture Control: Fuel-Air Mixture Too Lean (High Ethanol Blend)',
    explanation: 'Lambda adaptation exceeded limits under high-load boost conditions.',
    system: 'BMW Special',
    severity: 'warning',
    causes: ['Ethanol content exceeding HPFP fuel volume capability', 'Clogged in-tank fuel pre-filter'],
  },
  '140010': {
    description: 'BMW B58 Combustion Misfires: Several Cylinders Detected',
    explanation: 'Multiple cylinder misfire detected during wide-open throttle spool.',
    system: 'BMW Special',
    severity: 'critical',
    causes: ['Spark plug gap too wide for elevated boost', 'Weak ignition coils', 'Fuel rail pressure dip'],
  },
  // Chassis / Body / Network
  C0035: {
    description: 'Left Front Wheel Speed Sensor Circuit Fault',
    explanation: 'ABS / DSC module lost pulsed frequency signal from front-left wheel hub sensor.',
    system: 'Chassis',
    severity: 'warning',
    causes: ['Wheel speed sensor wire chafed by suspension', 'Dirty reluctor ring', 'Defective ABS sensor'],
  },
  U0100: {
    description: 'Lost Communication with ECM / PCM "A"',
    explanation: 'CAN bus communication timeout between gateway module and engine control unit.',
    system: 'Network',
    severity: 'critical',
    causes: ['CAN High/Low wiring termination resistance fault', 'Low system voltage during start', 'OBD2 adapter latency'],
  },
  B0100: {
    description: 'Electronic Front End Sensor 1 Circuit Fault',
    explanation: 'Airbag / SRS control module detected abnormal resistance on crash sensor circuit.',
    system: 'Body',
    severity: 'critical',
    causes: ['Impact sensor connector loose', 'Wiring harness corrosion', 'Front crash sensor fault'],
  },
};

class DtcService {
  private isScanning = false;
  private isClearing = false;

  // Simulated DTCs in memory for offline testing
  private simulatedDtcCodes: DtcCode[] = [
    {
      code: 'P0420',
      hexRaw: '04 20',
      type: 'generic',
      mode: 'Mode 03 (Stored)',
      system: 'Powertrain',
      description: 'Catalyst System Efficiency Below Threshold (Bank 1)',
      explanation: 'Post-catalytic O2 sensor signal mimics pre-catalytic sensor, commonly seen on high-flow / decat downpipes.',
      possibleCauses: ['High-flow downpipe installed', 'Downstream O2 oxygen sensor failure', 'Exhaust leak at turbo flange'],
      severity: 'warning',
    },
    {
      code: 'P0171',
      hexRaw: '01 71',
      type: 'generic',
      mode: 'Mode 03 (Stored)',
      system: 'Powertrain',
      description: 'System Too Lean (Bank 1)',
      explanation: 'Air-fuel ratio is running lean. Positive fuel trim limit reached (+25%).',
      possibleCauses: ['High ethanol content (E30-E50) without custom fuel scaling', 'Intake charge pipe seal leak'],
      severity: 'warning',
    },
    {
      code: '120408',
      hexRaw: '12 04 08',
      type: 'b58_bmw',
      mode: 'Mode 22',
      system: 'BMW Special',
      description: 'BMW B58 Charging Pressure Control: Deactivation',
      explanation: 'DME triggered boost control deactivation due to target deviation.',
      possibleCauses: ['Electronic Wastegate (EWG) adaptation needed', 'Temporary overboost protection'],
      severity: 'critical',
    },
  ];

  public getIsScanning(): boolean {
    return this.isScanning;
  }

  public getIsClearing(): boolean {
    return this.isClearing;
  }

  /**
   * Decode 2-byte OBD-II Diagnostic Trouble Code
   * e.g. 0x03, 0x00 -> P0300
   */
  public decodeStandardDtc(byte1Hex: string, byte2Hex: string): string {
    const b1 = parseInt(byte1Hex, 16);
    const b2 = parseInt(byte2Hex, 16);

    if (isNaN(b1) || isNaN(b2)) return 'P0000';

    // System prefix (bits 7-6 of byte 1)
    const typeBits = (b1 >> 6) & 0x03;
    let prefix = 'P';
    if (typeBits === 1) prefix = 'C';
    else if (typeBits === 2) prefix = 'B';
    else if (typeBits === 3) prefix = 'U';

    // Second digit (bits 5-4 of byte 1)
    const secondDigit = (b1 >> 4) & 0x03;

    // Third digit (bits 3-0 of byte 1)
    const thirdDigit = (b1 & 0x0f).toString(16).toUpperCase();

    // Fourth and fifth digits (byte 2)
    const fourthFifth = byte2Hex.padStart(2, '0').toUpperCase();

    return `${prefix}${secondDigit}${thirdDigit}${fourthFifth}`;
  }

  /**
   * Parse raw hex string from Mode 03 / Mode 07 / Mode 0A response
   */
  public parseDtcResponse(rawHex: string, mode: DtcCode['mode']): DtcCode[] {
    const codes: DtcCode[] = [];
    const clean = rawHex.replace(/[>\r\n\s]/g, '').toUpperCase();

    // Check for "NO DATA", "UNABLE TO CONNECT", or 43 00 (0 codes)
    if (clean.includes('NODATA') || clean.includes('ERROR') || clean.includes('UNABLE')) {
      return [];
    }

    // Response starts with 43 (Mode 03), 47 (Mode 07), 4A (Mode 0A)
    // Format: 43 [DTC count or directly 2-byte pairs]
    let payloadHex = clean;
    if (payloadHex.startsWith('43') || payloadHex.startsWith('47') || payloadHex.startsWith('4A')) {
      payloadHex = payloadHex.substring(2);
    }

    // If first byte is number of DTCs (e.g. 02 for 2 DTCs), skip it if length matches
    if (payloadHex.length % 4 !== 0 && payloadHex.length >= 2) {
      payloadHex = payloadHex.substring(2);
    }

    // Extract 4-hex-char chunks (2 bytes each)
    for (let i = 0; i + 3 < payloadHex.length; i += 4) {
      const chunk = payloadHex.substring(i, i + 4);
      if (chunk === '0000') continue; // padding bytes

      const b1 = chunk.substring(0, 2);
      const b2 = chunk.substring(2, 4);
      const dtcString = this.decodeStandardDtc(b1, b2);

      if (dtcString && dtcString !== 'P0000') {
        const info = DTC_DATABASE[dtcString] || {
          description: `Diagnostic Trouble Code ${dtcString}`,
          explanation: 'Standard SAE OBD-II diagnostic fault code logged by the engine control module.',
          system: dtcString.startsWith('P') ? 'Powertrain' : dtcString.startsWith('C') ? 'Chassis' : dtcString.startsWith('B') ? 'Body' : 'Network',
          severity: 'warning',
          causes: ['Sensor out of range', 'Circuit open or short', 'Component mechanical fault'],
        };

        codes.push({
          code: dtcString,
          hexRaw: `${b1} ${b2}`,
          type: 'generic',
          mode,
          system: info.system,
          description: info.description,
          explanation: info.explanation,
          possibleCauses: info.causes,
          severity: info.severity,
        });
      }
    }

    return codes;
  }

  /**
   * Scan vehicle for DTCs across Mode 01 PID 01 (MIL Status), Mode 03 (Stored), Mode 07 (Pending), Mode 0A (Permanent)
   */
  public async scanVehicleDtc(isSimulated = false): Promise<DtcScanResult> {
    this.isScanning = true;
    const now = Date.now();

    // If in simulation mode
    if (isSimulated) {
      await new Promise((res) => setTimeout(res, 800)); // realistic bus query delay
      this.isScanning = false;
      const codes = [...this.simulatedDtcCodes];
      return {
        timestamp: now,
        isoTimestamp: new Date(now).toISOString(),
        milActive: codes.length > 0,
        dtcCount: codes.length,
        codes,
        rawMode0101: '41 01 83 07 65 00',
        rawMode03: '43 02 04 20 01 71',
        isSimulated: true,
        statusMessage: codes.length > 0 ? `Found ${codes.length} active Diagnostic Trouble Codes (Simulated).` : 'No Diagnostic Trouble Codes detected (ECU Clean).',
      };
    }

    try {
      // 1. Query Mode 01 PID 01: Status since DTCs cleared (MIL & DTC count)
      let milActive = false;
      let dtcCount = 0;
      let raw0101 = '';

      try {
        raw0101 = await obd2Service.sendCommand('0101', 1500);
        const clean0101 = raw0101.replace(/[>\r\n\s]/g, '').toUpperCase();
        const match = clean0101.match(/4101([0-9A-F]{2})/i);
        if (match) {
          const a = parseInt(match[1], 16);
          milActive = (a & 0x80) !== 0; // Bit 7: MIL ON
          dtcCount = a & 0x7f;        // Bits 0-6: DTC count
        }
      } catch {
        // continue
      }

      // 2. Query Mode 03: Stored Diagnostic Trouble Codes
      const raw03 = await obd2Service.sendCommand('03', 2000).catch(() => 'NODATA');
      const storedCodes = this.parseDtcResponse(raw03, 'Mode 03 (Stored)');

      // 3. Query Mode 07: Pending DTCs
      const raw07 = await obd2Service.sendCommand('07', 1500).catch(() => 'NODATA');
      const pendingCodes = this.parseDtcResponse(raw07, 'Mode 07 (Pending)');

      // 4. Query Mode 0A: Permanent DTCs
      const raw0A = await obd2Service.sendCommand('0A', 1500).catch(() => 'NODATA');
      const permanentCodes = this.parseDtcResponse(raw0A, 'Mode 0A (Permanent)');

      // Deduplicate codes by code name + mode
      const allCodesMap = new Map<string, DtcCode>();
      [...storedCodes, ...pendingCodes, ...permanentCodes].forEach((c) => {
        allCodesMap.set(`${c.code}-${c.mode}`, c);
      });

      const uniqueCodes = Array.from(allCodesMap.values());
      const totalCount = uniqueCodes.length || dtcCount;

      this.isScanning = false;
      return {
        timestamp: now,
        isoTimestamp: new Date(now).toISOString(),
        milActive: milActive || uniqueCodes.length > 0,
        dtcCount: totalCount,
        codes: uniqueCodes,
        rawMode0101: raw0101,
        rawMode03: raw03,
        rawMode07: raw07,
        rawMode0A: raw0A,
        isSimulated: false,
        statusMessage: uniqueCodes.length > 0 ? `Scan complete: ${uniqueCodes.length} DTC(s) identified.` : 'No diagnostic fault codes stored in ECU.',
      };
    } catch (err: any) {
      this.isScanning = false;
      throw new Error(`DTC Query failed: ${err.message || err}`);
    }
  }

  /**
   * Clear Diagnostic Trouble Codes (Mode 04)
   * Sends OBD Mode 04 ('04') to reset ECU fault memory and turn off the MIL (Check Engine Light).
   */
  public async clearVehicleDtc(isSimulated = false): Promise<{ success: boolean; message: string }> {
    this.isClearing = true;

    if (isSimulated) {
      await new Promise((res) => setTimeout(res, 1000));
      this.simulatedDtcCodes = [];
      this.isClearing = false;
      return {
        success: true,
        message: 'OBD Mode 04: Diagnostic Trouble Codes successfully cleared. Check Engine Light (MIL) reset (Simulated).',
      };
    }

    try {
      // Send Mode 04 command
      const res = await obd2Service.sendCommand('04', 2500);
      this.isClearing = false;

      return {
        success: true,
        message: `OBD Mode 04: Fault codes cleared. ECU response: ${res.replace(/[>\r\n]/g, '').trim() || 'OK'}`,
      };
    } catch (err: any) {
      this.isClearing = false;
      throw new Error(`Mode 04 DTC Clear command failed: ${err.message || err}`);
    }
  }

  /**
   * Inject simulated fault code for testing
   */
  public injectSimulatedDtc(code: string): void {
    const info = DTC_DATABASE[code] || {
      description: `Test DTC ${code}`,
      explanation: 'Simulated fault injected for testing scanner and alert UI.',
      system: 'Powertrain',
      severity: 'warning',
      causes: ['Test fault injection'],
    };

    const newCode: DtcCode = {
      code,
      hexRaw: 'TEST',
      type: 'generic',
      mode: 'Mode 03 (Stored)',
      system: info.system,
      description: info.description,
      explanation: info.explanation,
      possibleCauses: info.causes,
      severity: info.severity,
    };

    this.simulatedDtcCodes = [...this.simulatedDtcCodes.filter((c) => c.code !== code), newCode];
  }
}

export const dtcService = new DtcService();
