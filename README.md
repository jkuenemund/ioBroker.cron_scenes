![Logo](admin/cron_scenes.png)

# ioBroker.cron_scenes

[![NPM version](https://img.shields.io/npm/v/iobroker.cron_scenes.svg)](https://www.npmjs.com/package/iobroker.cron_scenes)
[![Downloads](https://img.shields.io/npm/dm/iobroker.cron_scenes.svg)](https://www.npmjs.com/package/iobroker.cron_scenes)
![Number of Installations](https://iobroker.live/badges/cron_scenes-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/cron_scenes-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.cron_scenes.png?downloads=true)](https://nodei.co/npm/iobroker.cron_scenes/)

**Tests:** ![Test and Release](https://github.com/jkuenemund/ioBroker.cron_scenes/workflows/Test%20and%20Release/badge.svg)

## cron_scenes adapter for ioBroker

Ein ioBroker Adapter zur zeitbasierten Ausführung von Aktionen (Szenen) über Cron-Jobs. Mit diesem Adapter können Sie verschiedene States zu bestimmten Zeiten automatisch setzen - perfekt für Hausautomatisierung, Beleuchtungssteuerung und wiederkehrende Aufgaben.

## ✨ Features

- ⏰ **Flexible Zeitsteuerung** - Nutzt Cron-Expressions für präzise Zeitplanung
- 🎯 **Multi-Target Support** - Ein Job kann mehrere States gleichzeitig setzen
- 🔄 **Wiederkehrende & Einmalige Jobs** - Unterstützt sowohl recurring als auch once-Jobs
- 🎮 **Manuelle Auslösung** - Jeder Job kann manuell über einen Trigger-Button gestartet werden
- 📊 **Status-Überwachung** - Vollständige Überwachung der Job-Ausführung mit Fehlermeldungen
- 🗂️ **Automatische Ordnerstruktur** - Jobs-Ordner wird automatisch beim ersten Start erstellt

## 🚀 Installation

1. Installieren Sie den Adapter über die ioBroker Admin-Oberfläche
2. Erstellen Sie eine neue Instanz des `cron_scenes` Adapters
3. Starten Sie die Instanz - der Jobs-Ordner wird automatisch erstellt

## 📋 Konfiguration

### Jobs-Ordner

Nach dem ersten Start finden Sie den Jobs-Ordner unter:

```
cron_scenes.0.jobs
```

Hier werden alle Ihre Cron-Jobs gespeichert. Ein Beispiel-Job wird automatisch erstellt.

### Einen neuen Cron-Job erstellen

1. **Navigieren Sie zum Jobs-Ordner** in der Admin-Oberfläche: `cron_scenes.0.jobs`
2. **Erstellen Sie einen neuen State** mit dem gewünschten Job-Namen (z.B. `morningLights`)
3. **Konfigurieren Sie den State:**
    - **Type:** `string`
    - **Role:** `json`
    - **Read:** `true`
    - **Write:** `true`

4. **Setzen Sie die Job-Konfiguration** als JSON-String:

```json
{
	"cron": "0 7 * * 1-5",
	"targets": [
		{
			"id": "hm-rpc.0.Wohnzimmer.Licht.STATE",
			"value": true
		},
		{
			"id": "hm-rpc.0.Kueche.Licht.LEVEL",
			"value": 80
		}
	],
	"active": true,
	"type": "recurring"
}
```

### 📝 Konfigurationsparameter

| Parameter | Typ     | Beschreibung                               | Beispiel         |
| --------- | ------- | ------------------------------------------ | ---------------- |
| `cron`    | string  | Cron-Expression für die Zeitsteuerung      | `"0 7 * * 1-5"`  |
| `targets` | array   | Liste der States die gesetzt werden sollen | siehe unten      |
| `active`  | boolean | Ob der Job aktiv ist                       | `true` / `false` |
| `type`    | string  | Job-Typ: `"recurring"` oder `"once"`       | `"recurring"`    |

#### Target-Konfiguration

Jedes Target hat folgende Eigenschaften:

| Parameter     | Typ    | Beschreibung                                    | Beispiel                             |
| ------------- | ------ | ----------------------------------------------- | ------------------------------------ |
| `id`          | string | Die ioBroker State-ID, die gesetzt werden soll  | `"hm-rpc.0.Licht.STATE"`             |
| `type`        | string | Art des Target-Werts (optional)                 | `"value"`, `"state"`, `"expression"` |
| `value`       | any    | Der Wert oder die Referenz, abhängig vom `type` | `true`, `"weather.0.temp"`           |
| `description` | string | Optionale Beschreibung des Targets              | `"Wohnzimmer Licht"`                 |

#### Target-Types im Detail

##### 🎯 Type: `"value"` (Standard)

Setzt einen direkten Wert - rückwärtskompatibel mit bestehenden Jobs:

```json
{
	"id": "hm-rpc.0.Licht.STATE",
	"type": "value", // optional, ist Standard
	"value": true,
	"description": "Licht einschalten"
}
```

##### 🔗 Type: `"state"` 🆕

Kopiert den Wert aus einem anderen State - perfekt für dynamische Szenen:

```json
{
	"id": "hm-rpc.0.Thermostat.SET_TEMPERATURE",
	"type": "state",
	"value": "weather.0.current.temperature",
	"description": "Heizung an Außentemperatur anpassen"
}
```

##### ⚡ Type: `"expression"` 🆕

Evaluiert JavaScript-Ausdrücke in sicherer Sandbox - für komplexe Berechnungen und Logik:

```json
{
	"id": "javascript.0.variables.result",
	"type": "expression",
	"value": "Math.max(18, state('weather.0.temperature') + 2)",
	"description": "Heizung: mindestens 18°C oder Außentemperatur + 2°C"
}
```

**Expression-Syntax:**

- **State-Referenzen**: `state('adapter.instance.state')` oder `state["adapter.instance.state"]`
- **Math-Funktionen**: `Math.max()`, `Math.min()`, `Math.round()`, `Math.abs()`, etc.
- **Zeitstempel**: `now` (aktuelle Zeit in Millisekunden)
- **Bedingte Logik**: `condition ? valueTrue : valueFalse`
- **Vergleiche**: `>`, `<`, `===`, `!==`, `>=`, `<=`

**Sicherheit:**

- Läuft in isolierter V8-Instanz (8MB Memory-Limit, 5s Timeout)
- Kein Zugriff auf Filesystem, Network oder System-APIs
- Nur definierte State-Werte und Math-Objekt verfügbar

#### 🔄 State vs. Expression - Wann verwende ich was?

Für das Übernehmen von Werten aus anderen States gibt es **zwei Möglichkeiten**:

##### **Type: `"state"` - Einfaches Kopieren**

```json
{
	"id": "hm-rpc.0.Thermostat.SET_TEMPERATURE",
	"type": "state",
	"value": "weather.0.current.temperature"
}
```

✅ **Verwende `state` wenn**: Du einen Wert 1:1 kopieren möchtest  
✅ **Vorteile**: Einfach, schnell, klar verständlich

##### **Type: `"expression"` - Mit Logik und Berechnung**

```json
{
	"id": "hm-rpc.0.Thermostat.SET_TEMPERATURE",
	"type": "expression",
	"value": "Math.max(18, state('weather.0.current.temperature') + 2)"
}
```

✅ **Verwende `expression` wenn**: Du Berechnungen, Bedingungen oder Logik brauchst  
✅ **Vorteile**: Mächtig, flexibel, kann mehrere States kombinieren

#### Rückwärtskompatibilität

Bestehende Jobs ohne `type`-Feld funktionieren weiterhin:

```json
{
	"id": "adapter.instance.device.state",
	"value": "gewünschter Wert"
}
```

### ⏰ Cron-Expression Beispiele

| Expression       | Beschreibung                      |
| ---------------- | --------------------------------- |
| `"0 7 * * 1-5"`  | Jeden Werktag um 7:00 Uhr         |
| `"30 22 * * *"`  | Täglich um 22:30 Uhr              |
| `"0 0 1 * *"`    | Am 1. jeden Monats um Mitternacht |
| `"*/15 * * * *"` | Alle 15 Minuten                   |
| `"0 8,20 * * *"` | Täglich um 8:00 und 20:00 Uhr     |

## 🎮 Verwendung

### Automatische Ausführung

- Jobs mit `"active": true` werden automatisch zur konfigurierten Zeit ausgeführt
- Der Adapter überprüft alle 30 Sekunden auf Änderungen

### Manuelle Auslösung

- Für jeden Job wird automatisch ein Trigger-Button erstellt: `{jobName}.trigger`
- Setzen Sie den Trigger auf `true` um den Job manuell zu starten
- Der Trigger wird automatisch zurückgesetzt

### Status-Überwachung

- Jeder Job erhält automatisch einen Status-State: `{jobName}.status`
- Enthält Informationen über letzte Ausführung, nächste Ausführung und Fehler

## 📊 Beispiel-Szenarien

### Morgendliche Beleuchtung (klassisch)

```json
{
	"cron": "0 7 * * 1-5",
	"targets": [
		{ "id": "hm-rpc.0.Wohnzimmer.Licht.STATE", "value": true },
		{ "id": "hm-rpc.0.Kueche.Licht.LEVEL", "value": 60 }
	],
	"active": true,
	"type": "recurring"
}
```

### Intelligente Heizungssteuerung 🆕

```json
{
	"cron": "0 6 * * *",
	"targets": [
		{
			"id": "hm-rpc.0.Wohnzimmer.Thermostat.SET_TEMPERATURE",
			"type": "state",
			"value": "weather.0.forecast.0.tempMax",
			"description": "Heizung basierend auf Wettervorhersage"
		},
		{
			"id": "hm-rpc.0.Schlafzimmer.Thermostat.SET_TEMPERATURE",
			"type": "state",
			"value": "javascript.0.variables.optimalSleepTemp",
			"description": "Optimale Schlaftemperatur aus Berechnung"
		}
	],
	"active": true,
	"type": "recurring"
}
```

### Kombinierte Szene (verschiedene Target-Types) 🆕

```json
{
	"cron": "0 20 * * *",
	"targets": [
		{
			"id": "hm-rpc.0.Wohnzimmer.Licht.STATE",
			"type": "value",
			"value": true,
			"description": "Licht direkt einschalten"
		},
		{
			"id": "hm-rpc.0.Wohnzimmer.Licht.LEVEL",
			"type": "state",
			"value": "javascript.0.variables.eveningBrightness",
			"description": "Helligkeit aus berechneter Variable"
		},
		{
			"id": "hm-rpc.0.Jalousie.LEVEL",
			"type": "value",
			"value": 0,
			"description": "Jalousie komplett schließen"
		}
	],
	"active": true,
	"type": "recurring"
}
```

### Toggle-Funktionen mit Expressions 🔄

#### Licht-Toggle (Ein/Aus wechseln)

```json
{
	"cron": "0 18 * * *",
	"targets": [
		{
			"id": "hm-rpc.0.Wohnzimmer.Licht.STATE",
			"type": "expression",
			"value": "!state('hm-rpc.0.Wohnzimmer.Licht.STATE')",
			"description": "Licht umschalten: Ein → Aus, Aus → Ein"
		}
	],
	"active": true,
	"type": "recurring"
}
```

#### Intelligenter Helligkeits-Toggle

```json
{
	"cron": "0 22 * * *",
	"targets": [
		{
			"id": "hm-rpc.0.Wohnzimmer.Licht.LEVEL",
			"type": "expression",
			"value": "state('hm-rpc.0.Wohnzimmer.Licht.LEVEL') > 50 ? 10 : 80",
			"description": "Helligkeit wechseln: Hell (>50%) → Dimm (10%), Dunkel → Hell (80%)"
		}
	],
	"active": true,
	"type": "recurring"
}
```

#### Thermostat-Modus Toggle

```json
{
	"cron": "0 6 * * 1-5",
	"targets": [
		{
			"id": "hm-rpc.0.Thermostat.SET_TEMPERATURE",
			"type": "expression",
			"value": "state('hm-rpc.0.Thermostat.SET_TEMPERATURE') === 21 ? 18 : 21",
			"description": "Temperatur zwischen Komfort (21°C) und Eco (18°C) wechseln"
		}
	],
	"active": true,
	"type": "recurring"
}
```

### Erweiterte Expression-Beispiele 🧠

#### Wetterbasierte Heizungssteuerung

```json
{
	"cron": "0 6 * * *",
	"targets": [
		{
			"id": "hm-rpc.0.Heizung.SET_TEMPERATURE",
			"type": "expression",
			"value": "state('weather.0.current.temperature') < 5 ? 22 : (state('weather.0.current.temperature') < 15 ? 20 : 18)",
			"description": "Heizung: <5°C → 22°C, <15°C → 20°C, sonst 18°C"
		}
	],
	"active": true,
	"type": "recurring"
}
```

#### Zeitbasierte Beleuchtung

```json
{
	"cron": "*/30 * * * *",
	"targets": [
		{
			"id": "hm-rpc.0.Garten.Licht.STATE",
			"type": "expression",
			"value": "state('javascript.0.variables.isDark') && state('hm-rpc.0.Motion.DETECTED')",
			"description": "Gartenlicht nur bei Dunkelheit UND Bewegung"
		},
		{
			"id": "hm-rpc.0.Wohnzimmer.Licht.LEVEL",
			"type": "expression",
			"value": "Math.round(Math.max(20, 100 - (state('weather.0.current.brightness') / 10)))",
			"description": "Helligkeit abhängig von Außenhelligkeit (20-100%)"
		}
	],
	"active": true,
	"type": "recurring"
}
```

#### Multi-Sensor Logik

```json
{
	"cron": "*/5 * * * *",
	"targets": [
		{
			"id": "javascript.0.variables.autoMode",
			"type": "expression",
			"value": "state('sensor.temperature') > 25 && state('sensor.humidity') > 70 && state('weather.0.current.windSpeed') < 10",
			"description": "Auto-Modus: Heiß UND feucht UND wenig Wind"
		}
	],
	"active": true,
	"type": "recurring"
}
```

### Einmalige Aktion

```json
{
	"cron": "0 14 25 12 *",
	"targets": [{ "id": "hm-rpc.0.Heizung.SET_TEMPERATURE", "value": 21 }],
	"active": true,
	"type": "once"
}
```

## 🔧 Konfigurationsoptionen

In der Adapter-Konfiguration können Sie folgende Parameter einstellen:

- **cronFolder**: Alternativer Pfad für Jobs (Standard: `cron_scenes.0.jobs`)
- **checkInterval**: Überprüfungsintervall in Sekunden (Standard: 30)
- **enableLogging**: Erweiterte Protokollierung aktivieren

## 🐛 Problembehandlung

### Job wird nicht ausgeführt

1. Überprüfen Sie die Cron-Expression mit einem Online-Tool
2. Stellen Sie sicher, dass `"active": true` gesetzt ist
3. Prüfen Sie die Logs auf Fehlermeldungen
4. Überprüfen Sie, ob die Ziel-States existieren

### Fehlerhafte Konfiguration

- Der Status-State zeigt detaillierte Fehlermeldungen
- Überprüfen Sie die JSON-Syntax der Konfiguration
- Stellen Sie sicher, dass alle Pflichtfelder vorhanden sind

## Developer manual

This section is intended for the developer. It can be deleted later.

### DISCLAIMER

Please make sure that you consider copyrights and trademarks when you use names or logos of a company and add a disclaimer to your README.
You can check other adapters for examples or ask in the developer community. Using a name or logo of a company without permission may cause legal problems for you.

### Getting started

You are almost done, only a few steps left:

1. Create a new repository on GitHub with the name `ioBroker.cron_scenes`
1. Initialize the current folder as a new git repository:
    ```bash
    git init -b main
    git add .
    git commit -m "Initial commit"
    ```
1. Link your local repository with the one on GitHub:

    ```bash
    git remote add origin https://github.com/jkuenemund/ioBroker.cron_scenes
    ```

1. Push all files to the GitHub repo:
    ```bash
    git push origin main
    ```
1. Add a new secret under https://github.com/jkuenemund/ioBroker.cron_scenes/settings/secrets. It must be named `AUTO_MERGE_TOKEN` and contain a personal access token with push access to the repository, e.g. yours. You can create a new token under https://github.com/settings/tokens.

1. Head over to [src/main.ts](src/main.ts) and start programming!

### Best Practices

We've collected some [best practices](https://github.com/ioBroker/ioBroker.repositories#development-and-coding-best-practices) regarding ioBroker development and coding in general. If you're new to ioBroker or Node.js, you should
check them out. If you're already experienced, you should also take a look at them - you might learn something new :)

### Scripts in `package.json`

Several npm scripts are predefined for your convenience. You can run them using `npm run <scriptname>`
| Script name | Description |
|-------------|-------------|
| `build` | Compile the TypeScript sources. |
| `watch` | Compile the TypeScript sources and watch for changes. |
| `test:ts` | Executes the tests you defined in `*.test.ts` files. |
| `test:package` | Ensures your `package.json` and `io-package.json` are valid. |
| `test:integration` | Tests the adapter startup with an actual instance of ioBroker. |
| `test` | Performs a minimal test run on package files and your tests. |
| `check` | Performs a type-check on your code (without compiling anything). |
| `lint` | Runs `ESLint` to check your code for formatting errors and potential bugs. |
| `translate` | Translates texts in your adapter to all required languages, see [`@iobroker/adapter-dev`](https://github.com/ioBroker/adapter-dev#manage-translations) for more details. |
| `release` | Creates a new release, see [`@alcalzone/release-script`](https://github.com/AlCalzone/release-script#usage) for more details. |

### Configuring the compilation

The adapter template uses [esbuild](https://esbuild.github.io/) to compile TypeScript and/or React code. You can configure many compilation settings
either in `tsconfig.json` or by changing options for the build tasks. These options are described in detail in the
[`@iobroker/adapter-dev` documentation](https://github.com/ioBroker/adapter-dev#compile-adapter-files).

### Writing tests

When done right, testing code is invaluable, because it gives you the
confidence to change your code while knowing exactly if and when
something breaks. A good read on the topic of test-driven development
is https://hackernoon.com/introduction-to-test-driven-development-tdd-61a13bc92d92.
Although writing tests before the code might seem strange at first, but it has very
clear upsides.

The template provides you with basic tests for the adapter startup and package files.
It is recommended that you add your own tests into the mix.

### Publishing the adapter

Using GitHub Actions, you can enable automatic releases on npm whenever you push a new git tag that matches the form
`v<major>.<minor>.<patch>`. We **strongly recommend** that you do. The necessary steps are described in `.github/workflows/test-and-release.yml`.

Since you installed the release script, you can create a new
release simply by calling:

```bash
npm run release
```

Additional command line options for the release script are explained in the
[release-script documentation](https://github.com/AlCalzone/release-script#command-line).

To get your adapter released in ioBroker, please refer to the documentation
of [ioBroker.repositories](https://github.com/ioBroker/ioBroker.repositories#requirements-for-adapter-to-get-added-to-the-latest-repository).

### Test the adapter manually with dev-server

Since you set up `dev-server`, you can use it to run, test and debug your adapter.

You may start `dev-server` by calling from your dev directory:

```bash
dev-server watch
```

The ioBroker.admin interface will then be available at http://localhost:8181/

Please refer to the [`dev-server` documentation](https://github.com/ioBroker/dev-server#command-line) for more details.

## Changelog

<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**

- (kuen_je) initial release
- (kuen_je) Added automatic jobs folder creation
- (kuen_je) Added example job configuration
- (kuen_je) Added comprehensive user documentation
- (kuen_je) Implemented cron job manager with multi-target support
- (kuen_je) Added manual trigger functionality for each job
- (kuen_je) Added job status monitoring and error handling
- (kuen_je) Enhanced target configuration with type system (value, state, expression)
- (kuen_je) Implemented state reference functionality for dynamic values
- (kuen_je) Added powerful JavaScript expression engine with isolated-vm sandbox
- (kuen_je) Implemented toggle functionality and complex logic support in expressions
- (kuen_je) Added comprehensive admin interface with configuration options
- (kuen_je) Improved event-driven architecture for better performance

## License

This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <https://unlicense.org>
