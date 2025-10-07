# ioBroker Cron Scenes - REST API Documentation

Diese Dokumentation beschreibt, wie Cron Jobs über die ioBroker REST-API verwaltet werden können. Dies ermöglicht es externen Anwendungen (Apps), Jobs zu erstellen, zu bearbeiten und auszulösen.

## 📋 Inhaltsverzeichnis

1. [Grundlagen](#grundlagen)
2. [Authentifizierung](#authentifizierung)
3. [Job-Konfiguration](#job-konfiguration)
4. [API-Endpunkte](#api-endpunkte)
5. [Beispiele](#beispiele)
6. [Fehlerbehandlung](#fehlerbehandlung)
7. [Best Practices](#best-practices)

## 🔧 Grundlagen

### ioBroker REST-API Setup

Die REST-API muss in ioBroker aktiviert sein:

- **Adapter**: `rest-api` oder `simple-api`
- **Standard-Port**: `8087` (rest-api) oder `8082` (simple-api)
- **Base-URL**: `http://your-iobroker-ip:8087/v1/` (rest-api)

### Cron Scenes Adapter

- **Namespace**: `cron_scenes.0`
- **Jobs-Ordner**: `cron_scenes.0.jobs` (konfigurierbar)
- **Job-Format**: JSON-Konfiguration als State-Wert

## 🔐 Authentifizierung

### API-Token (empfohlen)

```http
Authorization: Bearer YOUR_API_TOKEN
```

### Basic Auth (alternativ)

```http
Authorization: Basic base64(username:password)
```

### Query Parameter (nicht empfohlen für Produktion)

```
?user=username&pass=password
```

## 📝 Job-Konfiguration

### Job-Struktur

```typescript
interface CronJob {
	cron?: string; // Cron-Expression (optional für manual jobs)
	targets: CronTarget[]; // Array von Aktionen
	active: boolean; // Job aktiv/inaktiv
	type: "recurring" | "once" | "manual"; // Job-Typ
}

interface CronTarget {
	id: string; // ioBroker State-ID
	type?: "value" | "state"; // Target-Typ (default: "value")
	value: any; // Wert oder State-ID
	description?: string; // Beschreibung
	delay?: number; // Verzögerung in ms (0-60000)
}
```

### Job-Typen

| Typ         | Beschreibung                       | Cron erforderlich |
| ----------- | ---------------------------------- | ----------------- |
| `recurring` | Wiederkehrend nach Cron-Pattern    | ✅ Ja             |
| `once`      | Einmalig zum angegebenen Zeitpunkt | ✅ Ja             |
| `manual`    | Nur manuell auslösbar              | ❌ Nein           |

## 🌐 API-Endpunkte

### 1. Job erstellen/aktualisieren

**PUT** `/states/cron_scenes.0.jobs.{jobName}`

```http
PUT /v1/states/cron_scenes.0.jobs.myJob HTTP/1.1
Host: your-iobroker-ip:8087
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "val": "{\"cron\":\"0 7 * * 1-5\",\"targets\":[{\"id\":\"hm-rpc.0.Light.STATE\",\"value\":true}],\"active\":true,\"type\":\"recurring\"}"
}
```

### 2. Job lesen

**GET** `/states/cron_scenes.0.jobs.{jobName}`

```http
GET /v1/states/cron_scenes.0.jobs.myJob HTTP/1.1
Host: your-iobroker-ip:8087
Authorization: Bearer YOUR_TOKEN
```

### 3. Job manuell auslösen

**PUT** `/states/cron_scenes.0.jobs.{jobName}.trigger`

```http
PUT /v1/states/cron_scenes.0.jobs.myJob.trigger HTTP/1.1
Host: your-iobroker-ip:8087
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "val": true
}
```

### 4. Job-Status abrufen

**GET** `/states/cron_scenes.0.jobs.{jobName}.status`

```http
GET /v1/states/cron_scenes.0.jobs.myJob.status HTTP/1.1
Host: your-iobroker-ip:8087
Authorization: Bearer YOUR_TOKEN
```

### 5. Job löschen

**DELETE** `/states/cron_scenes.0.jobs.{jobName}`

```http
DELETE /v1/states/cron_scenes.0.jobs.myJob HTTP/1.1
Host: your-iobroker-ip:8087
Authorization: Bearer YOUR_TOKEN
```

### 6. Alle Jobs auflisten

**GET** `/states/cron_scenes.0.jobs.*`

```http
GET /v1/states/cron_scenes.0.jobs.* HTTP/1.1
Host: your-iobroker-ip:8087
Authorization: Bearer YOUR_TOKEN
```

## 💡 Beispiele

### Beispiel 1: Einfacher Licht-Job

```json
{
	"cron": "0 19 * * *",
	"targets": [
		{
			"id": "hm-rpc.0.Wohnzimmer.Licht.STATE",
			"type": "value",
			"value": true,
			"description": "Wohnzimmerlicht einschalten"
		}
	],
	"active": true,
	"type": "recurring"
}
```

### Beispiel 2: Komplexe Szene mit Verzögerungen

```json
{
	"cron": "0 6 * * 1-5",
	"targets": [
		{
			"id": "hm-rpc.0.Heizung.SET_TEMPERATURE",
			"type": "value",
			"value": 21,
			"description": "Heizung auf 21°C"
		},
		{
			"id": "hm-rpc.0.Jalousie.LEVEL",
			"type": "value",
			"value": 100,
			"description": "Jalousie öffnen",
			"delay": 5000
		},
		{
			"id": "hm-rpc.0.Licht.STATE",
			"type": "value",
			"value": true,
			"description": "Licht einschalten",
			"delay": 10000
		}
	],
	"active": true,
	"type": "recurring"
}
```

### Beispiel 3: Manueller Szenen-Button

```json
{
	"targets": [
		{
			"id": "hm-rpc.0.Wohnzimmer.Licht.STATE",
			"type": "value",
			"value": false,
			"description": "Alle Lichter aus"
		},
		{
			"id": "hm-rpc.0.TV.POWER",
			"type": "value",
			"value": false,
			"description": "TV ausschalten",
			"delay": 1000
		}
	],
	"active": true,
	"type": "manual"
}
```

### Beispiel 4: State-basierter Job

```json
{
	"cron": "0 */2 * * *",
	"targets": [
		{
			"id": "hm-rpc.0.Thermostat.SET_TEMPERATURE",
			"type": "state",
			"value": "weather.0.forecast.temperature",
			"description": "Heizung an Wettervorhersage anpassen"
		}
	],
	"active": true,
	"type": "recurring"
}
```

## 📱 JavaScript/TypeScript Beispiel (App-Integration)

```javascript
class CronScenesAPI {
	constructor(baseUrl, token) {
		this.baseUrl = baseUrl; // z.B. 'http://192.168.1.100:8087/v1'
		this.token = token;
	}

	async createJob(jobName, jobConfig) {
		const response = await fetch(`${this.baseUrl}/states/cron_scenes.0.jobs.${jobName}`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${this.token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				val: JSON.stringify(jobConfig),
			}),
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		return await response.json();
	}

	async triggerJob(jobName) {
		const response = await fetch(`${this.baseUrl}/states/cron_scenes.0.jobs.${jobName}.trigger`, {
			method: "PUT",
			headers: {
				Authorization: `Bearer ${this.token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ val: true }),
		});

		return response.ok;
	}

	async getJobStatus(jobName) {
		const response = await fetch(`${this.baseUrl}/states/cron_scenes.0.jobs.${jobName}.status`, {
			headers: {
				Authorization: `Bearer ${this.token}`,
			},
		});

		if (response.ok) {
			const data = await response.json();
			return JSON.parse(data.val);
		}

		return null;
	}

	async deleteJob(jobName) {
		const response = await fetch(`${this.baseUrl}/states/cron_scenes.0.jobs.${jobName}`, {
			method: "DELETE",
			headers: {
				Authorization: `Bearer ${this.token}`,
			},
		});

		return response.ok;
	}
}

// Verwendung:
const api = new CronScenesAPI("http://192.168.1.100:8087/v1", "your-token");

// Job erstellen
await api.createJob("morningScene", {
	cron: "0 7 * * 1-5",
	targets: [{ id: "hm-rpc.0.Light.STATE", value: true }],
	active: true,
	type: "recurring",
});

// Job manuell auslösen
await api.triggerJob("morningScene");
```

## ⚠️ Fehlerbehandlung

### HTTP Status Codes

- `200 OK` - Erfolgreich
- `201 Created` - Erstellt
- `400 Bad Request` - Ungültige Anfrage
- `401 Unauthorized` - Nicht authentifiziert
- `403 Forbidden` - Keine Berechtigung
- `404 Not Found` - Nicht gefunden
- `500 Internal Server Error` - Server-Fehler

### Typische Fehlerquellen

1. **Ungültige Cron-Expression**: `"0 25 * * *"` (Stunde > 23)
2. **Fehlende State-ID**: Target ohne gültige `id`
3. **Ungültiger Job-Typ**: Typ muss `recurring`, `once` oder `manual` sein
4. **JSON-Syntax-Fehler**: Malformed JSON in der Konfiguration

### Validierung vor API-Aufruf

```javascript
function validateJobConfig(config) {
	// Job-Typ prüfen
	if (!["recurring", "once", "manual"].includes(config.type)) {
		throw new Error("Invalid job type");
	}

	// Cron-Pattern für scheduled jobs prüfen
	if (config.type !== "manual" && !config.cron) {
		throw new Error("Cron expression required for scheduled jobs");
	}

	// Targets validieren
	if (!Array.isArray(config.targets) || config.targets.length === 0) {
		throw new Error("At least one target required");
	}

	config.targets.forEach((target, index) => {
		if (!target.id) {
			throw new Error(`Target ${index}: id is required`);
		}
		if (target.delay && (target.delay < 0 || target.delay > 60000)) {
			throw new Error(`Target ${index}: delay must be between 0 and 60000ms`);
		}
	});
}
```

## 🎯 Best Practices

### 1. Naming Convention

```
jobName: "scene_morning_workday"
jobName: "light_evening_weekend"
jobName: "heating_winter_schedule"
```

### 2. Job-Beschreibungen

Immer aussagekräftige Beschreibungen verwenden:

```json
{
	"description": "Morgendliche Aufwach-Szene: Heizung, Licht und Jalousien"
}
```

### 3. Fehlerbehandlung

```javascript
try {
	await api.createJob("myJob", config);
	console.log("Job erfolgreich erstellt");
} catch (error) {
	console.error("Fehler beim Erstellen des Jobs:", error.message);
	// Benutzer informieren
}
```

### 4. Status-Überwachung

```javascript
// Nach Job-Trigger Status prüfen
await api.triggerJob("myJob");

setTimeout(async () => {
	const status = await api.getJobStatus("myJob");
	if (status.status === "error") {
		console.error("Job-Fehler:", status.error);
	}
}, 2000);
```

### 5. Batch-Operationen

Für mehrere Jobs sequenziell arbeiten:

```javascript
const jobs = [
	{ name: "morning", config: morningConfig },
	{ name: "evening", config: eveningConfig },
];

for (const job of jobs) {
	await api.createJob(job.name, job.config);
	await new Promise((resolve) => setTimeout(resolve, 100)); // Kleine Pause
}
```

## 📊 Monitoring und Debugging

### Job-Status interpretieren

```json
{
	"status": "success",
	"lastRun": "2024-01-15T07:00:00.000Z",
	"nextRun": "2024-01-16T07:00:00.000Z"
}
```

### Logging aktivieren

In der Adapter-Konfiguration `enableLogging: true` setzen für detaillierte Logs.

---

## 🚀 Quick Start für App-Entwickler

1. **ioBroker REST-API aktivieren**
2. **API-Token generieren**
3. **Test-Job erstellen**:
    ```bash
    curl -X PUT "http://your-ip:8087/v1/states/cron_scenes.0.jobs.test" \
         -H "Authorization: Bearer YOUR_TOKEN" \
         -H "Content-Type: application/json" \
         -d '{"val":"{\"targets\":[{\"id\":\"system.adapter.admin.0.alive\",\"value\":true}],\"active\":true,\"type\":\"manual\"}"}'
    ```
4. **Job auslösen**:
    ```bash
    curl -X PUT "http://your-ip:8087/v1/states/cron_scenes.0.jobs.test.trigger" \
         -H "Authorization: Bearer YOUR_TOKEN" \
         -H "Content-Type: application/json" \
         -d '{"val":true}'
    ```

Diese Dokumentation bietet alles, was für die Integration in eine App benötigt wird. Bei Fragen zur Implementierung stehe ich gerne zur Verfügung!
