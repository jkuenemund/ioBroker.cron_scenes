# Implementation Plan: State-Getriggerte Jobs

**Branch**: `feature/state-triggered-jobs` | **Date**: 2025-11-08 | **Spec**: `.specify/memory/state-triggered-jobs.md`
**Input**: Feature specification from `.specify/memory/state-triggered-jobs.md`

## Summary

Erweitere den ioBroker.cron_scenes Adapter um state-getriggerte Jobs, die automatisch ausgeführt werden, wenn sich ein bestimmter State ändert. Dies ermöglicht reaktive Automatisierungen ohne Cron-Expressions. Die Implementierung erfolgt durch Erweiterung der bestehenden CronJobManager-Klasse mit Subscription-Management, Trigger-Logik und Debouncing-Mechanismus.

**Technischer Ansatz**:

- Erweiterung der bestehenden Architektur ohne Breaking Changes
- Selektives State-Subscribing für Performance
- Map-basierte Datenstrukturen für effiziente Lookups
- Integration in bestehenden onStateChange Handler

## Technical Context

**Language/Version**: TypeScript 5.0.4, Node.js >= 20  
**Primary Dependencies**: @iobroker/adapter-core ^3.3.2, node-cron ^4.2.1, cron-parser ^5.4.0  
**Storage**: ioBroker States (JSON-Strings in State-Values)  
**Testing**: Mocha + Chai, @iobroker/testing ^5.1.0  
**Target Platform**: ioBroker Adapter (Node.js)  
**Project Type**: Single project (ioBroker Adapter)  
**Performance Goals**: < 5% CPU bei 50+ STATE-Jobs, O(1) Lookups für Trigger-States  
**Constraints**: Rückwärtskompatibilität, keine Breaking Changes, Memory-Management (Cleanup von Timers/Subscriptions)  
**Scale/Scope**: Unterstützung für 50+ gleichzeitige STATE-Jobs ohne Performance-Degradation

## Constitution Check

✅ **Code-Qualität**: TypeScript strict mode, ESLint + Prettier, JSDoc Kommentare  
✅ **Architektur**: Event-driven mit onStateChange, Separation of Concerns (CronJobManager), Interface-basierte Abstraktion  
✅ **Performance**: Selektives Subscribing, Map-basierte Lookups, Debouncing, Early Returns  
✅ **Rückwärtskompatibilität**: Optionale Felder, keine Breaking Changes, bestehende Jobs funktionieren unverändert  
✅ **Fehlerbehandlung**: Try-catch Blocks, Custom Error Types, strukturiertes Logging  
✅ **Testing**: Unit-Tests für Kernfunktionen, Integration-Tests, Mocking von AdapterInterface  
✅ **Dependencies**: Nutzung bestehender Dependencies, keine neuen erforderlich

**GATE**: ✅ PASSED - Alle Constitution-Anforderungen erfüllt

## Project Structure

### Documentation (this feature)

```text
.specify/memory/
├── constitution.md              # Projektprinzipien
├── state-triggered-jobs.md      # Feature-Spezifikation
└── state-triggered-jobs-plan.md # Dieser Plan
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── constants.ts              # Erweitern: CRON_JOB_TYPE.STATE hinzufügen
│   ├── interfaces.ts             # Erweitern: CronJobConfig um triggerState, triggerValue, debounce
│   ├── ConfigValidator.ts        # Erweitern: Validierung für STATE-Jobs
│   ├── CronJobManager.ts         # Erweitern: Subscription-Management, Trigger-Logik, Debouncing
│   ├── errors.ts                 # Unverändert
│   └── examples.ts               # Unverändert
├── main.ts                       # Erweitern: onStateChange Handler für STATE-Jobs
└── main.test.ts                  # Erweitern: Tests für STATE-Jobs

test/
├── integration.js                # Unverändert
└── package.js                    # Unverändert
```

**Structure Decision**: Bestehende Struktur wird erweitert, keine neuen Dateien erforderlich. Alle Änderungen erfolgen in bestehenden Dateien zur Minimierung der Komplexität.

## Implementation Phases

### Phase 0: Foundation (Konstanten & Interfaces)

**Ziel**: Grundlagen für STATE-Jobs schaffen

**Aufgaben**:

1. **constants.ts**: `CRON_JOB_TYPE.STATE = "state"` hinzufügen
2. **interfaces.ts**: `CronJobConfig` erweitern um:
    - `triggerState?: string` (Pflicht für STATE-Jobs)
    - `triggerValue?: any` (Optional)
    - `triggerOnChange?: boolean` (Optional, Standard: true)
    - `debounce?: number` (Optional, Standard: 100ms)

**Abhängigkeiten**: Keine  
**Tests**: Type-Checking durch TypeScript  
**Dauer**: ~15 Minuten

### Phase 1: Validation (ConfigValidator)

**Ziel**: Validierung für STATE-Jobs implementieren

**Aufgaben**:

1. **ConfigValidator.ts**: `validateCronJobConfig()` erweitern:
    - Prüfung: `type === "state"` erfordert `triggerState` (Pflichtfeld)
    - Validierung: `triggerState` muss String sein
    - Validierung: `cron` ist optional für STATE-Jobs (wie bei MANUAL)
    - Validierung: `debounce` muss number zwischen 0 und 60000ms sein
    - Validierung: `triggerValue` kann beliebiger Typ sein (any)
    - Validierung: `triggerOnChange` muss boolean sein wenn gesetzt

**Abhängigkeiten**: Phase 0  
**Tests**: Unit-Tests für Validierung  
**Dauer**: ~30 Minuten

### Phase 2: Subscription Management (CronJobManager - Teil 1)

**Ziel**: State-Subscription-Management implementieren

**Aufgaben**:

1. **CronJobManager.ts**: Neue Properties hinzufügen:

    ```typescript
    private triggerStateSubscriptions = new Map<string, string[]>(); // triggerState -> [jobIds]
    private debounceTimers = new Map<string, NodeJS.Timeout>(); // jobId -> timer
    ```

2. Neue Methoden implementieren:
    - `subscribeToTriggerState(triggerState: string, jobId: string): void`
        - Prüft ob triggerState bereits abonniert ist
        - Fügt jobId zur triggerStateSubscriptions Map hinzu
        - Ruft `adapter.subscribeStates(triggerState)` auf (nur wenn noch nicht abonniert)
    - `unsubscribeFromTriggerState(triggerState: string, jobId: string): void`
        - Entfernt jobId aus triggerStateSubscriptions
        - Prüft ob noch andere Jobs diesen State verwenden
        - Ruft `adapter.unsubscribeStates(triggerState)` auf wenn keine Jobs mehr vorhanden
    - `getJobsForTriggerState(triggerState: string): string[] | undefined`
        - Gibt alle Job-IDs zurück, die von diesem State getriggert werden
        - Für schnelle Lookups in onStateChange Handler

**Abhängigkeiten**: Phase 1  
**Tests**: Unit-Tests für Subscription-Management  
**Dauer**: ~45 Minuten

### Phase 3: Trigger Logic (CronJobManager - Teil 2)

**Ziel**: Trigger-Logik und Debouncing implementieren

**Aufgaben**:

1. **CronJobManager.ts**: Neue Methoden implementieren:
    - `shouldTrigger(config: CronJobConfig, state: ioBroker.State): boolean`
        - Prüft ob State-Änderung den Job auslösen soll
        - Wenn `triggerValue` gesetzt: `state.val === config.triggerValue`
        - Wenn `triggerValue` nicht gesetzt: Immer true (jede Änderung)
        - Berücksichtigt `triggerOnChange` (Standard: true)
    - `checkAndTriggerStateJob(jobId: string, state: ioBroker.State): void`
        - Prüft ob Job ausgelöst werden soll via `shouldTrigger()`
        - Wendet Debouncing an:
            - Prüft ob bereits Timer für jobId existiert
            - Wenn ja: Timer löschen
            - Neuen Timer erstellen mit `config.debounce || 100`
            - Nach Timer-Ablauf: `executeJob(jobId)` aufrufen
        - Speichert Timer in debounceTimers Map

2. Geänderte Methoden:
    - `addOrUpdateJob()`:
        - Erkennt STATE-Jobs (`config.type === CRON_JOB_TYPE.STATE`)
        - Ruft `subscribeToTriggerState()` auf wenn triggerState vorhanden
        - Erstellt keinen Cron-Task für STATE-Jobs
    - `removeJob()`:
        - Ruft `unsubscribeFromTriggerState()` auf wenn STATE-Job
        - Bereinigt debounceTimers für diesen Job
    - `shutdown()`:
        - Bereinigt alle debounceTimers (clearTimeout für jeden Timer)
        - Entfernt alle State-Subscriptions (unsubscribeFromTriggerState für alle)

**Abhängigkeiten**: Phase 2  
**Tests**: Unit-Tests für Trigger-Logik und Debouncing  
**Dauer**: ~60 Minuten

### Phase 4: Integration (main.ts)

**Ziel**: Integration in bestehenden onStateChange Handler

**Aufgaben**:

1. **main.ts**: `onStateChange()` Handler erweitern:
    - Nach bestehender Logik für trigger und job config changes
    - Prüfen ob State einen STATE-Job triggert:
        ```typescript
        const jobs = this.cronJobManager.getJobsForTriggerState(id);
        if (jobs && jobs.length > 0) {
        	for (const jobId of jobs) {
        		this.cronJobManager.checkAndTriggerStateJob(jobId, state);
        	}
        }
        ```
    - Early return wenn keine STATE-Jobs gefunden

**Abhängigkeiten**: Phase 3  
**Tests**: Integration-Tests mit echten State-Änderungen  
**Dauer**: ~20 Minuten

### Phase 5: Testing

**Ziel**: Umfassende Tests für STATE-Jobs

**Aufgaben**:

1. **Unit-Tests** (CronJobManager.test.ts oder ähnlich):
    - Subscription-Management: subscribe/unsubscribe
    - Trigger-Logik: triggerValue, triggerOnChange
    - Debouncing: Timer-Verhalten, Cleanup
    - Error-Handling: Ungültige triggerState-IDs
2. **Integration-Tests**:
    - STATE-Job erstellen und State-Änderung simulieren
    - Parallele Ausführung mit RECURRING/MANUAL Jobs
    - Performance-Test mit vielen STATE-Jobs

**Abhängigkeiten**: Phase 4  
**Tests**: Alle Tests müssen grün sein  
**Dauer**: ~90 Minuten

### Phase 6: Documentation

**Ziel**: Dokumentation aktualisieren

**Aufgaben**:

1. **README.md**:
    - Neuer Abschnitt für STATE-Job-Typ
    - Beispiel-Konfigurationen dokumentieren
    - Performance-Hinweise für viele State-Jobs
2. **Changelog**: Eintrag für neue Feature

**Abhängigkeiten**: Phase 5  
**Tests**: Dokumentation Review  
**Dauer**: ~30 Minuten

## Code Structure Details

### CronJobManager.ts Erweiterungen

```typescript
export class CronJobManager {
	// Bestehende Properties
	private jobs = new Map<string, RegisteredCronJob>();
	private cleanupInterval: NodeJS.Timeout | null = null;

	// NEUE Properties
	private triggerStateSubscriptions = new Map<string, string[]>(); // triggerState -> [jobIds]
	private debounceTimers = new Map<string, NodeJS.Timeout>(); // jobId -> timer

	// NEUE Methoden
	private subscribeToTriggerState(triggerState: string, jobId: string): void;
	private unsubscribeFromTriggerState(triggerState: string, jobId: string): void;
	public getJobsForTriggerState(triggerState: string): string[] | undefined;
	private checkAndTriggerStateJob(jobId: string, state: ioBroker.State): void;
	private shouldTrigger(config: CronJobConfig, state: ioBroker.State): boolean;

	// GEÄNDERTE Methoden
	public async addOrUpdateJob(jobId: string, config: any): Promise<void>;
	public async removeJob(jobId: string): Promise<void>;
	public async shutdown(): Promise<void>;
}
```

### main.ts Erweiterungen

```typescript
private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
  // ... bestehende Logik ...

  // NEU: State-getriggerte Jobs prüfen
  const jobs = this.cronJobManager.getJobsForTriggerState(id);
  if (jobs && jobs.length > 0) {
    for (const jobId of jobs) {
      this.cronJobManager.checkAndTriggerStateJob(jobId, state);
    }
  }
}
```

## Dependencies & Integration Points

### Abhängigkeiten zwischen Phasen

```
Phase 0 (Foundation)
    ↓
Phase 1 (Validation) ──→ Phase 2 (Subscription)
    ↓                        ↓
Phase 3 (Trigger Logic) ←───┘
    ↓
Phase 4 (Integration)
    ↓
Phase 5 (Testing)
    ↓
Phase 6 (Documentation)
```

### Integration Points

1. **CronJobManager ↔ AdapterInterface**:
    - `adapter.subscribeStates()` für State-Subscriptions
    - `adapter.unsubscribeStates()` für Cleanup
    - `adapter.log` für Logging

2. **CronJobManager ↔ main.ts**:
    - `getJobsForTriggerState()` für Lookups in onStateChange
    - `checkAndTriggerStateJob()` für Trigger-Logik

3. **ConfigValidator ↔ CronJobConfig**:
    - Validierung der neuen Felder (triggerState, triggerValue, debounce)

## Risk Mitigation

### Risiken

1. **Performance bei vielen STATE-Jobs**:
    - Mitigation: Selektives Subscribing, Map-basierte Lookups, Debouncing
    - Monitoring: Performance-Tests mit 50+ Jobs

2. **Memory-Leaks durch Timer**:
    - Mitigation: Automatisches Cleanup in removeJob() und shutdown()
    - Monitoring: Unit-Tests für Cleanup-Verhalten

3. **Race Conditions bei schnellen State-Änderungen**:
    - Mitigation: Debouncing verhindert mehrfaches Auslösen
    - Monitoring: Integration-Tests mit schnellen Änderungen

4. **Rückwärtskompatibilität**:
    - Mitigation: Optionale Felder, keine Breaking Changes
    - Monitoring: Bestehende Tests müssen weiterhin grün sein

## Success Criteria

- ✅ STATE-Jobs können erstellt werden ohne Cron-Expression
- ✅ STATE-Jobs werden bei State-Änderungen automatisch ausgeführt
- ✅ System unterstützt 50+ STATE-Jobs ohne Performance-Degradation (< 5% CPU)
- ✅ Debouncing verhindert mehrfaches Auslösen bei schnellen Änderungen
- ✅ Bestehende RECURRING/MANUAL Jobs funktionieren unverändert
- ✅ Subscriptions werden korrekt verwaltet (keine Memory-Leaks)
- ✅ Alle Tests bestehen (Unit + Integration)
- ✅ Dokumentation ist vollständig

## Estimated Timeline

- **Phase 0**: 15 Minuten
- **Phase 1**: 30 Minuten
- **Phase 2**: 45 Minuten
- **Phase 3**: 60 Minuten
- **Phase 4**: 20 Minuten
- **Phase 5**: 90 Minuten
- **Phase 6**: 30 Minuten

**Gesamt**: ~4 Stunden (ohne Pausen und Review)

## Next Steps

1. ✅ Plan erstellt
2. ⏭️ Tasks generieren: `/speckit.tasks`
3. ⏳ Implementierung starten: `/speckit.implement`
