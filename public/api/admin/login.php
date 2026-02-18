<?php
/**
 * POST /api/admin/login – Admin-Login, gibt Token zurück
 */

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

require_once __DIR__ . '/../config.php';

$raw = file_get_contents('php://input');
$body = $raw !== '' ? json_decode($raw, true) : null;
$password = (is_array($body) && isset($body['password'])) ? trim((string) $body['password']) : '';

if ($password !== ADMIN_PASSWORD) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Falsches Passwort.']);
    exit;
}

echo json_encode(['ok' => true, 'token' => ADMIN_TOKEN]);
