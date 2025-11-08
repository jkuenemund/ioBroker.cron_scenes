# Feature Specification: State-Getriggerte Jobs

**Feature Branch**: `feature/state-triggered-jobs`  
**Created**: 2025-11-08  
**Status**: Draft  
**Input**: User description: "Erweitere den ioBroker.cron_scenes Adapter um state-getriggerte Jobs"

## User Scenarios & Testing

### User Story 1 - State-getriggerte Jobs erstellen (Priority: P1)

Als Benutzer möchte ich einen Job erstellen können, der automatisch ausgeführt wird, wenn sich ein bestimmter State ändert, damit ich reaktive Automatisierungen umsetzen kann.

**Why this priority**: Kernfunktionalität - ermöglicht reaktive Automatisierungen ohne Cron-Expressions

**Independent Test**: Kann vollständig getestet werden durch Erstellen eines STATE-Jobs mit triggerState und Prüfen ob Job bei State-Änderung ausgeführt wird

**Acceptance Scenarios**:

1. **Given** ein STATE-Job mit `type: "state"` und `triggerState: "hm-rpc.0.Bewegung.DETECTED"`, **When** der State sich ändert, **Then** wird der Job ausgeführt
2. **Given** ein STATE-Job ohne Cron-Expression, **When** der Job erstellt wird, **Then** wird kein Cron-Task erstellt
3. **Given** ein STATE-Job mit Targets, **When** der Job getriggert wird, **Then** werden alle Targets ausgeführt

---

### User Story 2 - Bedingte Auslösung (Priority: P2)

Als Benutzer möchte ich optional einen Trigger-Wert definieren können, sodass der Job nur bei bestimmten Werten ausgelöst wird.

**Why this priority**: Erhöht Flexibilität und verhindert unnötige Ausführungen

**Independent Test**: Kann getestet werden durch Erstellen eines STATE-Jobs mit triggerValue und Prüfen ob Job nur bei diesem Wert ausgelöst wird

**Acceptance Scenarios**:

1. **Given** ein STATE-Job mit `triggerValue: true`, **When** der State auf `false` ändert, **Then** wird der Job nicht ausgeführt
2. **Given** ein STATE-Job mit `triggerValue: true`, **When** der State auf `true` ändert, **Then** wird der Job ausgeführt
3. **Given** ein STATE-Job ohne triggerValue, **When** der State sich ändert, **Then** wird der Job bei jeder Änderung ausgeführt

---

### User Story 3 - Debouncing für häufige Änderungen (Priority: P2)

Als Benutzer möchte ich Debouncing konfigurieren können, um mehrfaches Auslösen bei schnellen State-Änderungen zu vermeiden.

**Why this priority**: Verhindert Performance-Probleme bei häufigen State-Änderungen

**Independent Test**: Kann getestet werden durch schnelle State-Änderungen und Prüfen ob nur die letzte verarbeitet wird

**Acceptance Scenarios**:

1. **Given** ein STATE-Job mit `debounce: 200`, **When** der State sich 3x innerhalb von 100ms ändert, **Then** wird der Job nur einmal ausgeführt (nach 200ms)
2. **Given** ein STATE-Job mit debounce, **When** der Job gelöscht wird, **Then** wird der Debounce-Timer bereinigt

---

### User Story 4 - Parallele Ausführung (Priority: P1)

Als Benutzer möchte ich, dass state-getriggerte Jobs parallel zu bestehenden Jobs funktionieren.

**Why this priority**: Rückwärtskompatibilität - bestehende Jobs müssen weiterhin funktionieren

**Independent Test**: Kann getestet werden durch Erstellen von STATE-Jobs parallel zu bestehenden RECURRING/MANUAL Jobs

**Acceptance Scenarios**:

1. **Given** bestehende RECURRING Jobs, **When** STATE-Jobs hinzugefügt werden, **Then** funktionieren alle Jobs parallel
2. **Given** verschiedene Job-Typen, **When** Jobs ausgeführt werden, **Then** gibt es keine Konflikte

---

### User Story 5 - Performance & Skalierung (Priority: P2)

Als Benutzer möchte ich viele state-getriggerte Jobs verwenden können, ohne Performance-Probleme.

**Why this priority**: Skalierbarkeit für produktive Nutzung

**Independent Test**: Kann getestet werden durch Erstellen von 50+ STATE-Jobs und Prüfen der CPU-Belastung

**Acceptance Scenarios**:

1. **Given** 50 STATE-Jobs, **When** States sich ändern, **Then** bleibt CPU-Belastung unter 5%
2. **Given** STATE-Jobs, **When** Jobs gelöscht werden, **Then** werden Subscriptions automatisch entfernt

---

### User Story 6 - Inaktiv (Priority: P1)

Ein auf Inaktiv gestellter state-getriggerter Job verbleibt als Konfiguration, wird aber nicht mehr ausgeführt.

**Why this priority**: Kernfunktion

**Independent Test**: Kann getestet werden durch Erstellen von STATE-Jobs und Deaktivieren dieser. Danach wird
der auslösende State getriggert

**Acceptance Scenarios**:

1. **Given** ein STATE-Job mit `triggerValue: true`, **When** der State auf `false` ändert, **Then** wird der Job nicht ausgeführt
2. **Given** ein STATE-Job mit `triggerValue: false`, **When** der State auf `true` ändert, **Then** wird der Job nicht ausgeführt

---

### Edge Cases

- Was passiert wenn triggerState-ID ungültig ist?
- Wie verhält sich das System bei fehlendem triggerState-Feld?
- Was passiert wenn triggerState gelöscht wird während Job aktiv ist?
- Wie werden Debounce-Timer bei Adapter-Restart behandelt?
- Was passiert bei sehr schnellen State-Änderungen (< 10ms)?

## Requirements

### Functional Requirements

- **FR-001**: System MUST einen neuen Job-Typ "state" unterstützen
- **FR-002**: System MUST triggerState als Pflichtfeld für STATE-Jobs validieren
- **FR-003**: System MUST nur triggerState-IDs abonnieren, niemals alle States
- **FR-004**: System MUST triggerValue optional unterstützen
- **FR-005**: System MUST debounce optional unterstützen (Standard: 100ms)
- **FR-006**: System MUST alle bestehenden Target-Typen (value, state, expression) für STATE-Jobs unterstützen
- **FR-007**: System MUST Subscriptions beim Löschen von Jobs automatisch entfernen
- **FR-008**: System MUST Debounce-Timer beim Shutdown bereinigen
- **FR-009**: System MUST bestehende Jobs unverändert funktionieren lassen (Rückwärtskompatibilität)

### Key Entities

- **StateJob**: Ein Job der durch State-Änderungen getriggert wird
    - triggerState: State-ID die überwacht wird
    - triggerValue: Optionaler Wert für bedingte Auslösung
    - debounce: Optionales Debounce-Intervall in ms
    - targets: Liste der auszuführenden Targets (wie bei anderen Job-Typen)

- **TriggerStateSubscription**: Mapping von triggerState zu Job-IDs
    - Ermöglicht schnelle Lookups in onStateChange Handler
    - Wird automatisch verwaltet beim Hinzufügen/Löschen von Jobs

## Success Criteria

### Measurable Outcomes

- **SC-001**: STATE-Jobs können erstellt werden ohne Cron-Expression
- **SC-002**: STATE-Jobs werden bei State-Änderungen automatisch ausgeführt
- **SC-003**: System unterstützt 50+ STATE-Jobs ohne Performance-Degradation (< 5% CPU)
- **SC-004**: Debouncing verhindert mehrfaches Auslösen bei schnellen Änderungen
- **SC-005**: Bestehende RECURRING/MANUAL Jobs funktionieren unverändert
- **SC-006**: Subscriptions werden korrekt verwaltet (keine Memory-Leaks)

## Technische Spezifikation

- Ungültige `triggerState`-IDs werden geloggt aber blockieren nicht andere Jobs
- Fehlende `triggerState` bei STATE-Jobs führt zu Config-Error
- Fehlerhafte Debounce-Werte werden validiert (0-60000ms)
- State-Subscription-Fehler werden geloggt, Job wird als inaktiv markiert

## Performance-Anforderungen

- Selektives Abonnieren: Nur `triggerState`-IDs, niemals `subscribeStates("*")`
- Effiziente Lookups: Map-basierte Datenstrukturen (O(1) Lookup)
- Early Returns: Schnelle Filterung in onStateChange Handler
- Debouncing: Verhindert mehrfaches Auslösen bei schnellen Änderungen
- Memory: Automatisches Cleanup von Timers und Subscriptions

## Rückwärtskompatibilität

- Bestehende Job-Konfigurationen funktionieren unverändert
- Neue Felder sind optional (triggerState, triggerValue, debounce)
- CRON_JOB_TYPE wird erweitert, bestehende Werte bleiben unverändert
- Keine automatischen Konvertierungen bestehender Jobs

## Tests

- Unit-Tests für Subscription-Management
- Unit-Tests für Trigger-Logik (triggerValue, triggerOnChange)
- Unit-Tests für Debouncing-Mechanismus
- Integration-Tests mit echten State-Änderungen
- Performance-Tests mit vielen State-Jobs (50+)
- Fehlerbehandlung-Tests (ungültige triggerState-IDs)

## Dokumentation

- README.md erweitern um STATE-Job-Typ
- Beispiel-Konfigurationen dokumentieren
- Performance-Hinweise für viele State-Jobs
- Changelog-Eintrag für neue Feature

## Beispiel Job Konfiguration

{
"type": "state",
"triggerState": "hm-rpc.0.Wohnzimmer.Bewegung.DETECTED",
"targets": [
{"id": "hm-rpc.0.Wohnzimmer.Licht.STATE", "value": true}
],
"active": true
}
