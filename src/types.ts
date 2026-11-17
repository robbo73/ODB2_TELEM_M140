// Web Bluetooth API Types
declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: {
        acceptAllDevices?: boolean;
        filters?: Array<{
          name?: string;
          namePrefix?: string;
          services?: Array<string | number>;
        }>;
        optionalServices?: Array<string | number>;
      }): Promise<any>;
    };
  }
}

export type ConnectionState = 
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'initializing'
  | 'connected'
  | 'polling'
  | 'reconnecting'
  | 'error';

export interface ObdTelemetry {
  rpm: number;              // RPM (010C)
  speedKmh: number;         // km/h (010D)
  speedMph: number;         // mph
  mapKpa: number;           // kPa (010B)
  mapPsi: number;           // psi
  boostPsi: number;         // Boost psi (relative to ~101.3 kPa atm)
  coolantTempC: number;     // °C (0105)
  coolantTempF: number;     // °F
  iatC: number;             // Intake Air Temp °C (010F)
  iatF: number;             // Intake Air Temp °F
  b58OilTempC: number;      // BMW B58 Oil Temp °C (PID 222020 / 015C)
  b58OilTempF: number;      // BMW B58 Oil Temp °F
  ethanolPct: number;       // Ethanol % (PID 22202B / 0152)
  oilPressureBar: number;   // Engine Oil Pressure in Bar (PID 222026 / 015E)
  oilPressurePsi: number;   // Engine Oil Pressure in PSI
  // Extended Standard Mode 01 & BMW B58 Mode 22 PIDs
  engineLoadPct: number;    // Calculated Engine Load % (0104)
  throttlePct: number;      // Throttle Position % (0111)
  mafGps: number;           // Mass Air Flow g/s (0110)
  timingAdvanceDeg: number; // Ignition Timing Advance °BTDC (010E)
  stftPct: number;          // Short Term Fuel Trim Bank 1 % (0106)
  ltftPct: number;          // Long Term Fuel Trim Bank 1 % (0107)
  controlModuleVoltage: number; // Battery / ECU Voltage V (0142)
  fuelLevelPct: number;     // Fuel Tank Level % (012F)
  ambientTempC: number;     // Ambient Air Temp °C (0146)
  ambientTempF: number;     // Ambient Air Temp °F
  baroKpa: number;          // Barometric Pressure kPa (0133)
  baroPsi: number;          // Barometric Pressure PSI
  hpfpBar: number;          // Fuel Rail / HPFP Pressure Bar (0123 / 222022)
  hpfpPsi: number;          // Fuel Rail / HPFP Pressure PSI
  lambda: number;           // Equivalence Ratio Lambda (0144)
  afr: number;              // Air-Fuel Ratio (lambda * 14.7)
  catTempC: number;         // Catalyst Temp Bank 1 Sensor 1 °C (013C)
  catTempF: number;         // Catalyst Temp °F
  pedalPosPct: number;      // Accelerator Pedal Position D % (0149)
  absLoadPct: number;       // Absolute Engine Load % (0143)
  runTimeSec: number;       // Engine Run Time sec (011F)
  chargeAirTempC: number;   // Post-Intercooler Charge Air Temp °C (222030)
  chargeAirTempF: number;   // Post-Intercooler Charge Air Temp °F
  transTempC: number;       // Transmission Fluid Temp °C (222035)
  transTempF: number;       // Transmission Fluid Temp °F
  customValues: Record<string, number>; // Dynamic values keyed by PidConfigItem.id
}

export interface RawPidResponses {
  [pid: string]: {
    rawHex: string;
    parsedValue: number | string;
    timestamp: number;
  };
}

export interface ObdStreamPayload {
  channel: 'obd2_telemetry_stream';
  timestamp: number;
  isoTimestamp: string;
  status: ConnectionState;
  isSimulated: boolean;
  device: {
    name: string;
    id: string;
    connected: boolean;
    protocol: string;
    serviceUuid?: string;
  };
  telemetry: ObdTelemetry;
  rawResponses: Record<string, string>;
  metrics: {
    loopHz: number;
    latencyMs: number;
    pollCount: number;
    errorCount: number;
    disconnectionCount: number;
  };
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'tx' | 'rx' | 'info' | 'error' | 'broadcast' | 'status';
  text: string;
}

export type PidFormulaId =
  | 'rpm'
  | 'speed'
  | 'map_boost'
  | 'temp_offset_40'
  | 'temp_offset_48'
  | 'percent_255'
  | 'fuel_trim'
  | 'timing_advance'
  | 'maf_gps'
  | 'voltage_mv'
  | 'oil_pressure_b58'
  | 'fuel_rail_10kpa'
  | 'fuel_pressure_3kpa'
  | 'lambda_ratio'
  | 'cat_temp'
  | 'abs_load'
  | 'run_time'
  | 'raw_byte'
  | 'raw_2byte'
  | 'custom';

export interface PidConfigItem {
  id: string;
  name: string;
  command: string;
  enabled: boolean;
  category: 'standard' | 'b58';
  description: string;
  unit: string;
  imperialUnit?: string;
  expectedHeader: string;
  formula: PidFormulaId;
  customExpression?: string;
  min: number;
  max: number;
  imperialMin?: number;
  imperialMax?: number;
  warningThreshold?: number;
  dangerThreshold?: number;
  imperialWarningThreshold?: number;
  imperialDangerThreshold?: number;
  accentColor?: 'cyan' | 'amber' | 'emerald' | 'rose' | 'purple' | 'blue';
  pollRate?: 'fast' | 'slow';
  isCustom?: boolean;
}

// Data Logging Types
export interface TelemetryDataPoint {
  timestamp: number;
  isoTimestamp: string;
  rpm: number;
  speedKmh: number;
  speedMph: number;
  mapKpa: number;
  mapPsi: number;
  boostPsi: number;
  coolantTempC: number;
  coolantTempF: number;
  iatC: number;
  iatF: number;
  b58OilTempC: number;
  b58OilTempF: number;
  ethanolPct: number;
  oilPressureBar: number;
  oilPressurePsi: number;
  loopHz: number;
  latencyMs: number;
  isSimulated: boolean;
}

export interface AiLogAnalysisSummary {
  totalSamples: number;
  durationSec: number;
  peakRpm: number;
  peakBoostPsi: number;
  maxMapKpa: number;
  maxOilTempC: number;
  minOilTempC: number;
  maxCoolantTempC: number;
  maxIatC: number;
  minIatC: number;
  ethanolPct: number;
  minOilPressBar: number;
  maxOilPressBar: number;
  avgHighRpmOilPress: number;
  avgLowRpmOilPress: number;
  pullCount: number;
  pulls?: Array<{
    durationSec: number;
    startRpm: number;
    peakRpm: number;
    peakBoost: number;
    startIat: number;
    peakIat: number;
    startOilPress: number;
    minOilPress: number;
    peakOilPress: number;
  }>;
}

export interface AiLogAnalysis {
  timestamp: number;
  model: string;
  report: string;
  summary?: AiLogAnalysisSummary;
}

export interface LogSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  durationMs: number;
  sampleCount: number;
  isSimulated: boolean;
  vehicleProfile?: string;
  records?: TelemetryDataPoint[];
  aiAnalysis?: AiLogAnalysis;
}

// Diagnostic Trouble Code (DTC) Types
export type DtcSystem = 'Powertrain' | 'Chassis' | 'Body' | 'Network' | 'BMW Special';
export type DtcSeverity = 'critical' | 'warning' | 'info';

export interface DtcCode {
  code: string;               // e.g. P0300, P0420, 120408
  hexRaw: string;             // Raw hex bytes e.g. 03 00
  type: 'generic' | 'b58_bmw' | 'pending' | 'permanent';
  mode: 'Mode 03 (Stored)' | 'Mode 07 (Pending)' | 'Mode 0A (Permanent)' | 'Mode 22';
  system: DtcSystem;
  description: string;
  explanation: string;
  possibleCauses: string[];
  severity: DtcSeverity;
}

export interface DtcScanResult {
  timestamp: number;
  isoTimestamp: string;
  milActive: boolean;
  dtcCount: number;
  codes: DtcCode[];
  rawMode0101?: string;
  rawMode03?: string;
  rawMode07?: string;
  rawMode0A?: string;
  isSimulated: boolean;
  statusMessage: string;
}
