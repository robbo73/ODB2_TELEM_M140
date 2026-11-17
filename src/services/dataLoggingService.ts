import { LogSession, TelemetryDataPoint, ObdStreamPayload } from '../types';

const DB_NAME = 'OBD2_Telemetry_Database';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_SAMPLES = 'samples';

class DataLoggingService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private activeSession: LogSession | null = null;
  private memorySamples: TelemetryDataPoint[] = [];
  private writeBuffer: { sessionId: string; sample: TelemetryDataPoint }[] = [];
  private flushTimer: any = null;
  private listeners: Array<(session: LogSession | null, currentCount: number) => void> = [];

  constructor() {
    this.initDb();
  }

  private initDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        console.warn('IndexedDB not supported, falling back to in-memory logging');
        return reject(new Error('IndexedDB is unavailable'));
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const sessionStore = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          sessionStore.createIndex('startTime', 'startTime', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SAMPLES)) {
          const sampleStore = db.createObjectStore(STORE_SAMPLES, { autoIncrement: true });
          sampleStore.createIndex('sessionId', 'sessionId', { unique: false });
          sampleStore.createIndex('timestamp', 'sample.timestamp', { unique: false });
        }
      };

      request.onsuccess = (event: any) => {
        resolve(event.target.result as IDBDatabase);
      };

      request.onerror = (event: any) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });

    return this.dbPromise;
  }

  public subscribe(listener: (session: LogSession | null, currentCount: number) => void): () => void {
    this.listeners.push(listener);
    listener(this.activeSession, this.memorySamples.length);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const count = this.memorySamples.length;
    this.listeners.forEach((l) => l(this.activeSession, count));
  }

  public isLogging(): boolean {
    return this.activeSession !== null;
  }

  public getActiveSession(): LogSession | null {
    return this.activeSession;
  }

  public getLiveSampleCount(): number {
    return this.memorySamples.length;
  }

  public async startLogging(sessionName?: string, vehicleProfile?: string): Promise<LogSession> {
    if (this.activeSession) {
      await this.stopLogging();
    }

    const now = Date.now();
    const sessionId = `log_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const dateFormatted = new Date(now).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const newSession: LogSession = {
      id: sessionId,
      name: sessionName || `OBD2 Session (${dateFormatted})`,
      startTime: now,
      durationMs: 0,
      sampleCount: 0,
      isSimulated: false,
      vehicleProfile: vehicleProfile || 'Standard OBD-II / BMW B58',
    };

    this.activeSession = newSession;
    this.memorySamples = [];
    this.writeBuffer = [];

    try {
      const db = await this.initDb();
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      tx.objectStore(STORE_SESSIONS).put(newSession);
    } catch (err) {
      console.warn('Failed to save session header to IndexedDB:', err);
    }

    // Start periodic buffer flush
    this.flushTimer = setInterval(() => this.flushBufferToDb(), 1000);
    this.notify();
    return newSession;
  }

  public recordPayload(payload: ObdStreamPayload): void {
    if (!this.activeSession) return;

    const dataPoint: TelemetryDataPoint = {
      timestamp: payload.timestamp,
      isoTimestamp: payload.isoTimestamp,
      rpm: payload.telemetry.rpm,
      speedKmh: payload.telemetry.speedKmh,
      speedMph: payload.telemetry.speedMph,
      mapKpa: payload.telemetry.mapKpa,
      mapPsi: payload.telemetry.mapPsi,
      boostPsi: payload.telemetry.boostPsi,
      coolantTempC: payload.telemetry.coolantTempC,
      coolantTempF: payload.telemetry.coolantTempF,
      iatC: payload.telemetry.iatC,
      iatF: payload.telemetry.iatF,
      b58OilTempC: payload.telemetry.b58OilTempC,
      b58OilTempF: payload.telemetry.b58OilTempF,
      ethanolPct: payload.telemetry.ethanolPct,
      oilPressureBar: payload.telemetry.oilPressureBar,
      oilPressurePsi: payload.telemetry.oilPressurePsi,
      loopHz: payload.metrics.loopHz,
      latencyMs: payload.metrics.latencyMs,
      isSimulated: payload.isSimulated,
    };

    if (payload.isSimulated) {
      this.activeSession.isSimulated = true;
    }

    this.memorySamples.push(dataPoint);
    this.writeBuffer.push({
      sessionId: this.activeSession.id,
      sample: dataPoint,
    });

    this.activeSession.sampleCount = this.memorySamples.length;
    this.activeSession.durationMs = dataPoint.timestamp - this.activeSession.startTime;

    this.notify();
  }

  private async flushBufferToDb(): Promise<void> {
    if (this.writeBuffer.length === 0) return;
    const itemsToFlush = [...this.writeBuffer];
    this.writeBuffer = [];

    try {
      const db = await this.initDb();
      const tx = db.transaction([STORE_SAMPLES, STORE_SESSIONS], 'readwrite');
      const sampleStore = tx.objectStore(STORE_SAMPLES);
      
      for (const item of itemsToFlush) {
        sampleStore.add(item);
      }

      if (this.activeSession) {
        const sessionStore = tx.objectStore(STORE_SESSIONS);
        sessionStore.put({
          ...this.activeSession,
          sampleCount: this.memorySamples.length,
          durationMs: Date.now() - this.activeSession.startTime,
        });
      }
    } catch (err) {
      console.warn('Error flushing data buffer to IndexedDB:', err);
    }
  }

  public async stopLogging(): Promise<LogSession | null> {
    if (!this.activeSession) return null;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flushBufferToDb();

    const finalizedSession: LogSession = {
      ...this.activeSession,
      endTime: Date.now(),
      durationMs: Date.now() - this.activeSession.startTime,
      sampleCount: this.memorySamples.length,
      records: [...this.memorySamples],
    };

    try {
      const db = await this.initDb();
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      tx.objectStore(STORE_SESSIONS).put({
        ...finalizedSession,
        records: undefined, // Keep memory footprint in store clean
      });
    } catch (err) {
      console.warn('Failed to update finalized session in IndexedDB:', err);
    }

    this.activeSession = null;
    this.notify();
    return finalizedSession;
  }

  public async getSession(sessionId: string): Promise<LogSession | null> {
    try {
      const db = await this.initDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SESSIONS, 'readonly');
        const store = tx.objectStore(STORE_SESSIONS);
        const request = store.get(sessionId);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          resolve(null);
        };
      });
    } catch {
      return null;
    }
  }

  public async getLatestSession(): Promise<LogSession | null> {
    const sessions = await this.getSessions();
    return sessions.length > 0 ? sessions[0] : null;
  }

  public async saveSessionAnalysis(sessionId: string, analysis: import('../types').AiLogAnalysis): Promise<void> {
    try {
      const db = await this.initDb();
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      const store = tx.objectStore(STORE_SESSIONS);
      const getReq = store.get(sessionId);

      getReq.onsuccess = () => {
        const session = getReq.result as LogSession;
        if (session) {
          session.aiAnalysis = analysis;
          store.put(session);
        }
      };
    } catch (err) {
      console.error('Error saving AI analysis to IndexedDB session:', err);
    }
  }

  public async getSessions(): Promise<LogSession[]> {
    try {
      const db = await this.initDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SESSIONS, 'readonly');
        const store = tx.objectStore(STORE_SESSIONS);
        const request = store.getAll();

        request.onsuccess = () => {
          const list: LogSession[] = request.result || [];
          list.sort((a, b) => b.startTime - a.startTime);
          resolve(list);
        };

        request.onerror = () => {
          resolve([]);
        };
      });
    } catch {
      return [];
    }
  }

  public async getSessionSamples(sessionId: string): Promise<TelemetryDataPoint[]> {
    // If currently active and matches
    if (this.activeSession && this.activeSession.id === sessionId) {
      return [...this.memorySamples];
    }

    try {
      const db = await this.initDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SAMPLES, 'readonly');
        const store = tx.objectStore(STORE_SAMPLES);
        const index = store.index('sessionId');
        const request = index.getAll(sessionId);

        request.onsuccess = () => {
          const results = request.result || [];
          const samples = results.map((r: any) => r.sample as TelemetryDataPoint);
          samples.sort((a, b) => a.timestamp - b.timestamp);
          resolve(samples);
        };

        request.onerror = () => {
          resolve([]);
        };
      });
    } catch {
      return [];
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    if (this.activeSession && this.activeSession.id === sessionId) {
      await this.stopLogging();
    }

    try {
      const db = await this.initDb();
      const tx = db.transaction([STORE_SESSIONS, STORE_SAMPLES], 'readwrite');
      
      // Delete session record
      tx.objectStore(STORE_SESSIONS).delete(sessionId);

      // Delete sample records
      const sampleStore = tx.objectStore(STORE_SAMPLES);
      const index = sampleStore.index('sessionId');
      const request = index.openKeyCursor(IDBKeyRange.only(sessionId));

      request.onsuccess = (e: any) => {
        const cursor = e.target.result;
        if (cursor) {
          sampleStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  }

  public async clearAllSessions(): Promise<void> {
    if (this.activeSession) {
      await this.stopLogging();
    }

    try {
      const db = await this.initDb();
      const tx = db.transaction([STORE_SESSIONS, STORE_SAMPLES], 'readwrite');
      tx.objectStore(STORE_SESSIONS).clear();
      tx.objectStore(STORE_SAMPLES).clear();
    } catch (err) {
      console.error('Error clearing all sessions:', err);
    }
  }

  /**
   * Generates formatted CSV string from data points
   */
  public generateCsvContent(samples: TelemetryDataPoint[], sessionName?: string): string {
    const headers = [
      'Timestamp_Epoch_ms',
      'ISO_Time',
      'Engine_RPM',
      'Vehicle_Speed_kmh',
      'Vehicle_Speed_mph',
      'MAP_kPa',
      'MAP_psi',
      'Boost_psi',
      'Coolant_Temp_C',
      'Coolant_Temp_F',
      'Intake_Air_Temp_C',
      'Intake_Air_Temp_F',
      'BMW_B58_Oil_Temp_C',
      'BMW_B58_Oil_Temp_F',
      'Ethanol_Content_Pct',
      'Oil_Pressure_bar',
      'Oil_Pressure_psi',
      'Relay_Loop_Hz',
      'Latency_ms',
      'Simulated',
    ];

    const rows = samples.map((s) => [
      s.timestamp,
      `"${s.isoTimestamp}"`,
      s.rpm,
      s.speedKmh,
      s.speedMph,
      s.mapKpa,
      s.mapPsi,
      s.boostPsi,
      s.coolantTempC,
      s.coolantTempF,
      s.iatC,
      s.iatF,
      s.b58OilTempC,
      s.b58OilTempF,
      s.ethanolPct,
      s.oilPressureBar ?? 0,
      s.oilPressurePsi ?? 0,
      s.loopHz,
      s.latencyMs,
      s.isSimulated ? 1 : 0,
    ]);

    const headerBlock = [
      `# OBD2 Telemetry Relay Data Log`,
      `# Session: ${sessionName || 'Telemetry Log'}`,
      `# Exported At: ${new Date().toISOString()}`,
      `# Total Samples: ${samples.length}`,
      headers.join(','),
    ];

    const dataBlock = rows.map((r) => r.join(','));
    return [...headerBlock, ...dataBlock].join('\n');
  }

  /**
   * Download CSV directly in browser
   */
  public async exportSessionAsCsv(sessionId: string): Promise<void> {
    const samples = await this.getSessionSamples(sessionId);
    if (samples.length === 0) {
      alert('No logged data samples in this session.');
      return;
    }

    const sessions = await this.getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    const sessionName = session?.name || 'obd2_log';

    const csvContent = this.generateCsvContent(samples, sessionName);
    const filename = `OBD2_Log_${sessionName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${sessionId}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download JSON directly in browser
   */
  public async exportSessionAsJson(sessionId: string): Promise<void> {
    const samples = await this.getSessionSamples(sessionId);
    const sessions = await this.getSessions();
    const session = sessions.find((s) => s.id === sessionId);

    const exportObj = {
      session: session || { id: sessionId },
      metadata: {
        exportedAt: new Date().toISOString(),
        totalSamples: samples.length,
        version: '2.4.0',
      },
      data: samples,
    };

    const jsonContent = JSON.stringify(exportObj, null, 2);
    const filename = `OBD2_Log_${sessionId}.json`;

    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Export active session currently in memory
   */
  public exportCurrentActiveAsCsv(): void {
    if (this.memorySamples.length === 0) {
      alert('No active logged data samples yet.');
      return;
    }

    const csvContent = this.generateCsvContent(
      this.memorySamples,
      this.activeSession?.name || 'Active Session'
    );
    const filename = `OBD2_Live_Log_${Date.now()}.csv`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const dataLoggingService = new DataLoggingService();
