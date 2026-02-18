# Composer (PDF/Excel-Export)

Die PHP-Endpunkte für PDF- und Excel-Export benötigen Composer-Abhängigkeiten.

**Wo liegt was?**

- `composer.json` liegt im Ordner **public/** (Webroot bzw. das Verzeichnis, aus dem die Seite ausgeliefert wird).
- Nach dem Upload auf Hosttech: In dieses Verzeichnis wechseln (z. B. per FTP in `public` oder `httpdocs`) und ausführen:

```bash
composer install --no-dev
```

Dadurch wird der Ordner **public/vendor/** mit `mpdf/mpdf` und `phpoffice/phpspreadsheet` angelegt. Die Skripte unter `public/api/admin/` laden den Autoloader mit:

```php
require_once __DIR__ . '/../../vendor/autoload.php';
```

Falls dein Document Root nur ein Unterordner von `public` ist, muss `composer.json` in genau dem Verzeichnis liegen, in dem auch `vendor/` entstehen soll – und die Pfade in den PHP-Dateien ggf. anpassen.
