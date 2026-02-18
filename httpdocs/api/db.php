<?php
/**
 * PDO-Verbindung + Schema-Init (lazy)
 */

require_once __DIR__ . '/config.php';

function getPdo(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_OBJ,
    ]);
    initSchema($pdo);
    return $pdo;
}

function initSchema(PDO $pdo): void {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS rsvps (
            id INT AUTO_INCREMENT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            name VARCHAR(255) NOT NULL,
            contact VARCHAR(255) NULL,
            attending VARCHAR(20) NOT NULL,
            total_guests INT NULL,
            menu_meat INT NULL,
            menu_vegi INT NULL,
            menu_kids INT NULL,
            allergies_has TINYINT NULL,
            allergies_text TEXT NULL,
            guest_names TEXT NULL,
            guest_details TEXT NULL
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS tischplan (
            id INT PRIMARY KEY,
            data TEXT NOT NULL
        )
    ");
    $stmt = $pdo->query("SELECT 1 FROM tischplan WHERE id = 1");
    if ($stmt->fetch() === false) {
        $pdo->exec("INSERT INTO tischplan (id, data) VALUES (1, '{\"tables\":[],\"assignments\":{}}')");
    }
}
