# 🚀 ioBroker.cron_scenes - Development Roadmap

## 📋 Projektübersicht

**ioBroker.cron_scenes** ist ein Adapter für zeitgesteuerte State-Steuerung im ioBroker. Die Kernidee ist, dass CronJobs über spezielle States konfiguriert und verwaltet werden, die von einer externen App (Flutter-App) erstellt werden können.

### 🎯 Hauptfunktionen
- **State-basierte Konfiguration**: CronJobs werden durch das Anlegen spezieller States definiert
- **Cross-Adapter-Steuerung**: Jobs können States in allen ioBroker Adaptern steuern
- **Admin-Interface**: Übersicht und Management aller CronJobs
- **Manueller Trigger**: Jobs können manuell ausgelöst werden
- **Fehlerbehandlung**: Robuste Fehlerbehandlung mit Status-Feedback
- **Flexible Job-Typen**: Einmalige und wiederholende Jobs

## 🗺️ Implementierungsphasen

### ✅ Phase 1: Grundkonfiguration & Admin-Interface
**Status:** Nicht begonnen
**Ziel:** Adapter-Grundkonfiguration und Admin-Interface etablieren

#### Aufgaben:
- [ ] `io-package.json` anpassen (Titel, Beschreibung, neue Config-Optionen)
- [ ] `adapter-config.d.ts` erweitern um:
  - `cronFolder`: String (Standard: "cron_scenes.0.jobs")
  - `checkInterval`: number (Sekunden, Standard: 30)
  - `enableLogging`: boolean
- [ ] Admin-Interface HTML-Struktur erstellen
- [ ] Admin-Interface CSS Styling
- [ ] Admin-Interface JavaScript Funktionalität
- [ ] Config-Seite für Adapter-Einstellungen

**Abhängigkeiten:** Keine
**geschätzte Dauer:** 1-2 Tage

### 🔄 Phase 2: Core-Funktionalität
**Status:** Nicht begonnen  
**Ziel:** Grundlegende CronJob-Funktionalität implementieren

#### Aufgaben:
- [ ] CronJob Manager Klasse implementieren
- [ ] State Watcher für konfigurierten Folder
- [ ] Job Parser für JSON-Konfiguration
- [ ] Job Executor zur Ausführung der Target-States
- [ ] Error Handling mit error-Feld-Updates
- [ ] Logging-System konfigurierbar implementieren
- [ ] State-Struktur validieren

**Abhängigkeiten:** Phase 1
**geschätzte Dauer:** 2-3 Tage

### ⚡ Phase 3: Erweiterte Features
**Status:** Nicht begonnen
**Ziel:** Zusätzliche Features und Robustheit

#### Aufgaben:
- [ ] Manueller Trigger über `.trigger` States
- [ ] Einmalige Jobs automatisch inaktiv stellen
- [ ] Status-Updates der Job-States (lastRun, nextRun, etc.)
- [ ] Bulk-Operationen (alle Jobs aktiv/inaktiv)
- [ ] Cron-Expression Validator
- [ ] Target-State Existenz-Prüfung
- [ ] Performance-Optimierung für viele Jobs

**Abhängigkeiten:** Phase 2
**geschätzte Dauer:** 1-2 Tage

### 🧪 Phase 4: Testing & Qualitätssicherung
**Status:** Nicht begonnen
**Ziel:** Umfassende Tests und Dokumentation

#### Aufgaben:
- [ ] Unit-Tests für alle Komponenten
- [ ] Integration-Tests mit echten ioBroker-Instanzen
- [ ] Error-Handling Tests
- [ ] Performance-Tests mit vielen Jobs
- [ ] README.md komplett überarbeiten
- [ ] Benutzerdokumentation erstellen
- [ ] Beispiel-Konfigurationen dokumentieren

**Abhängigkeiten:** Phase 3
**geschätzte Dauer:** 1-2 Tage

### 📦 Phase 5: Release-Vorbereitung
**Status:** Nicht begonnen
**Ziel:** Produktive Freigabe vorbereiten

#### Aufgaben:
- [ ] Finales Testing
- [ ] Code Review
- [ ] Dokumentation abschließen
- [ ] Release-Build erstellen
- [ ] Changelog aktualisieren
- [ ] GitHub Release erstellen

**Abhängigkeiten:** Phase 4
**geschätzte Dauer:** 0.5 Tage

## 🎯 State-Struktur Definition

### Job-State Format
```json
{
  "cron": "0 6 * * *",
  "targets": [
    {"id": "hue.0.light1", "value": true},
    {"id": "shelly.0.relay1", "value": "on"}
  ],
  "active": true,
  "type": "recurring",
  "error": null
}
```

### State-Value Format
```json
{
  "lastRun": "2024-01-01T06:00:00.000Z",
  "status": "success",
  "nextRun": "2024-01-02T06:00:00.000Z"
}
```

### Trigger-State Format
```
cron_scenes.0.jobs.<jobname>.trigger = true  // Setzt auf true zum Triggern
```

## 📊 Meilensteine

- **M1:** Phase 1 abgeschlossen → Grundkonfiguration funktioniert
- **M2:** Phase 2 abgeschlossen → Basis-CronJobs funktionieren
- **M3:** Phase 3 abgeschlossen → Alle Features implementiert
- **M4:** Phase 4 abgeschlossen → Vollständig getestet
- **M5:** Phase 5 abgeschlossen → Release bereit

## 🔧 Technische Entscheidungen

- **Cron-Library:** node-cron für zuverlässige CronJob-Ausführung
- **State-Überwachung:** Polling mit konfigurierbarem Intervall (Default: 30s)
- **Error Handling:** Robuste Fehlerbehandlung mit Wiederholungsmechanismen
- **Logging:** Strukturiertes Logging mit konfigurierbaren Levels
- **Performance:** Optimierte State-Überwachung für große Anzahl von Jobs

## 🚨 Risiken & Annahmen

### Risiken:
- **Komplexität der State-Validierung:** JSON-Validierung könnte komplexer werden als erwartet
- **Performance bei vielen Jobs:** 100+ Jobs könnten Performance-Probleme verursachen
- **Cross-Adapter Berechtigungen:** Berechtigungsprobleme bei State-Zugriffen anderer Adapter

### Annahmen:
- User haben grundlegende Cron-Kenntnisse
- Flutter-App kann JSON-States erstellen
- ioBroker Installation läuft stabil
- Standard-Ordner-Struktur wird eingehalten

## 📝 Konventionen

### Code Style:
- TypeScript strict mode
- ESLint Konfiguration einhalten
- JSDoc Kommentare für alle public Methoden

### State Naming:
- Job-States: Frei wählbar innerhalb des konfigurierten Folders
- Trigger-States: `<jobname>.trigger`
- Status-States: `<jobname>.status`

### Logging:
- `info`: Normale Betriebsmeldungen
- `warning`: Warnungen (z.B. fehlende Target-States)
- `error`: Fehler mit Stack-Trace
- `debug`: Detaillierte Debug-Informationen (optional)

---

**Letzte Aktualisierung:** 2024-01-XX
**Version:** 0.1.0-alpha
**Status:** Planungsphase
