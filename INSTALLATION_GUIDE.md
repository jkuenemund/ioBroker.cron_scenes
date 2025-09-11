# ioBroker.cron_scenes - Installation und Test auf realer Umgebung

## 🚀 Schnellstart-Anleitung

### 1. Adapter vorbereiten

#### Für Git-Installation (empfohlen):

```bash
cd /Users/Jens.Kuenemund/workspace/Spielwiese/Hausautomatisierung/ioBroker.cron_scenes

# Build erstellen
npm run build

# Änderungen zu Git pushen
git add -A
git commit -m "feat: Ready for production testing"
git push origin main
```

#### Für lokale Installation (.tgz):

```bash
# Build erstellen
npm run build

# Package erstellen
npm pack
```

Dies erstellt eine `.tgz` Datei (z.B. `iobroker.cron_scenes-0.0.1.tgz`).

### 2. Adapter auf ioBroker-System installieren

#### Option A: Direkt über Git-URL (empfohlen! 🚀)

```bash
# Auf dem ioBroker-System
cd /opt/iobroker

# Methode 1: Tarball (funktioniert immer!)
sudo -u iobroker npm install https://github.com/DEIN_USERNAME/ioBroker.cron_scenes/archive/refs/heads/main.tar.gz

# Methode 2: Git (falls SSH-Probleme auftreten)
sudo -u iobroker npm install git+https://github.com/DEIN_USERNAME/ioBroker.cron_scenes.git
```

#### Option B: Über Admin-Interface mit Git-URL

1. ioBroker Admin öffnen
2. **Adapter** → **Aus GitHub installieren**
3. Git-URL eingeben: `https://github.com/DEIN_USERNAME/ioBroker.cron_scenes.git`
4. **Installieren** klicken

#### Option C: Lokale Installation (.tgz)

```bash
# Erst Package erstellen
npm pack
# Dann auf dem ioBroker-System
cd /opt/iobroker
sudo -u iobroker npm install /pfad/zur/iobroker.cron_scenes-0.0.1.tgz
```

#### Option D: Über Admin-Interface (.tgz Upload)

1. ioBroker Admin öffnen
2. Adapter → "Aus eigener Datei installieren"
3. Die `.tgz` Datei hochladen

### 3. Adapter-Instanz erstellen

#### Via Admin-Interface:

1. **Adapter** → **cron_scenes** → **➕ Instanz hinzufügen**
2. **Instanz-Konfiguration öffnen**

#### Via CLI:

```bash
iobroker add cron_scenes
```

### 4. Adapter konfigurieren

#### In der Admin-Oberfläche unter "Instanzen":

```
┌─────────────────────────────────────────────────┐
│ cron_scenes.0 Konfiguration                     │
├─────────────────────────────────────────────────┤
│ Cron Folder: cron_scenes.0.jobs                │
│ Enable Logging: ✓                              │
│ Default Jobs Active: ✓                         │
│ Max Concurrent Jobs: 20                         │
│ Job Timeout (s): 30                            │
│ VM Memory Limit (MB): 16                       │
└─────────────────────────────────────────────────┘
```

**Empfohlene Test-Einstellungen:**

- **Enable Logging**: `true` (für Debugging)
- **Default Jobs Active**: `true` (Beispiel-Job wird aktiv)
- **VM Memory Limit**: `16` MB (für komplexere Expressions)

### 5. Adapter starten und testen

#### Adapter starten:

```bash
iobroker start cron_scenes.0
```

#### Status prüfen:

```bash
iobroker status cron_scenes.0
```

#### Logs überwachen:

```bash
# Live-Logs
iobroker logs --watch cron_scenes.0

# Oder im Admin-Interface unter "Log"
```

### 6. Test-Szenarien

#### 6.1 Basis-Funktionalität testen

**Prüfe ob der Jobs-Ordner erstellt wurde:**

- In Admin → **Objekte** → `cron_scenes.0.jobs`
- Sollte einen `example` Job enthalten

**Beispiel-Job prüfen:**

```json
{
	"cron": "*/5 * * * *",
	"targets": [
		{
			"id": "cron_scenes.0.testVariable",
			"type": "value",
			"value": true,
			"description": "Direct boolean value"
		},
		{
			"id": "cron_scenes.0.testVariable2",
			"type": "state",
			"value": "cron_scenes.0.testVariable",
			"description": "Copy value from another state"
		},
		{
			"id": "cron_scenes.0.testVariable3",
			"type": "expression",
			"value": "state('cron_scenes.0.testVariable') ? Math.round(Math.random() * 100) : 0",
			"description": "Random number if testVariable is true, otherwise 0"
		}
	],
	"active": true,
	"type": "recurring"
}
```

#### 6.2 Manuellen Trigger testen

**Trigger-State erstellen und aktivieren:**

1. In **Objekte** zu `cron_scenes.0.jobs.example.trigger` navigieren
2. Wert auf `true` setzen
3. **Logs prüfen** - sollte Job-Ausführung zeigen

#### 6.3 Expression-Engine testen

**Eigenen Test-Job erstellen:**

```json
{
	"cron": "0 * * * *",
	"targets": [
		{
			"id": "cron_scenes.0.testVariable3",
			"type": "expression",
			"value": "Math.floor(Date.now() / 1000) % 2 === 0 ? 'even' : 'odd'",
			"description": "Even/odd based on current timestamp"
		}
	],
	"active": true,
	"type": "recurring"
}
```

### 7. Troubleshooting

#### Häufige Probleme:

**Git-Installation schlägt fehl (SSH-Fehler):**

```bash
# Problem: Permission denied (publickey)
# Lösung 1: SSH-Key auf ioBroker-System einrichten (siehe unten)

# Lösung 2: Direkt als Tarball installieren
sudo -u iobroker npm install https://github.com/jkuenemund/ioBroker.cron_scenes/archive/refs/heads/main.tar.gz

# Lösung 3: Repository öffentlich machen (GitHub Settings)
```

**SSH-Key auf ioBroker-System einrichten:**

```bash
# 1. SSH-Key für iobroker User erstellen (im richtigen Home-Verzeichnis!)
sudo -u iobroker mkdir -p /home/iobroker/.ssh
sudo -u iobroker ssh-keygen -t ed25519 -C "iobroker@your-system" -f /home/iobroker/.ssh/id_ed25519 -N ""

# 2. Öffentlichen Key anzeigen (für GitHub)
sudo -u iobroker cat /home/iobroker/.ssh/id_ed25519.pub

# 3. SSH-Config erstellen
sudo -u iobroker tee /home/iobroker/.ssh/config << 'EOF'
Host github.com
    HostName github.com
    User git
    IdentityFile /home/iobroker/.ssh/id_ed25519
    IdentitiesOnly yes
    StrictHostKeyChecking no
EOF

# 4. Berechtigungen setzen
sudo -u iobroker chmod 700 /home/iobroker/.ssh
sudo -u iobroker chmod 600 /home/iobroker/.ssh/id_ed25519
sudo -u iobroker chmod 644 /home/iobroker/.ssh/id_ed25519.pub
sudo -u iobroker chmod 600 /home/iobroker/.ssh/config

# 5. GitHub Host Key hinzufügen
sudo -u iobroker ssh-keyscan -H github.com >> /home/iobroker/.ssh/known_hosts

# 6. SSH-Verbindung testen
sudo -u iobroker ssh -T git@github.com
```

**GitHub SSH-Key hinzufügen:**

1. Öffentlichen Key kopieren (aus Schritt 2 oben)
2. GitHub → Settings → SSH and GPG keys → New SSH key
3. Key einfügen und speichern
4. SSH-Verbindung testen (Schritt 5 oben)

**Repository nicht gefunden:**

```bash
# Prüfen ob Repository öffentlich ist
curl -I https://github.com/jkuenemund/ioBroker.cron_scenes
# Sollte 200 OK zurückgeben, nicht 404
```

**Adapter startet nicht:**

```bash
# Dependencies prüfen
iobroker fix

# Neuinstallation
iobroker del cron_scenes.0
iobroker add cron_scenes
```

**Jobs werden nicht ausgeführt:**

- Prüfe `active: true` in Job-Konfiguration
- Prüfe Cron-Syntax mit https://crontab.guru
- Prüfe Logs auf Fehler

**Expression-Fehler:**

- VM Memory-Limit erhöhen (Admin-Interface)
- Expression-Syntax prüfen
- State-Referenzen validieren

#### Debug-Modus aktivieren:

```bash
# Temporär für Session
iobroker set cron_scenes.0 --debug

# Permanent in Admin-Interface: "Log level" → "debug"
```

### 8. Monitoring und Überwachung

#### Status-States überwachen:

- `cron_scenes.0.jobs.*.status` - Job-Status
- `cron_scenes.0.jobs.*.trigger` - Manuelle Trigger

#### Performance-Metriken:

```bash
# Memory-Usage
ps aux | grep cron_scenes

# Log-Analyse
grep "CronJobManager" /opt/iobroker/log/iobroker.*.log
```

### 9. Production-Ready Checklist

- [ ] **Logging** auf `info` oder `warn` reduzieren
- [ ] **VM Memory-Limit** angemessen setzen (8-32MB meist ausreichend)
- [ ] **Job-Timeout** für komplexe Szenarien anpassen
- [ ] **Max Concurrent Jobs** basierend auf System-Performance
- [ ] **Backup** der Job-Konfigurationen erstellen
- [ ] **Monitoring** der Adapter-Performance einrichten

### 10. Erweiterte Features testen

#### State-Referenzen:

```json
{
	"type": "expression",
	"value": "state('system.adapter.admin.0.alive') ? 'Admin läuft' : 'Admin offline'"
}
```

#### Toggle-Funktionen:

```json
{
	"type": "expression",
	"value": "!state('hm-rpc.0.light.STATE')"
}
```

#### Zeit-basierte Logik:

```json
{
	"type": "expression",
	"value": "new Date().getHours() > 18 ? 'Abend' : 'Tag'"
}
```

---

## 🆘 Support

Bei Problemen:

1. **Logs prüfen**: `iobroker logs cron_scenes.0`
2. **Debug aktivieren**: Admin → Instanzen → cron_scenes.0 → Konfiguration
3. **GitHub Issues**: Detaillierte Fehlerbeschreibung mit Logs

## 📦 Updates über Git (Bonus!)

### Adapter aktualisieren:

```bash
# Auf dem ioBroker-System
cd /opt/iobroker
sudo -u iobroker npm update iobroker.cron_scenes

# Oder komplett neu installieren
sudo -u iobroker npm uninstall iobroker.cron_scenes
sudo -u iobroker npm install https://github.com/DEIN_USERNAME/ioBroker.cron_scenes.git
```

### Über Admin-Interface:

1. **Adapter** → **cron_scenes** → **🔄 Update verfügbar**
2. **Aktualisieren** klicken

**Viel Erfolg beim Testen! 🚀**
