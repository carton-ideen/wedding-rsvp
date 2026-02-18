# Deployment (Hosttech / httpdocs)

Das Projekt ist so aufgebaut, dass der Ordner **httpdocs** 1:1 als Document Root auf dem Server verwendet wird. Es gibt keinen „public“-Ordner mehr.

## 1. Dateistruktur (nach Upload)

Alles, was auf den Server gehört, liegt unter **httpdocs/**:

```
httpdocs/
├── index.html          # Startseite / RSVP-Formular
├── admin.html          # Admin-Dashboard
├── app.js              # Frontend RSVP
├── admin.js            # Frontend Admin
├── styles.css
├── admin.css
├── .htaccess           # optional, für saubere URLs
├── health.php          # optional, GET /health
├── composer.json       # für PDF/Excel-Export
├── README-COMPOSER.md
├── assets/
│   ├── hero.png        # ⚠️ selbst ablegen (Hochzeitsbild)
│   └── Hintergrund2.png # ⚠️ selbst ablegen (Hintergrund, siehe styles.css)
└── api/
    ├── config.php      # ⚠️ DB und ADMIN_* anpassen
    ├── db.php
    ├── rsvp.php
    └── admin/
        ├── login.php
        ├── rsvps.php
        ├── tischplan.php
        ├── rsvps_pdf.php
        └── rsvps_xlsx.php
```

Nach `composer install --no-dev` in **httpdocs** kommt hinzu:

```
httpdocs/vendor/        # mpdf, phpoffice/phpspreadsheet, autoload
```

## 2. Upload auf den Server

- Inhalt von **httpdocs/** in den **httpdocs**-Ordner (Document Root) auf Hosttech kopieren.
- Nicht mitkopieren: `node_modules`, `package.json`, `server.js` usw. – die liegen außerhalb von httpdocs und sind nur für lokale Node-Entwicklung.

## 3. Pfade und Links (alle relativ zu httpdocs)

- **HTML/JS:**  
  - `index.html` → `styles.css`, `app.js`, `assets/hero.png`  
  - `admin.html` → `styles.css`, `admin.css`, `admin.js`, `index.html`  
  - `styles.css` → `assets/Hintergrund2.png`  
  - API-Aufrufe: `/api/rsvp.php`, `/api/admin/login.php`, `/api/admin/rsvps.php`, `/api/admin/tischplan.php`, `/api/admin/rsvps_pdf.php`, `/api/admin/rsvps_xlsx.php`

- **PHP:**  
  - `api/config.php` – keine Includes  
  - `api/db.php` – `config.php` (gleicher Ordner)  
  - `api/rsvp.php` – `db.php` (gleicher Ordner)  
  - `api/admin/*.php` – `../config.php`, `../db.php`  
  - `api/admin/rsvps_pdf.php` und `rsvps_xlsx.php` – zusätzlich `../../vendor/autoload.php`

Alle diese Pfade funktionieren, wenn das Projekt so unter httpdocs liegt.

## 4. Konfiguration

1. **api/config.php**  
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` für die MySQL-Datenbank eintragen.  
   - `ADMIN_PASSWORD` und `ADMIN_TOKEN` setzen.

2. **Bilder**  
   - In **httpdocs/assets/** ablegen:  
     - `hero.png` (Startseiten-Bild)  
     - `Hintergrund2.png` (Hintergrund, siehe styles.css)

3. **Composer (PDF/Excel)**  
   - Auf dem Server in **httpdocs** ausführen:  
     `composer install --no-dev`  
   - Legt `httpdocs/vendor/` an; die Export-Skripte laden den Autoloader automatisch.

## 5. Kurz-Checkliste

- [ ] Inhalt von **httpdocs** in den Server-**httpdocs** kopiert  
- [ ] **api/config.php** mit DB-Daten und ADMIN_* angepasst  
- [ ] **assets/hero.png** und **assets/Hintergrund2.png** vorhanden  
- [ ] In **httpdocs**: `composer install --no-dev` ausgeführt (wenn PDF/Excel genutzt werden)  
- [ ] Datenbank angelegt; Tabellen werden beim ersten API-Aufruf automatisch erzeugt
