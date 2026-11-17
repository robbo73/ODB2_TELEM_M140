import { PidConfigItem, PidFormulaId } from '../types';

const STORAGE_KEY = 'obd2_pid_configs_v2';

export interface FormulaDefinition {
  id: PidFormulaId;
  label: string;
  description: string;
  byteCount: 1 | 2;
}

export const FORMULA_OPTIONS: FormulaDefinition[] = [
  { id: 'rpm', label: '((A * 256) + B) / 4 [RPM]', description: 'Standard Engine RPM', byteCount: 2 },
  { id: 'speed', label: 'A [km/h]', description: 'Vehicle Speed (1 byte)', byteCount: 1 },
  { id: 'map_boost', label: 'A [kPa -> Boost PSI]', description: 'Manifold Absolute Pressure', byteCount: 1 },
  { id: 'temp_offset_40', label: 'A - 40 [°C]', description: 'Standard OBD2 Temperature', byteCount: 1 },
  { id: 'temp_offset_48', label: 'A - 48 [BMW °C]', description: 'BMW Bosch MG1 DME Temperature', byteCount: 1 },
  { id: 'percent_255', label: '(A * 100) / 255 [%]', description: 'Percentage (0-100%)', byteCount: 1 },
  { id: 'fuel_trim', label: '(A - 128) * 100 / 128 [%]', description: 'Short/Long Term Fuel Trim (-100 to +99.2%)', byteCount: 1 },
  { id: 'timing_advance', label: '(A / 2) - 64 [°BTDC]', description: 'Ignition Timing Advance', byteCount: 1 },
  { id: 'maf_gps', label: '((A * 256) + B) / 100 [g/s]', description: 'Mass Air Flow Rate', byteCount: 2 },
  { id: 'voltage_mv', label: '((A * 256) + B) / 1000 [V]', description: 'Control Module Voltage', byteCount: 2 },
  { id: 'oil_pressure_b58', label: 'BMW Oil Pressure [Bar/PSI]', description: '2-byte mbar/kPa or 1-byte * 0.1 Bar', byteCount: 2 },
  { id: 'fuel_rail_10kpa', label: '((A * 256) + B) * 10 [kPa -> Bar]', description: 'HPFP / Fuel Rail Gauge Pressure', byteCount: 2 },
  { id: 'fuel_pressure_3kpa', label: 'A * 3 [kPa -> Bar]', description: 'Low Pressure Fuel System', byteCount: 1 },
  { id: 'lambda_ratio', label: '((A * 256) + B) / 32768 [Lambda]', description: 'Commanded Equivalence Ratio / AFR', byteCount: 2 },
  { id: 'cat_temp', label: '((A * 256) + B) / 10 - 40 [°C]', description: 'Catalyst / Exhaust Gas Temp', byteCount: 2 },
  { id: 'abs_load', label: '((A * 256) + B) * 100 / 255 [%]', description: 'Absolute Engine Load', byteCount: 2 },
  { id: 'run_time', label: '(A * 256) + B [sec]', description: 'Engine Run Time Seconds', byteCount: 2 },
  { id: 'raw_byte', label: 'A [Raw 1-Byte]', description: 'Direct single byte (0-255)', byteCount: 1 },
  { id: 'raw_2byte', label: '(A * 256) + B [Raw 2-Byte]', description: 'Direct 16-bit integer', byteCount: 2 },
  { id: 'custom', label: 'Custom Math Formula', description: 'Custom expression using bytes A, B, C, D', byteCount: 2 },
];

export const DEFAULT_PIDS: PidConfigItem[] = [
  {
    id: 'rpm',
    name: 'Engine RPM',
    command: '010C',
    enabled: true,
    category: 'standard',
    description: 'Engine Crankshaft Speed (0-8000 RPM)',
    unit: 'RPM',
    expectedHeader: '41 0C',
    formula: 'rpm',
    min: 0,
    max: 7000,
    warningThreshold: 6000,
    dangerThreshold: 6500,
    accentColor: 'cyan',
    pollRate: 'fast',
  },
  {
    id: 'speed',
    name: 'Vehicle Speed',
    command: '010D',
    enabled: true,
    category: 'standard',
    description: 'Vehicle Ground Speed',
    unit: 'km/h',
    imperialUnit: 'MPH',
    expectedHeader: '41 0D',
    formula: 'speed',
    min: 0,
    max: 260,
    imperialMin: 0,
    imperialMax: 160,
    accentColor: 'blue',
    pollRate: 'fast',
  },
  {
    id: 'map',
    name: 'Intake Pressure / MAP',
    command: '010B',
    enabled: true,
    category: 'standard',
    description: 'Manifold Absolute Pressure & Gauge Boost',
    unit: 'PSI Boost',
    expectedHeader: '41 0B',
    formula: 'map_boost',
    min: 0,
    max: 25,
    warningThreshold: 18,
    dangerThreshold: 22,
    accentColor: 'purple',
    pollRate: 'fast',
  },
  {
    id: 'coolant',
    name: 'Coolant Temp',
    command: '0105',
    enabled: true,
    category: 'standard',
    description: 'Engine Coolant Temp (ECT)',
    unit: '°C',
    imperialUnit: '°F',
    expectedHeader: '41 05',
    formula: 'temp_offset_40',
    min: 0,
    max: 130,
    imperialMin: 32,
    imperialMax: 260,
    warningThreshold: 104,
    dangerThreshold: 112,
    imperialWarningThreshold: 219,
    imperialDangerThreshold: 234,
    accentColor: 'emerald',
    pollRate: 'fast',
  },
  {
    id: 'iat',
    name: 'Intake Air Temp',
    command: '010F',
    enabled: true,
    category: 'standard',
    description: 'Charge Air / Intake Temperature (IAT)',
    unit: '°C',
    imperialUnit: '°F',
    expectedHeader: '41 0F',
    formula: 'temp_offset_40',
    min: -10,
    max: 80,
    imperialMin: 14,
    imperialMax: 176,
    warningThreshold: 50,
    dangerThreshold: 62,
    imperialWarningThreshold: 122,
    imperialDangerThreshold: 144,
    accentColor: 'cyan',
    pollRate: 'fast',
  },
  {
    id: 'oil_temp',
    name: 'Oil Temperature',
    command: '222020',
    enabled: true,
    category: 'b58',
    description: 'BMW DME Mode 22 Oil Temp (Editable to 015C for standard OBD2)',
    unit: '°C',
    imperialUnit: '°F',
    expectedHeader: '62 20 20',
    formula: 'temp_offset_48',
    min: 40,
    max: 140,
    imperialMin: 100,
    imperialMax: 280,
    warningThreshold: 108,
    dangerThreshold: 118,
    imperialWarningThreshold: 226,
    imperialDangerThreshold: 244,
    accentColor: 'amber',
    pollRate: 'fast',
  },
  {
    id: 'ethanol',
    name: 'Ethanol Content',
    command: '22202B',
    enabled: true,
    category: 'b58',
    description: 'Flex Fuel / DME Ethanol Percentage (Editable to 0152)',
    unit: '%',
    expectedHeader: '62 20 2B',
    formula: 'percent_255',
    min: 0,
    max: 100,
    accentColor: 'emerald',
    pollRate: 'fast',
  },
  {
    id: 'oil_pressure',
    name: 'Oil Pressure',
    command: '222026',
    enabled: true,
    category: 'b58',
    description: 'BMW DME Engine Oil Pressure (Editable to 015E)',
    unit: 'Bar',
    imperialUnit: 'PSI',
    expectedHeader: '62 20 26',
    formula: 'oil_pressure_b58',
    min: 0,
    max: 7,
    imperialMin: 0,
    imperialMax: 100,
    accentColor: 'rose',
    pollRate: 'fast',
  },
  {
    id: 'engine_load',
    name: 'Calculated Engine Load',
    command: '0104',
    enabled: true,
    category: 'standard',
    description: 'Calculated Engine Load Value (0-100%)',
    unit: '%',
    expectedHeader: '41 04',
    formula: 'percent_255',
    min: 0,
    max: 100,
    warningThreshold: 90,
    dangerThreshold: 98,
    accentColor: 'cyan',
    pollRate: 'fast',
  },
  {
    id: 'throttle',
    name: 'Throttle Position',
    command: '0111',
    enabled: true,
    category: 'standard',
    description: 'Absolute Throttle Plate Position (%)',
    unit: '%',
    expectedHeader: '41 11',
    formula: 'percent_255',
    min: 0,
    max: 100,
    accentColor: 'blue',
    pollRate: 'fast',
  },
  {
    id: 'timing_advance',
    name: 'Timing Advance',
    command: '010E',
    enabled: true,
    category: 'standard',
    description: 'Ignition Timing Advance Cylinder #1 (°BTDC)',
    unit: '°',
    expectedHeader: '41 0E',
    formula: 'timing_advance',
    min: -20,
    max: 50,
    accentColor: 'purple',
    pollRate: 'fast',
  },
  {
    id: 'maf',
    name: 'Mass Air Flow (MAF)',
    command: '0110',
    enabled: true,
    category: 'standard',
    description: 'Mass Air Flow Sensor Rate (g/s)',
    unit: 'g/s',
    expectedHeader: '41 10',
    formula: 'maf_gps',
    min: 0,
    max: 450,
    warningThreshold: 380,
    dangerThreshold: 430,
    accentColor: 'cyan',
    pollRate: 'fast',
  },
  {
    id: 'lambda_afr',
    name: 'Air-Fuel Ratio / Lambda',
    command: '0144',
    enabled: true,
    category: 'standard',
    description: 'Commanded Fuel-Air Equivalence Ratio (AFR / Lambda)',
    unit: 'AFR',
    expectedHeader: '41 44',
    formula: 'lambda_ratio',
    min: 10,
    max: 20,
    warningThreshold: 15.5,
    dangerThreshold: 16.5,
    accentColor: 'emerald',
    pollRate: 'fast',
  },
  {
    id: 'hpfp_pressure',
    name: 'Fuel Rail / HPFP Pressure',
    command: '0123',
    enabled: true,
    category: 'standard',
    description: 'Direct Injection Fuel Rail Gauge Pressure',
    unit: 'Bar',
    imperialUnit: 'PSI',
    expectedHeader: '41 23',
    formula: 'fuel_rail_10kpa',
    min: 0,
    max: 350,
    imperialMin: 0,
    imperialMax: 5000,
    accentColor: 'amber',
    pollRate: 'fast',
  },
  {
    id: 'stft',
    name: 'Short Term Fuel Trim B1',
    command: '0106',
    enabled: true,
    category: 'standard',
    description: 'Short Term Fuel Trim Bank 1 (-25% to +25%)',
    unit: '%',
    expectedHeader: '41 06',
    formula: 'fuel_trim',
    min: -25,
    max: 25,
    warningThreshold: 12,
    dangerThreshold: 20,
    accentColor: 'blue',
    pollRate: 'slow',
  },
  {
    id: 'ltft',
    name: 'Long Term Fuel Trim B1',
    command: '0107',
    enabled: true,
    category: 'standard',
    description: 'Long Term Fuel Trim Bank 1 (-25% to +25%)',
    unit: '%',
    expectedHeader: '41 07',
    formula: 'fuel_trim',
    min: -25,
    max: 25,
    warningThreshold: 10,
    dangerThreshold: 18,
    accentColor: 'purple',
    pollRate: 'slow',
  },
  {
    id: 'voltage',
    name: 'Control Module Voltage',
    command: '0142',
    enabled: true,
    category: 'standard',
    description: 'ECU / Alternator Battery Voltage',
    unit: 'V',
    expectedHeader: '41 42',
    formula: 'voltage_mv',
    min: 10,
    max: 16,
    warningThreshold: 15,
    dangerThreshold: 15.6,
    accentColor: 'emerald',
    pollRate: 'slow',
  },
  {
    id: 'pedal_pos',
    name: 'Accelerator Pedal Pos',
    command: '0149',
    enabled: true,
    category: 'standard',
    description: 'Accelerator Pedal Position Sensor D (%)',
    unit: '%',
    expectedHeader: '41 49',
    formula: 'percent_255',
    min: 0,
    max: 100,
    accentColor: 'cyan',
    pollRate: 'fast',
  },
  {
    id: 'abs_load',
    name: 'Absolute Engine Load',
    command: '0143',
    enabled: true,
    category: 'standard',
    description: 'Absolute Normalized Load Value (can exceed 100% under boost)',
    unit: '%',
    expectedHeader: '41 43',
    formula: 'abs_load',
    min: 0,
    max: 250,
    warningThreshold: 190,
    dangerThreshold: 225,
    accentColor: 'purple',
    pollRate: 'slow',
  },
  {
    id: 'fuel_level',
    name: 'Fuel Tank Level',
    command: '012F',
    enabled: true,
    category: 'standard',
    description: 'Fuel Tank Level Input (%)',
    unit: '%',
    expectedHeader: '41 2F',
    formula: 'percent_255',
    min: 0,
    max: 100,
    accentColor: 'amber',
    pollRate: 'slow',
  },
  {
    id: 'ambient_temp',
    name: 'Ambient Air Temp',
    command: '0146',
    enabled: true,
    category: 'standard',
    description: 'Outside Ambient Air Temperature',
    unit: '°C',
    imperialUnit: '°F',
    expectedHeader: '41 46',
    formula: 'temp_offset_40',
    min: -20,
    max: 55,
    imperialMin: -4,
    imperialMax: 130,
    accentColor: 'blue',
    pollRate: 'slow',
  },
  {
    id: 'baro_pressure',
    name: 'Barometric Pressure',
    command: '0133',
    enabled: true,
    category: 'standard',
    description: 'Absolute Barometric Pressure (Atmospheric)',
    unit: 'kPa',
    imperialUnit: 'PSI',
    expectedHeader: '41 33',
    formula: 'raw_byte',
    min: 70,
    max: 110,
    imperialMin: 10,
    imperialMax: 16,
    accentColor: 'cyan',
    pollRate: 'slow',
  },
  {
    id: 'cat_temp',
    name: 'Catalyst Temp (B1S1)',
    command: '013C',
    enabled: true,
    category: 'standard',
    description: 'Catalytic Converter / Downpipe Temp Bank 1 Sensor 1',
    unit: '°C',
    imperialUnit: '°F',
    expectedHeader: '41 3C',
    formula: 'cat_temp',
    min: 100,
    max: 1000,
    imperialMin: 212,
    imperialMax: 1832,
    warningThreshold: 870,
    dangerThreshold: 950,
    imperialWarningThreshold: 1598,
    imperialDangerThreshold: 1742,
    accentColor: 'rose',
    pollRate: 'slow',
  },
  {
    id: 'charge_air_temp',
    name: 'Charge Air Temp (Post-IC)',
    command: '222030',
    enabled: true,
    category: 'b58',
    description: 'BMW DME Post-Intercooler Charge Air Temp (Mode 22)',
    unit: '°C',
    imperialUnit: '°F',
    expectedHeader: '62 20 30',
    formula: 'temp_offset_48',
    min: 0,
    max: 90,
    imperialMin: 32,
    imperialMax: 194,
    warningThreshold: 55,
    dangerThreshold: 68,
    imperialWarningThreshold: 131,
    imperialDangerThreshold: 154,
    accentColor: 'cyan',
    pollRate: 'slow',
  },
  {
    id: 'trans_temp',
    name: 'Transmission Fluid Temp',
    command: '222035',
    enabled: true,
    category: 'b58',
    description: 'BMW ZF8 / Gearbox Oil Temperature (Mode 22)',
    unit: '°C',
    imperialUnit: '°F',
    expectedHeader: '62 20 35',
    formula: 'temp_offset_48',
    min: 20,
    max: 140,
    imperialMin: 68,
    imperialMax: 284,
    warningThreshold: 105,
    dangerThreshold: 120,
    imperialWarningThreshold: 221,
    imperialDangerThreshold: 248,
    accentColor: 'amber',
    pollRate: 'slow',
  },
  {
    id: 'run_time',
    name: 'Engine Run Time',
    command: '011F',
    enabled: true,
    category: 'standard',
    description: 'Time Since Engine Start (Seconds)',
    unit: 'sec',
    expectedHeader: '41 1F',
    formula: 'run_time',
    min: 0,
    max: 3600,
    accentColor: 'emerald',
    pollRate: 'slow',
  },
];

export function normalizeCommand(cmd: string): string {
  return cmd.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

export function computeExpectedHeader(cmd: string): string {
  const clean = normalizeCommand(cmd);
  if (clean.length < 2) return clean;
  const modeByte = parseInt(clean.slice(0, 2), 16);
  if (isNaN(modeByte)) return clean;
  const respMode = ((modeByte + 0x40) & 0xff).toString(16).toUpperCase().padStart(2, '0');
  const rest = clean.slice(2);
  const pairs: string[] = [respMode];
  for (let i = 0; i < rest.length; i += 2) {
    pairs.push(rest.slice(i, i + 2));
  }
  return pairs.join(' ');
}

export function computeExpectedHexPrefix(cmd: string): string {
  const clean = normalizeCommand(cmd);
  if (clean.length < 2) return clean;
  const modeByte = parseInt(clean.slice(0, 2), 16);
  if (isNaN(modeByte)) return clean;
  const respMode = ((modeByte + 0x40) & 0xff).toString(16).toUpperCase().padStart(2, '0');
  return respMode + clean.slice(2);
}

/**
 * Safe recursive-descent math expression evaluator for custom PID formulas.
 * Supports variables A, B, C, D and operators +, -, *, /, parentheses, and numeric literals.
 */
export function evaluateCustomExpression(
  expr: string,
  bytes: { A: number; B: number; C: number; D: number }
): number | null {
  const cleaned = expr.replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return null;

  let pos = 0;

  const parseExpr = (): number => {
    let val = parseTerm();
    while (pos < cleaned.length && (cleaned[pos] === '+' || cleaned[pos] === '-')) {
      const op = cleaned[pos++];
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  };

  const parseTerm = (): number => {
    let val = parseFactor();
    while (pos < cleaned.length && (cleaned[pos] === '*' || cleaned[pos] === '/')) {
      const op = cleaned[pos++];
      const rhs = parseFactor();
      if (op === '*') val = val * rhs;
      else val = rhs === 0 ? 0 : val / rhs;
    }
    return val;
  };

  const parseFactor = (): number => {
    if (cleaned[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (cleaned[pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (cleaned[pos] === '(') {
      pos++;
      const val = parseExpr();
      if (cleaned[pos] === ')') pos++;
      return val;
    }
    const ch = cleaned[pos];
    if (ch === 'A' || ch === 'B' || ch === 'C' || ch === 'D') {
      pos++;
      return bytes[ch];
    }
    const numMatch = cleaned.slice(pos).match(/^\d+(?:\.\d+)?/);
    if (numMatch) {
      pos += numMatch[0].length;
      return parseFloat(numMatch[0]);
    }
    throw new Error(`Unexpected token at ${pos}`);
  };

  try {
    const result = parseExpr();
    if (pos !== cleaned.length || isNaN(result) || !isFinite(result)) {
      return null;
    }
    return Number(result.toFixed(2));
  } catch {
    return null;
  }
}

class PidConfigService {
  private pids: PidConfigItem[] = [];
  private listeners: Array<(pids: PidConfigItem[]) => void> = [];

  constructor() {
    this.pids = this.loadFromStorage();
  }

  private loadFromStorage(): PidConfigItem[] {
    if (typeof window === 'undefined') return [...DEFAULT_PIDS];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [...DEFAULT_PIDS];
      const parsed = JSON.parse(raw) as PidConfigItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) return [...DEFAULT_PIDS];

      // Merge any newly added default PIDs that aren't in stored list yet (by id)
      const storedById = new Map(parsed.map((p) => [p.id, p]));
      const merged: PidConfigItem[] = [];
      for (const def of DEFAULT_PIDS) {
        const existing = storedById.get(def.id);
        if (existing) {
          // Ensure Core 8 PIDs default to fast polling so Oil Temp & Ethanol are never starved
          const forceFast =
            ['coolant', 'iat', 'oil_temp', 'ethanol'].includes(def.id) &&
            existing.pollRate === 'slow';
          merged.push({
            ...def,
            ...existing,
            pollRate: forceFast ? 'fast' : existing.pollRate || def.pollRate,
          });
          storedById.delete(def.id);
        } else {
          merged.push({ ...def });
        }
      }
      // Append any remaining custom PIDs
      for (const custom of storedById.values()) {
        merged.push(custom);
      }
      return merged;
    } catch {
      return [...DEFAULT_PIDS];
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pids));
    } catch {
      // ignore quota errors
    }
  }

  private notify(): void {
    const snapshot = this.getPids();
    this.listeners.forEach((l) => l(snapshot));
  }

  public subscribe(listener: (pids: PidConfigItem[]) => void): () => void {
    this.listeners.push(listener);
    listener(this.getPids());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public getPids(): PidConfigItem[] {
    return this.pids.map((p) => ({ ...p }));
  }

  public getEnabledPids(): PidConfigItem[] {
    return this.pids.filter((p) => p.enabled).map((p) => ({ ...p }));
  }

  public togglePid(id: string): void {
    this.pids = this.pids.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
    this.saveToStorage();
    this.notify();
  }

  public updatePid(id: string, updates: Partial<PidConfigItem>): void {
    this.pids = this.pids.map((p) => {
      if (p.id !== id) return p;
      const nextCommand = updates.command !== undefined ? normalizeCommand(updates.command) : p.command;
      const nextExpected = updates.command !== undefined ? computeExpectedHeader(nextCommand) : p.expectedHeader;
      return {
        ...p,
        ...updates,
        command: nextCommand || p.command,
        expectedHeader: nextExpected,
      };
    });
    this.saveToStorage();
    this.notify();
  }

  public addCustomPid(input: Omit<PidConfigItem, 'id' | 'expectedHeader' | 'isCustom'>): PidConfigItem {
    const cleanCmd = normalizeCommand(input.command);
    const newPid: PidConfigItem = {
      ...input,
      id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      command: cleanCmd,
      expectedHeader: computeExpectedHeader(cleanCmd),
      isCustom: true,
    };
    this.pids = [...this.pids, newPid];
    this.saveToStorage();
    this.notify();
    return newPid;
  }

  public deletePid(id: string): void {
    this.pids = this.pids.filter((p) => p.id !== id || !p.isCustom);
    this.saveToStorage();
    this.notify();
  }

  public setAllEnabled(enabled: boolean): void {
    this.pids = this.pids.map((p) => ({ ...p, enabled }));
    this.saveToStorage();
    this.notify();
  }

  public enableCoreEightOnly(): void {
    const coreIds = new Set(['rpm', 'speed', 'map', 'coolant', 'iat', 'oil_temp', 'ethanol', 'oil_pressure']);
    this.pids = this.pids.map((p) => ({ ...p, enabled: coreIds.has(p.id) }));
    this.saveToStorage();
    this.notify();
  }

  public resetDefaults(): void {
    this.pids = DEFAULT_PIDS.map((p) => ({ ...p }));
    this.saveToStorage();
    this.notify();
  }

  /**
   * Extract payload data bytes (A, B, C, D) after the expected response header in cleanHex
   * and evaluate the PID formula.
   */
  public parseResponse(pid: PidConfigItem, cleanHex: string): number | null {
    const expectedPrefix = computeExpectedHexPrefix(pid.command);
    if (!expectedPrefix) return null;

    const idx = cleanHex.indexOf(expectedPrefix);
    if (idx === -1) return null;

    const dataHex = cleanHex.slice(idx + expectedPrefix.length);
    if (dataHex.length < 2) return null;

    const A = parseInt(dataHex.slice(0, 2), 16);
    const B = dataHex.length >= 4 ? parseInt(dataHex.slice(2, 4), 16) : 0;
    const C = dataHex.length >= 6 ? parseInt(dataHex.slice(4, 6), 16) : 0;
    const D = dataHex.length >= 8 ? parseInt(dataHex.slice(6, 8), 16) : 0;

    if (isNaN(A)) return null;

    switch (pid.formula) {
      case 'rpm': {
        if (dataHex.length < 4 || isNaN(B)) return null;
        const rpm = Math.round(((A * 256) + B) / 4);
        return rpm >= 0 && rpm <= 12000 ? rpm : null;
      }
      case 'speed':
        return A >= 0 && A <= 350 ? A : null;
      case 'map_boost':
        return A >= 0 ? A : null; // returns kPa
      case 'temp_offset_40':
        return A - 40;
      case 'temp_offset_48':
        return A - 48;
      case 'percent_255':
        return Number(((A * 100) / 255).toFixed(1));
      case 'fuel_trim':
        return Number((((A - 128) * 100) / 128).toFixed(1));
      case 'timing_advance':
        return Number(((A / 2) - 64).toFixed(1));
      case 'maf_gps':
        if (dataHex.length < 4 || isNaN(B)) return null;
        return Number((((A * 256) + B) / 100).toFixed(2));
      case 'voltage_mv':
        if (dataHex.length < 4 || isNaN(B)) return null;
        return Number((((A * 256) + B) / 1000).toFixed(2));
      case 'oil_pressure_b58': {
        // Handle 2-byte Mode 22 (mbar / kPa) or 1-byte Mode 22 / Mode 01 5E
        if (pid.command.startsWith('01')) {
          // Mode 01 5E or similar: A * 2 kPa -> Bar
          return Number(((A * 2) / 100).toFixed(2));
        }
        if (dataHex.length >= 4 && !isNaN(B)) {
          const rawVal = (A * 256) + B;
          return rawVal > 100 ? Number((rawVal / 1000).toFixed(2)) : Number((rawVal / 10).toFixed(2));
        }
        return Number((A * 0.1).toFixed(2));
      }
      case 'fuel_rail_10kpa': {
        if (dataHex.length < 4 || isNaN(B)) return null;
        const kpa = ((A * 256) + B) * 10;
        return Number((kpa / 100).toFixed(1)); // Bar
      }
      case 'fuel_pressure_3kpa': {
        const kpa = A * 3;
        return Number((kpa / 100).toFixed(2)); // Bar
      }
      case 'lambda_ratio': {
        if (dataHex.length < 4 || isNaN(B)) return null;
        const lambda = ((A * 256) + B) / 32768;
        return Number(lambda.toFixed(3));
      }
      case 'cat_temp':
        if (dataHex.length < 4 || isNaN(B)) return null;
        return Number(((((A * 256) + B) / 10) - 40).toFixed(1));
      case 'abs_load':
        if (dataHex.length < 4 || isNaN(B)) return null;
        return Number((((A * 256) + B) * 100 / 255).toFixed(1));
      case 'run_time':
        if (dataHex.length < 4 || isNaN(B)) return null;
        return (A * 256) + B;
      case 'raw_byte':
        return A;
      case 'raw_2byte':
        if (dataHex.length < 4 || isNaN(B)) return null;
        return (A * 256) + B;
      case 'custom':
        if (pid.customExpression) {
          return evaluateCustomExpression(pid.customExpression, { A, B, C, D });
        }
        return A;
      default:
        return A;
    }
  }
}

export const pidConfigService = new PidConfigService();
