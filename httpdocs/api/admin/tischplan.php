<?php
/**
 * GET /api/admin/tischplan?token=… – Tischplan laden
 * PUT /api/admin/tischplan?token=… – Tischplan speichern
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';

$token = isset($_GET['token']) ? (string) $_GET['token'] : '';
if ($token !== ADMIN_TOKEN) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Nicht autorisiert.']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    try {
        $pdo = getPdo();
        $stmt = $pdo->prepare('SELECT data FROM tischplan WHERE id = 1');
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_OBJ);
        $data = ['tables' => [], 'assignments' => (object) []];
        if ($row && $row->data !== null && $row->data !== '') {
            $decoded = json_decode($row->data, true);
            if (is_array($decoded)) {
                $data['tables'] = isset($decoded['tables']) && is_array($decoded['tables']) ? $decoded['tables'] : [];
                $data['assignments'] = isset($decoded['assignments']) && is_array($decoded['assignments']) ? $decoded['assignments'] : (object) [];
            }
        }
        echo json_encode(['ok' => true, 'plan' => $data]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Tischplan konnte nicht geladen werden.']);
    }
    exit;
}

if ($method === 'PUT') {
    $raw = file_get_contents('php://input');
    $body = $raw !== '' ? json_decode($raw, true) : null;
    if (!is_array($body)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Ungültige Anfrage.']);
        exit;
    }
    $tables = isset($body['tables']) && is_array($body['tables']) ? $body['tables'] : [];
    $assignments = isset($body['assignments']) && is_array($body['assignments']) ? $body['assignments'] : [];
    $tablesClean = [];
    foreach ($tables as $t) {
        $id = isset($t['id']) ? mb_substr((string) $t['id'], 0, 50) : '';
        if ($id === '') continue;
        $tablesClean[] = [
            'id' => $id,
            'name' => isset($t['name']) ? mb_substr((string) $t['name'], 0, 100) : 'Tisch',
            'capacity' => max(1, min(99, (int) ($t['capacity'] ?? 1))),
            'x' => max(0, min(100, (float) ($t['x'] ?? 0))),
            'y' => max(0, min(100, (float) ($t['y'] ?? 0))),
            'shape' => (isset($t['shape']) && strtolower((string) $t['shape']) === 'round') ? 'round' : 'rect',
            'rotation' => max(0, min(360, (float) ($t['rotation'] ?? 0))),
        ];
    }
    $assignmentsClean = [];
    foreach ($assignments as $key => $tableId) {
        $k = (string) $key;
        $tid = (string) $tableId;
        if ($k !== '' && $tid !== '') {
            $assignmentsClean[$k] = $tid;
        }
    }
    try {
        $pdo = getPdo();
        $json = json_encode(['tables' => $tablesClean, 'assignments' => $assignmentsClean]);
        $stmt = $pdo->prepare('UPDATE tischplan SET data = ? WHERE id = 1');
        $stmt->execute([$json]);
        echo json_encode(['ok' => true]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Tischplan konnte nicht gespeichert werden.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
