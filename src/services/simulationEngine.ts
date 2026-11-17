import { ObdTelemetry } from '../types';
import { obd2Service } from './obd2BleService';
import { pidConfigService } from './pidConfigService';

export class SimulationEngine {
  private timerId: any = null;
  private isRunning = false;
  private time = 0;

  // Simulated engine state
  private rpm = 800;
  private speedKmh = 0;
  private throttlePct = 0; // 0 to 1
  private gear = 1;
  private coolantTempC = 88;
  private iatC = 26;
  private b58OilTempC = 96;
  private ethanolPct = 28.5; // E30 blend
  private mapKpa = 101;
  private boostPsi = 0;

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.time = 0;

    this.timerId = setInterval(() => {
      this.tick();
    }, 80); // ~12.5 Hz update rate
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private tick(): void {
    this.time += 0.08;

    // Simulate throttle cycle: idle -> pull through gears -> coast -> repeat
    const cycle = (this.time % 18);

    if (cycle < 2) {
      // Idle at stoplight
      this.throttlePct = 0.06;
      this.gear = 1;
      this.rpm = 750 + Math.sin(this.time * 4) * 30;
      this.speedKmh = Math.max(0, this.speedKmh - 4);
    } else if (cycle < 8) {
      // Hard WOT acceleration pull
      this.throttlePct = 0.85 + Math.sin(this.time * 2) * 0.15;
      
      const accelPhase = cycle - 2;
      if (accelPhase < 2) {
        this.gear = 2;
        this.rpm = 2200 + accelPhase * 2100;
        this.speedKmh = 25 + accelPhase * 20;
      } else if (accelPhase < 4) {
        this.gear = 3;
        this.rpm = 3400 + (accelPhase - 2) * 1600;
        this.speedKmh = 65 + (accelPhase - 2) * 25;
      } else {
        this.gear = 4;
        this.rpm = 4200 + (accelPhase - 4) * 1100;
        this.speedKmh = 115 + (accelPhase - 4) * 15;
      }
    } else if (cycle < 13) {
      // Cruising
      this.throttlePct = 0.22;
      this.gear = 6;
      this.rpm = 1850 + Math.sin(this.time * 1.5) * 60;
      this.speedKmh = 95 + Math.sin(this.time * 0.8) * 3;
    } else {
      // Deceleration / Braking
      this.throttlePct = 0.04;
      this.gear = 3;
      this.rpm = Math.max(800, this.rpm - 150);
      this.speedKmh = Math.max(0, this.speedKmh - 6);
    }

    // Calculate Boost and MAP
    const baseMap = 98 + this.throttlePct * 135;
    const turboLag = Math.sin(this.time * 3) * 4;
    this.mapKpa = Math.round(Math.max(30, baseMap + turboLag));
    this.boostPsi = Number(Math.max(0, (this.mapKpa - 101.3) * 0.145038).toFixed(1));

    // Calculate Temperature curves
    this.coolantTempC = Number((91 + Math.sin(this.time * 0.05) * 3).toFixed(1));
    this.iatC = Number((24 + this.throttlePct * 9 + Math.sin(this.time * 0.1) * 2).toFixed(1));
    this.b58OilTempC = Number((98 + (this.throttlePct > 0.5 ? 4 : 0) + Math.sin(this.time * 0.04) * 2).toFixed(1));
    this.ethanolPct = Number((29.4 + Math.sin(this.time * 0.02) * 0.6).toFixed(1));

    const finalRpm = Math.round(Math.max(650, Math.min(6800, this.rpm)));
    const finalSpeed = Math.round(Math.max(0, this.speedKmh));
    const speedMph = Number((finalSpeed * 0.621371).toFixed(1));
    const coolantF = Math.round((this.coolantTempC * 1.8) + 32);
    const iatF = Math.round((this.iatC * 1.8) + 32);
    const oilF = Math.round((this.b58OilTempC * 1.8) + 32);

    // Dynamic Oil Pressure
    const baseOilBar = 1.8 + (finalRpm / 6500) * 3.4 + (this.throttlePct * 0.4);
    const oilPressureBar = Number(Math.max(1.5, Math.min(6.0, baseOilBar + Math.sin(this.time * 2) * 0.05)).toFixed(2));
    const oilPressurePsi = Number((oilPressureBar * 14.5038).toFixed(1));

    // Extended Standard + B58 Simulated Values
    const throttleDisplayPct = Number((this.throttlePct * 100).toFixed(1));
    const engineLoadPct = Number(Math.min(99, 18 + this.throttlePct * 78 + (finalRpm / 7000) * 12).toFixed(1));
    const absLoadPct = Number((engineLoadPct * (1 + this.boostPsi / 18)).toFixed(1));
    const mafGps = Number((8 + (finalRpm / 6500) * 290 * (0.3 + this.throttlePct * 0.7)).toFixed(1));
    const timingAdvanceDeg = Number((this.throttlePct > 0.7 ? 11.5 - (this.boostPsi * 0.25) : 22 + Math.sin(this.time) * 3).toFixed(1));
    const stftPct = Number((Math.sin(this.time * 1.3) * 2.4).toFixed(1));
    const ltftPct = Number((1.2 + Math.sin(this.time * 0.1) * 0.4).toFixed(1));
    const controlModuleVoltage = Number((14.15 + Math.sin(this.time * 0.7) * 0.08).toFixed(2));
    const fuelLevelPct = Number(Math.max(10, 68.5 - (this.time * 0.002)).toFixed(1));
    const ambientTempC = 21.5;
    const ambientTempF = Math.round(ambientTempC * 1.8 + 32);
    const baroKpa = 101;
    const baroPsi = Number((baroKpa * 0.145038).toFixed(1));
    const hpfpBar = Number((110 + (this.throttlePct * 180) + (finalRpm / 7000) * 50).toFixed(1));
    const hpfpPsi = Math.round(hpfpBar * 14.5038);
    const lambda = Number((this.throttlePct > 0.65 ? 0.82 + Math.sin(this.time * 2) * 0.02 : 1.00 + Math.sin(this.time * 3) * 0.015).toFixed(3));
    const afr = Number((lambda * 14.7).toFixed(2));
    const catTempC = Math.round(520 + (this.throttlePct * 310) + (finalRpm / 7000) * 60);
    const catTempF = Math.round(catTempC * 1.8 + 32);
    const pedalPosPct = Number(Math.min(100, throttleDisplayPct * 1.02).toFixed(1));
    const chargeAirTempC = Number((this.iatC + 6 + this.boostPsi * 0.5).toFixed(1));
    const chargeAirTempF = Math.round(chargeAirTempC * 1.8 + 32);
    const transTempC = Number((82 + Math.sin(this.time * 0.03) * 2.5).toFixed(1));
    const transTempF = Math.round(transTempC * 1.8 + 32);
    const runTimeSec = Math.floor(320 + this.time);

    const customValues: Record<string, number> = {
      rpm: finalRpm,
      speed: finalSpeed,
      map: this.mapKpa,
      coolant: this.coolantTempC,
      iat: this.iatC,
      oil_temp: this.b58OilTempC,
      ethanol: this.ethanolPct,
      oil_pressure: oilPressureBar,
      engine_load: engineLoadPct,
      throttle: throttleDisplayPct,
      maf: mafGps,
      timing_advance: timingAdvanceDeg,
      stft: stftPct,
      ltft: ltftPct,
      voltage: controlModuleVoltage,
      fuel_level: fuelLevelPct,
      ambient_temp: ambientTempC,
      baro_pressure: baroKpa,
      hpfp_pressure: hpfpBar,
      lambda_afr: lambda,
      cat_temp: catTempC,
      pedal_pos: pedalPosPct,
      abs_load: absLoadPct,
      charge_air_temp: chargeAirTempC,
      trans_temp: transTempC,
      run_time: runTimeSec,
    };

    // Populate reasonable simulated values for any user-added custom PIDs
    for (const pid of pidConfigService.getPids()) {
      if (pid.isCustom && customValues[pid.id] === undefined) {
        const span = Math.max(1, pid.max - pid.min);
        customValues[pid.id] = Number((pid.min + span * (0.35 + 0.25 * Math.sin(this.time * 1.2))).toFixed(1));
      }
    }

    const telemetry: ObdTelemetry = {
      rpm: finalRpm,
      speedKmh: finalSpeed,
      speedMph,
      mapKpa: this.mapKpa,
      mapPsi: Number((this.mapKpa * 0.145038).toFixed(1)),
      boostPsi: this.boostPsi,
      coolantTempC: this.coolantTempC,
      coolantTempF: coolantF,
      iatC: this.iatC,
      iatF,
      b58OilTempC: this.b58OilTempC,
      b58OilTempF: oilF,
      ethanolPct: this.ethanolPct,
      oilPressureBar,
      oilPressurePsi,
      engineLoadPct,
      throttlePct: throttleDisplayPct,
      mafGps,
      timingAdvanceDeg,
      stftPct,
      ltftPct,
      controlModuleVoltage,
      fuelLevelPct,
      ambientTempC,
      ambientTempF,
      baroKpa,
      baroPsi,
      hpfpBar,
      hpfpPsi,
      lambda,
      afr,
      catTempC,
      catTempF,
      pedalPosPct,
      absLoadPct,
      runTimeSec,
      chargeAirTempC,
      chargeAirTempF,
      transTempC,
      transTempF,
      customValues,
    };

    // Generate realistic raw hex packets
    const rpmVal = Math.round(finalRpm * 4);
    const rpmHexA = (Math.floor(rpmVal / 256) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const rpmHexB = (rpmVal % 256).toString(16).padStart(2, '0').toUpperCase();
    const speedHex = (finalSpeed & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const mapHex = (Math.min(255, this.mapKpa) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const coolantHex = ((Math.round(this.coolantTempC) + 40) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const iatHex = ((Math.round(this.iatC) + 40) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const b58OilHex = ((Math.round(this.b58OilTempC) + 48) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const ethanolHex = (Math.round((this.ethanolPct * 255) / 100) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const oilPressMbar = Math.round(oilPressureBar * 1000);
    const oilPressHexA = (Math.floor(oilPressMbar / 256) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const oilPressHexB = (oilPressMbar % 256).toString(16).padStart(2, '0').toUpperCase();
    const throttleHex = (Math.round((throttleDisplayPct * 255) / 100) & 0xff).toString(16).padStart(2, '0').toUpperCase();
    const loadHex = (Math.round((engineLoadPct * 255) / 100) & 0xff).toString(16).padStart(2, '0').toUpperCase();

    const rawResponses: Record<string, string> = {
      '010C': `41 0C ${rpmHexA} ${rpmHexB}`,
      '010D': `41 0D ${speedHex}`,
      '010B': `41 0B ${mapHex}`,
      '0105': `41 05 ${coolantHex}`,
      '010F': `41 0F ${iatHex}`,
      '0104': `41 04 ${loadHex}`,
      '0111': `41 11 ${throttleHex}`,
      '222020': `62 20 20 ${b58OilHex}`,
      '22202B': `62 20 2B ${ethanolHex}`,
      '222026': `62 20 26 ${oilPressHexA} ${oilPressHexB}`,
    };

    obd2Service.injectTelemetry(telemetry, rawResponses);
  }
}

export const simulationEngine = new SimulationEngine();
