# Wedding RSVP

Elegante RSVP-Webseite für Hochzeits-Einladungen mit Admin-Bereich, Tischplan und Export (PDF/Excel).

## Voraussetzungen

- Node.js >= 18
- MariaDB oder MySQL (z. B. bei Hosttech)

## Installation

```bash
npm install
```

## Konfiguration

Kopiere `.env.example` nach `.env` und trage ein:

- **PORT** – Server-Port (Standard: 3000)
- **DB_HOST**, **DB_PORT** (Standard: 3306), **DB_USER**, **DB_PASS**, **DB_NAME** – Datenbankverbindung
- **ADMIN_TOKEN** – Token für Admin-API (z. B. in URL: `?token=...`)
- **ADMIN_PASSWORD** – Passwort für den Admin-Login

## MySQL/MariaDB Setup

1. Datenbank anlegen (z. B. in phpMyAdmin oder per Konsole):
   ```sql
   CREATE DATABASE wedding_rsvp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Benutzer mit Rechten auf diese DB anlegen und in `.env` eintragen.

3. Beim ersten Start erstellt der Server automatisch die Tabellen `rsvps` und `tischplan`, falls sie noch nicht existieren.

## Start

```bash
npm start
```

Entwicklungsmodus mit Auto-Reload:

```bash
npm run dev
```

Die App läuft unter `http://localhost:3000` (oder dem konfigurierten PORT).

## API (kurz)

- **POST /api/rsvp** – Rückmeldung absenden
- **GET /api/admin/rsvps** – Liste der Rückmeldungen (Query: `?token=ADMIN_TOKEN`)
- **GET /health** – Health-Check (200, `{ "ok": true }`)
