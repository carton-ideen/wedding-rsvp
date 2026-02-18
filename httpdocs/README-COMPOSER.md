# Composer (PDF/Excel-Export)

Die PHP-Endpunkte für PDF- und Excel-Export benötigen Composer-Abhängigkeiten.

**Wo liegt was?**

- `composer.json` liegt im Ordner **httpdocs/** (wird auf dem Server 1:1 als Document Root / httpdocs verwendet).
- Nach dem Upload auf Hosttech: In **httpdocs** wechseln (z. B. per SSH/FTP) und ausführen:

```bash
composer install --no-dev
```

Dadurch wird **httpdocs/vendor/** mit `mpdf/mpdf` und `phpoffice/phpspreadsheet` angelegt. Die Skripte unter **httpdocs/api/admin/** laden den Autoloader mit:

```php
require_once __DIR__ . '/../../vendor/autoload.php';
```

Falls dein Document Root anders heißt, muss `composer.json` in genau dem Verzeichnis liegen, in dem auch `vendor/` entstehen soll – und die PHP-Pfade `__DIR__ . '/../../vendor/autoload.php'` ggf. anpassen.
