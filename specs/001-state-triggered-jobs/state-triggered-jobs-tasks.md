# Tasks: State-Getriggerte Jobs

**Input**: Design documents from `.specify/memory/state-triggered-jobs-plan.md`  
**Prerequisites**: plan.md ✅, spec.md ✅

**Tests**: Tests sind erforderlich gemäß Spezifikation (Phase 5)

**Organization**: Tasks sind nach Implementierungsphasen organisiert, die den User Stories entsprechen.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Kann parallel ausgeführt werden (verschiedene Dateien, keine Abhängigkeiten)
- **[Story]**: Welcher User Story diese Task gehört (US1, US2, US3, US4, US5, US6)
- Exakte Dateipfade in Beschreibungen enthalten

## Path Conventions

- **Single project**: `src/`, `test/` am Repository-Root
- Alle Pfade relativ zum Repository-Root

---

## Phase 0: Foundation (Konstanten & Interfaces)

**Purpose**: Grundlagen für STATE-Jobs schaffen - BLOCKIERT alle weiteren Phasen

**⚠️ CRITICAL**: Diese Phase muss abgeschlossen sein, bevor andere Phasen beginnen können

- [ ] T001 [P] [US1] Erweitere `CRON_JOB_TYPE` um `STATE: "state"` in `src/lib/constants.ts`
- [ ] T002 [P] [US1] Erweitere `CronJobConfig` Interface um `triggerState?: string` in `src/lib/interfaces.ts`
- [ ] T003 [P] [US1] Erweitere `CronJobConfig` Interface um `triggerValue?: any` in `src/lib/interfaces.ts`
- [ ] T004 [P] [US1] Erweitere `CronJobConfig` Interface um `triggerOnChange?: boolean` in `src/lib/interfaces.ts`
- [ ] T005 [P] [US1] Erweitere `CronJobConfig` Interface um `debounce?: number` in `src/lib/interfaces.ts`

**Checkpoint**: Foundation ready - TypeScript Type-Checking sollte erfolgreich sein

---

## Phase 1: Validation (ConfigValidator)

**Purpose**: Validierung für STATE-Jobs implementieren

**Abhängigkeiten**: Phase 0 muss abgeschlossen sein

- [ ] T006 [US1] Erweitere `validateCronJobConfig()` um Prüfung: `type === "state"` erfordert `triggerState` (Pflichtfeld) in `src/lib/ConfigValidator.ts`
- [ ] T007 [US1] Erweitere `validateCronJobConfig()` um Validierung: `triggerState` muss String sein in `src/lib/ConfigValidator.ts`
- [ ] T008 [US1] Erweitere `validateCronJobConfig()` um Validierung: `cron` ist optional für STATE-Jobs (wie bei MANUAL) in `src/lib/ConfigValidator.ts`
- [ ] T009 [US3] Erweitere `validateCronJobConfig()` um Validierung: `debounce` muss number zwischen 0 und 60000ms sein in `src/lib/ConfigValidator.ts`
- [ ] T010 [US2] Erweitere `validateCronJobConfig()` um Validierung: `triggerValue` kann beliebiger Typ sein (any) in `src/lib/ConfigValidator.ts`
- [ ] T011 [US1] Erweitere `validateCronJobConfig()` um Validierung: `triggerOnChange` muss boolean sein wenn gesetzt in `src/lib/ConfigValidator.ts`

**Checkpoint**: ConfigValidator validiert STATE-Jobs korrekt

---

## Phase 2: Subscription Management (CronJobManager - Teil 1)

**Purpose**: State-Subscription-Management implementieren

**Abhängigkeiten**: Phase 1 muss abgeschlossen sein

### Tests für Subscription Management (OPTIONAL - aber empfohlen)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T012 [P] [US1] Unit-Test für `subscribeToTriggerState()` in `src/lib/CronJobManager.test.ts` (oder neue Test-Datei)
- [ ] T013 [P] [US1] Unit-Test für `unsubscribeFromTriggerState()` in `src/lib/CronJobManager.test.ts`
- [ ] T014 [P] [US1] Unit-Test für `getJobsForTriggerState()` in `src/lib/CronJobManager.test.ts`

### Implementation für Subscription Management

- [ ] T015 [US1] Füge Property `triggerStateSubscriptions` (Map<string, string[]>) zu CronJobManager Klasse hinzu in `src/lib/CronJobManager.ts`
- [ ] T016 [US3] Füge Property `debounceTimers` (Map<string, NodeJS.Timeout>) zu CronJobManager Klasse hinzu in `src/lib/CronJobManager.ts`
- [ ] T017 [US1] Implementiere `subscribeToTriggerState(triggerState: string, jobId: string): void` in `src/lib/CronJobManager.ts`
- [ ] T018 [US1] Implementiere `unsubscribeFromTriggerState(triggerState: string, jobId: string): void` in `src/lib/CronJobManager.ts`
- [ ] T019 [US1] Implementiere `getJobsForTriggerState(triggerState: string): string[] | undefined` in `src/lib/CronJobManager.ts`

**Checkpoint**: Subscription-Management funktioniert, Tests bestehen

---

## Phase 3: Trigger Logic & Debouncing (CronJobManager - Teil 2)

**Purpose**: Trigger-Logik und Debouncing implementieren

**Abhängigkeiten**: Phase 2 muss abgeschlossen sein

### Tests für Trigger Logic (OPTIONAL - aber empfohlen)

- [ ] T020 [P] [US2] Unit-Test für `shouldTrigger()` mit `triggerValue` in `src/lib/CronJobManager.test.ts`
- [ ] T021 [P] [US2] Unit-Test für `shouldTrigger()` ohne `triggerValue` in `src/lib/CronJobManager.test.ts`
- [ ] T022 [P] [US3] Unit-Test für Debouncing-Mechanismus in `src/lib/CronJobManager.test.ts`
- [ ] T023 [P] [US3] Unit-Test für Debounce-Timer Cleanup in `src/lib/CronJobManager.test.ts`

### Implementation für Trigger Logic

- [ ] T024 [US2] Implementiere `shouldTrigger(config: CronJobConfig, state: ioBroker.State): boolean` in `src/lib/CronJobManager.ts`
- [ ] T025 [US3] Implementiere `checkAndTriggerStateJob(jobId: string, state: ioBroker.State): void` mit Debouncing in `src/lib/CronJobManager.ts`
- [ ] T026 [US1] Erweitere `addOrUpdateJob()` um Erkennung von STATE-Jobs und Aufruf von `subscribeToTriggerState()` in `src/lib/CronJobManager.ts`
- [ ] T027 [US1] Erweitere `addOrUpdateJob()` um Verhinderung der Cron-Task-Erstellung für STATE-Jobs in `src/lib/CronJobManager.ts`
- [ ] T028 [US1] Erweitere `removeJob()` um Aufruf von `unsubscribeFromTriggerState()` für STATE-Jobs in `src/lib/CronJobManager.ts`
- [ ] T029 [US3] Erweitere `removeJob()` um Bereinigung von debounceTimers für gelöschten Job in `src/lib/CronJobManager.ts`
- [ ] T030 [US3] Erweitere `shutdown()` um Bereinigung aller debounceTimers in `src/lib/CronJobManager.ts`
- [ ] T031 [US1] Erweitere `shutdown()` um Entfernen aller State-Subscriptions in `src/lib/CronJobManager.ts`

**Checkpoint**: Trigger-Logik und Debouncing funktionieren, Tests bestehen

---

## Phase 4: Integration (main.ts)

**Purpose**: Integration in bestehenden onStateChange Handler

**Abhängigkeiten**: Phase 3 muss abgeschlossen sein

### Tests für Integration (OPTIONAL - aber empfohlen)

- [ ] T032 [P] [US1] Integration-Test für STATE-Job Auslösung bei State-Änderung in `src/main.test.ts`
- [ ] T033 [P] [US4] Integration-Test für parallele Ausführung von STATE- und RECURRING-Jobs in `src/main.test.ts`

### Implementation für Integration

- [ ] T034 [US1] Erweitere `onStateChange()` Handler um Prüfung auf STATE-Jobs in `src/main.ts`
- [ ] T035 [US1] Erweitere `onStateChange()` Handler um Aufruf von `getJobsForTriggerState()` in `src/main.ts`
- [ ] T036 [US1] Erweitere `onStateChange()` Handler um Aufruf von `checkAndTriggerStateJob()` für gefundene Jobs in `src/main.ts`
- [ ] T037 [US5] Füge Early Return hinzu wenn keine STATE-Jobs gefunden werden in `src/main.ts`

**Checkpoint**: STATE-Jobs werden bei State-Änderungen automatisch ausgeführt

---

## Phase 5: Testing & Edge Cases

**Purpose**: Umfassende Tests für alle User Stories und Edge Cases

**Abhängigkeiten**: Phase 4 muss abgeschlossen sein

### Unit-Tests

- [ ] T038 [P] [US1] Unit-Test für STATE-Job Erstellung ohne Cron-Expression in `src/lib/CronJobManager.test.ts`
- [ ] T039 [P] [US2] Unit-Test für Trigger mit `triggerValue: true` in `src/lib/CronJobManager.test.ts`
- [ ] T040 [P] [US2] Unit-Test für Trigger mit `triggerValue: false` in `src/lib/CronJobManager.test.ts`
- [ ] T041 [P] [US2] Unit-Test für Trigger ohne `triggerValue` (jede Änderung) in `src/lib/CronJobManager.test.ts`
- [ ] T042 [P] [US3] Unit-Test für Debouncing bei schnellen State-Änderungen in `src/lib/CronJobManager.test.ts`
- [ ] T043 [P] [US4] Unit-Test für parallele Ausführung mit RECURRING-Jobs in `src/lib/CronJobManager.test.ts`
- [ ] T044 [P] [US5] Unit-Test für Performance mit vielen STATE-Jobs (50+) in `src/lib/CronJobManager.test.ts`
- [ ] T045 [P] [US6] Unit-Test für inaktive STATE-Jobs (werden nicht ausgeführt) in `src/lib/CronJobManager.test.ts`

### Edge Case Tests

- [ ] T046 [P] [Edge] Unit-Test für ungültige `triggerState`-IDs in `src/lib/CronJobManager.test.ts`
- [ ] T047 [P] [Edge] Unit-Test für fehlendes `triggerState`-Feld in `src/lib/CronJobManager.test.ts`
- [ ] T048 [P] [Edge] Unit-Test für gelöschten triggerState während Job aktiv ist in `src/lib/CronJobManager.test.ts`
- [ ] T049 [P] [Edge] Unit-Test für Debounce-Timer bei Adapter-Restart in `src/lib/CronJobManager.test.ts`
- [ ] T050 [P] [Edge] Unit-Test für sehr schnelle State-Änderungen (< 10ms) in `src/lib/CronJobManager.test.ts`

### Integration-Tests

- [ ] T051 [P] [US1] Integration-Test: STATE-Job wird bei State-Änderung ausgeführt in `test/integration/state-jobs.js`
- [ ] T052 [P] [US4] Integration-Test: STATE-Jobs funktionieren parallel zu RECURRING-Jobs in `test/integration/state-jobs.js`
- [ ] T053 [P] [US5] Integration-Test: Performance-Test mit 50+ STATE-Jobs in `test/integration/state-jobs.js`

**Checkpoint**: Alle Tests bestehen, Edge Cases abgedeckt

---

## Phase 6: Documentation

**Purpose**: Dokumentation aktualisieren

**Abhängigkeiten**: Phase 5 muss abgeschlossen sein

- [ ] T054 [P] [Doc] Erweitere README.md um Abschnitt für STATE-Job-Typ in `README.md`
- [ ] T055 [P] [Doc] Füge Beispiel-Konfigurationen für STATE-Jobs zu README.md hinzu in `README.md`
- [ ] T056 [P] [Doc] Füge Performance-Hinweise für viele State-Jobs zu README.md hinzu in `README.md`
- [ ] T057 [P] [Doc] Erstelle Changelog-Eintrag für neue Feature in `README.md` (Changelog-Sektion)

**Checkpoint**: Dokumentation ist vollständig und aktuell

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 0 (Foundation)**: Keine Abhängigkeiten - kann sofort starten
- **Phase 1 (Validation)**: Abhängig von Phase 0 - BLOCKIERT alle weiteren Phasen
- **Phase 2 (Subscription)**: Abhängig von Phase 1
- **Phase 3 (Trigger Logic)**: Abhängig von Phase 2
- **Phase 4 (Integration)**: Abhängig von Phase 3
- **Phase 5 (Testing)**: Abhängig von Phase 4
- **Phase 6 (Documentation)**: Abhängig von Phase 5

### User Story Dependencies

- **US1 (State-getriggerte Jobs erstellen)**: P1 - Kann nach Phase 1 starten
- **US2 (Bedingte Auslösung)**: P2 - Kann nach Phase 1 starten, nutzt US1
- **US3 (Debouncing)**: P2 - Kann nach Phase 1 starten, nutzt US1
- **US4 (Parallele Ausführung)**: P1 - Kann nach Phase 1 starten, nutzt US1
- **US5 (Performance)**: P2 - Kann nach Phase 1 starten, nutzt US1
- **US6 (Inaktiv)**: P1 - Kann nach Phase 1 starten, nutzt US1

### Within Each Phase

- Tests (wenn enthalten) MÜSSEN zuerst geschrieben werden und FEHLEN bevor Implementierung beginnt
- Foundation Tasks können parallel ausgeführt werden (alle [P] markiert)
- Subscription Management Tasks können teilweise parallel ausgeführt werden
- Trigger Logic Tasks müssen sequenziell ausgeführt werden (Abhängigkeiten)

### Parallel Opportunities

- **Phase 0**: Alle Tasks können parallel ausgeführt werden (T001-T005)
- **Phase 1**: Tasks können parallel ausgeführt werden (T006-T011)
- **Phase 2**: Tests können parallel geschrieben werden (T012-T014), dann Implementation (T015-T019)
- **Phase 3**: Tests können parallel geschrieben werden (T020-T023), dann Implementation sequenziell
- **Phase 4**: Tests können parallel geschrieben werden (T032-T033), dann Implementation sequenziell
- **Phase 5**: Alle Tests können parallel geschrieben werden (T038-T053)
- **Phase 6**: Alle Documentation Tasks können parallel ausgeführt werden (T054-T057)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. ✅ Phase 0: Foundation (T001-T005)
2. ✅ Phase 1: Validation (T006-T011)
3. ✅ Phase 2: Subscription Management (T012-T019)
4. ✅ Phase 3: Trigger Logic - Basis (T024-T026)
5. ✅ Phase 4: Integration (T034-T037)
6. **STOP und VALIDATE**: Test User Story 1 unabhängig
7. Deploy/Demo wenn bereit

### Incremental Delivery

1. ✅ Foundation + Validation → Basis ready
2. ✅ Add Subscription Management → Test unabhängig
3. ✅ Add Trigger Logic → Test unabhängig
4. ✅ Add Integration → Test unabhängig → Deploy/Demo (MVP!)
5. ✅ Add Debouncing (US3) → Test unabhängig → Deploy/Demo
6. ✅ Add Conditional Trigger (US2) → Test unabhängig → Deploy/Demo
7. ✅ Add Performance Tests (US5) → Test unabhängig → Deploy/Demo
8. ✅ Add Documentation → Final Release

### Parallel Team Strategy

Mit mehreren Entwicklern:

1. Team komplettiert Foundation + Validation zusammen
2. Sobald Foundation fertig:
   - Developer A: Subscription Management (Phase 2)
   - Developer B: Trigger Logic (Phase 3) - wartet auf Phase 2
   - Developer C: Tests schreiben (Phase 5) - kann parallel
3. Sobald Phase 3 fertig:
   - Developer A: Integration (Phase 4)
   - Developer B: Edge Case Tests (Phase 5)
   - Developer C: Documentation (Phase 6)

---

## Notes

- **[P]** Tasks = verschiedene Dateien, keine Abhängigkeiten
- **[Story]** Label mappt Task zu spezifischer User Story für Nachverfolgbarkeit
- Jede User Story sollte unabhängig implementierbar und testbar sein
- Tests MÜSSEN fehlschlagen bevor Implementierung beginnt
- Commit nach jeder Task oder logischen Gruppe
- An jedem Checkpoint stoppen um Story unabhängig zu validieren
- Vermeiden: vage Tasks, Datei-Konflikte, Cross-Story-Abhängigkeiten die Unabhängigkeit brechen
- TypeScript strict mode beachten
- ESLint + Prettier Regeln einhalten
- JSDoc Kommentare für alle public Methoden

---

## Quick Reference: Task IDs by Phase

- **Phase 0**: T001-T005 (Foundation)
- **Phase 1**: T006-T011 (Validation)
- **Phase 2**: T012-T019 (Subscription Management)
- **Phase 3**: T020-T031 (Trigger Logic)
- **Phase 4**: T032-T037 (Integration)
- **Phase 5**: T038-T053 (Testing)
- **Phase 6**: T054-T057 (Documentation)

**Total Tasks**: 57

