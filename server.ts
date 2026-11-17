import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Lazy initializer for Gemini API client
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: Date.now(),
  });
});

interface TelemetryPoint {
  timestamp: number;
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
  loopHz?: number;
  latencyMs?: number;
  isSimulated?: boolean;
}

// Endpoint: Analyze Drive Log
app.post('/api/analyze-log', async (req, res) => {
  try {
    const {
      session,
      samples = [],
      vehicleProfile = 'BMW B58 / OBD2 Turbocharged',
      userNotes = '',
      modelName = 'gemini-3.7-flash',
    } = req.body;

    if (!Array.isArray(samples) || samples.length === 0) {
      return res.status(400).json({
        error: 'No telemetry samples provided for analysis. Record or select a log with data points.',
      });
    }

    // 1. Calculate aggregated telemetry stats and detect WOT/boost pulls
    let peakRpm = 0;
    let peakBoost = 0;
    let maxMapKpa = 0;
    let maxOilTempC = -999;
    let minOilTempC = 999;
    let maxCoolantC = -999;
    let minCoolantC = 999;
    let maxIatC = -999;
    let minIatC = 999;
    let ethanolSum = 0;
    let minOilPress = 999;
    let maxOilPress = 0;
    let highRpmOilPressSum = 0;
    let highRpmOilPressCount = 0;
    let lowRpmOilPressSum = 0;
    let lowRpmOilPressCount = 0;

    // Detect high-load / boost pulls (RPM > 2500 & Boost > 3 PSI or MAP > 125 kPa)
    interface PullEvent {
      startIdx: number;
      durationSec: number;
      startRpm: number;
      peakRpm: number;
      peakBoost: number;
      startIat: number;
      peakIat: number;
      startOilPress: number;
      minOilPress: number;
      peakOilPress: number;
    }

    const pulls: PullEvent[] = [];
    let currentPull: any = null;

    samples.forEach((s: TelemetryPoint, idx: number) => {
      const rpm = Number(s.rpm) || 0;
      const boost = Number(s.boostPsi) || 0;
      const mapKpa = Number(s.mapKpa) || 0;
      const oilTemp = Number(s.b58OilTempC) || 0;
      const coolant = Number(s.coolantTempC) || 0;
      const iat = Number(s.iatC) || 0;
      const eth = Number(s.ethanolPct) || 0;
      const oilPress = Number(s.oilPressureBar) || 0;

      if (rpm > peakRpm) peakRpm = rpm;
      if (boost > peakBoost) peakBoost = boost;
      if (mapKpa > maxMapKpa) maxMapKpa = mapKpa;
      if (oilTemp > maxOilTempC) maxOilTempC = oilTemp;
      if (oilTemp < minOilTempC) minOilTempC = oilTemp;
      if (coolant > maxCoolantC) maxCoolantC = coolant;
      if (coolant < minCoolantC) minCoolantC = coolant;
      if (iat > maxIatC) maxIatC = iat;
      if (iat < minIatC) minIatC = iat;
      ethanolSum += eth;

      if (oilPress > 0) {
        if (oilPress < minOilPress) minOilPress = oilPress;
        if (oilPress > maxOilPress) maxOilPress = oilPress;
        if (rpm >= 4500) {
          highRpmOilPressSum += oilPress;
          highRpmOilPressCount++;
        } else if (rpm <= 1000) {
          lowRpmOilPressSum += oilPress;
          lowRpmOilPressCount++;
        }
      }

      // Pull detection logic
      const isUnderBoostLoad = rpm >= 2400 && (boost >= 3.0 || mapKpa >= 125);
      if (isUnderBoostLoad) {
        if (!currentPull) {
          currentPull = {
            startIdx: idx,
            startTime: s.timestamp,
            startRpm: rpm,
            peakRpm: rpm,
            peakBoost: boost,
            startIat: iat,
            peakIat: iat,
            startOilPress: oilPress,
            minOilPress: oilPress,
            peakOilPress: oilPress,
          };
        } else {
          if (rpm > currentPull.peakRpm) currentPull.peakRpm = rpm;
          if (boost > currentPull.peakBoost) currentPull.peakBoost = boost;
          if (iat > currentPull.peakIat) currentPull.peakIat = iat;
          if (oilPress > 0 && oilPress < currentPull.minOilPress) currentPull.minOilPress = oilPress;
          if (oilPress > currentPull.peakOilPress) currentPull.peakOilPress = oilPress;
        }
      } else {
        if (currentPull) {
          const durationSec = (s.timestamp - currentPull.startTime) / 1000;
          if (durationSec >= 1.0) {
            pulls.push({
              startIdx: currentPull.startIdx,
              durationSec: Math.round(durationSec * 10) / 10,
              startRpm: currentPull.startRpm,
              peakRpm: currentPull.peakRpm,
              peakBoost: Math.round(currentPull.peakBoost * 10) / 10,
              startIat: currentPull.startIat,
              peakIat: currentPull.peakIat,
              startOilPress: Math.round(currentPull.startOilPress * 100) / 100,
              minOilPress: Math.round(currentPull.minOilPress * 100) / 100,
              peakOilPress: Math.round(currentPull.peakOilPress * 100) / 100,
            });
          }
          currentPull = null;
        }
      }
    });

    const avgEthanol = samples.length > 0 ? Math.round((ethanolSum / samples.length) * 10) / 10 : 0;
    const avgHighRpmOilPress = highRpmOilPressCount > 0 ? Math.round((highRpmOilPressSum / highRpmOilPressCount) * 100) / 100 : 0;
    const avgLowRpmOilPress = lowRpmOilPressCount > 0 ? Math.round((lowRpmOilPressSum / lowRpmOilPressCount) * 100) / 100 : 0;

    const summaryStats = {
      totalSamples: samples.length,
      durationSec: session?.durationMs ? Math.round(session.durationMs / 1000) : 0,
      peakRpm,
      peakBoostPsi: Math.round(peakBoost * 10) / 10,
      maxMapKpa,
      maxOilTempC: maxOilTempC === -999 ? 0 : maxOilTempC,
      minOilTempC: minOilTempC === 999 ? 0 : minOilTempC,
      maxCoolantTempC: maxCoolantC === -999 ? 0 : maxCoolantC,
      maxIatC: maxIatC === -999 ? 0 : maxIatC,
      minIatC: minIatC === 999 ? 0 : minIatC,
      ethanolPct: avgEthanol,
      minOilPressBar: minOilPress === 999 ? 0 : Math.round(minOilPress * 100) / 100,
      maxOilPressBar: Math.round(maxOilPress * 100) / 100,
      avgHighRpmOilPress,
      avgLowRpmOilPress,
      pullCount: pulls.length,
      pulls: pulls.slice(0, 5), // Keep top 5 pulls for prompt
    };

    // Subsample up to 40 evenly spaced points for tabular context
    const step = Math.max(1, Math.floor(samples.length / 35));
    const representativeRows: string[] = [];
    representativeRows.push('TimeOffset_s,RPM,Speed_kmh,MAP_kPa,Boost_PSI,Coolant_C,IAT_C,OilTemp_C,Ethanol_Pct,OilPress_bar');

    const firstTime = samples[0]?.timestamp || 0;
    for (let i = 0; i < samples.length; i += step) {
      const p = samples[i];
      const timeOffset = ((p.timestamp - firstTime) / 1000).toFixed(1);
      representativeRows.push(
        `${timeOffset},${p.rpm},${p.speedKmh},${p.mapKpa},${Number(p.boostPsi).toFixed(1)},${p.coolantTempC},${p.iatC},${p.b58OilTempC},${p.ethanolPct},${Number(p.oilPressureBar).toFixed(2)}`
      );
    }

    // Construct the Performance Tuner prompt
    const prompt = `You are a master automotive calibrator, motorsport data engineer, and engine performance tuner specializing in turbocharged powertrain analysis (including modern direct-injection platforms such as the BMW B58 / B48 / S58 and standard OBD2 telemetry).

You are analyzing an OBD2 drive telemetry log.

### Session Metadata
- **Log Name / Profile**: ${session?.name || 'Drive Log Session'} (${vehicleProfile})
- **Sample Count**: ${summaryStats.totalSamples} points recorded over ${summaryStats.durationSec}s
- **Is Simulated**: ${session?.isSimulated ? 'Yes (Synthetic Testbench)' : 'No (Live Vehicle)'}
${userNotes ? `- **Driver Notes / Tuning Goals**: ${userNotes}` : ''}

### Computed Telemetry Summary
- **Peak Engine Speed**: ${summaryStats.peakRpm} RPM
- **Peak Boost Pressure**: ${summaryStats.peakBoostPsi} PSI (Max Manifold Absolute Pressure: ${summaryStats.maxMapKpa} kPa)
- **Engine Thermal State**:
  - BMW B58 Oil Temp: ${summaryStats.minOilTempC}°C min → ${summaryStats.maxOilTempC}°C peak
  - Coolant Temp (ECT): Max ${summaryStats.maxCoolantTempC}°C
  - Intake Air Temp (IAT): ${summaryStats.minIatC}°C min → ${summaryStats.maxIatC}°C peak (Delta: +${summaryStats.maxIatC - summaryStats.minIatC}°C)
- **Fuel Composition**: ${summaryStats.ethanolPct}% Ethanol (E-Blend)
- **Oil Pressure Dynamics**:
  - Idle / Low RPM: ~${summaryStats.avgLowRpmOilPress} Bar (~${(summaryStats.avgLowRpmOilPress * 14.5038).toFixed(1)} PSI)
  - High RPM Peak (>4500 RPM): ~${summaryStats.avgHighRpmOilPress} Bar (~${(summaryStats.avgHighRpmOilPress * 14.5038).toFixed(1)} PSI)
  - Min / Max Recorded: ${summaryStats.minOilPressBar} - ${summaryStats.maxOilPressBar} Bar
- **Detected Full-Throttle / Boost Pulls**: ${summaryStats.pullCount} pull(s) detected:
${
  summaryStats.pulls.length > 0
    ? summaryStats.pulls
        .map(
          (pl, idx) =>
            `  • Pull #${idx + 1}: Duration ${pl.durationSec}s, RPM ${pl.startRpm} → ${pl.peakRpm}, Peak Boost ${pl.peakBoost} PSI, IAT ${pl.startIat}°C → ${pl.peakIat}°C, Oil Press ${pl.minOilPress} → ${pl.peakOilPress} Bar`
        )
        .join('\n')
    : '  • No distinct sustained high-boost pulls detected; mixed cruising/idle logging.'
}

### Subsampled Telemetry Excerpt
\`\`\`csv
${representativeRows.join('\n')}
\`\`\`

---
### Your Task:
Provide an expert, highly structured and concise tuner analysis formatted in clean Markdown. Structure your response into the following clear sections:

1. 🏁 **Tuner Executive Summary & Overall Health Rating** (Assign a health score e.g., 94/100 or Grade A/B/C and 2-sentence summary)
2. 🌡️ **Thermal Management & Charge Air Assessment** (Analyze IAT rise during boost, intercooler heat-soak status, coolant/oil thermal delta, and whether charge cooling is adequate)
3. 🛢️ **Lubrication & Oil Pressure Stability** (Evaluate oil pressure vs RPM, pressure floor under hot oil, and mechanical safety margins)
4. ⚡ **Boost Control, MAP Spool & Power Delivery** (Analyze boost delivery, peak boost vs RPM taper, spool ramp rate, and manifold pressure stability)
5. 🌽 **Fuel Blend & Octane Headroom** (Evaluate Ethanol percentage rating, knock resistance potential, and flex-fuel DME readiness)
6. 🎯 **Specific Calibration & Hardware Tuning Recommendations** (Provide 3 to 5 concrete, actionable optimization recommendations, e.g., target boost taper at high RPM, ignition timing safety margins for current ethanol blend, cooling upgrade recommendations, or log parameters to monitor next).

Keep the analysis authoritative, technically rigorous, concise, and easy to read in a tuner console.`;

    const ai = getAiClient();
    let targetModel = 'gemini-3.7-flash';
    if (modelName === 'gemini-3.6-flash') {
      targetModel = 'gemini-3.6-flash';
    } else if (modelName === 'gemini-3.1-pro-preview' || modelName === 'gemini-3-pro') {
      targetModel = 'gemini-3.1-pro-preview';
    } else {
      targetModel = 'gemini-3.7-flash';
    }

    const response = await ai.models.generateContent({
      model: targetModel,
      contents: prompt,
    });

    const reportText = response.text || 'No analysis generated by model.';

    return res.json({
      success: true,
      model: targetModel,
      timestamp: Date.now(),
      summary: summaryStats,
      report: reportText,
    });
  } catch (err: any) {
    console.error('Error analyzing drive log with Gemini:', err);
    return res.status(500).json({
      error: err?.message || 'Failed to analyze telemetry log with Gemini API.',
    });
  }
});

// Start Express + Vite dev server or static server
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OBD2 Server running on http://localhost:${PORT}`);
  });
}

startServer();
