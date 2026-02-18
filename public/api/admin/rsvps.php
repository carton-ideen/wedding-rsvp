<?php
/**
 * GET /api/admin/rsvps?token=… – Liste aller RSVPs
 * DELETE /api/admin/rsvps?id=…&token=… – Eintrag löschen
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
        $stmt = $pdo->query('SELECT * FROM rsvps ORDER BY id DESC');
        $rows = $stmt->fetchAll(PDO::FETCH_OBJ);
        $rsvps = [];
        foreach ($rows as $r) {
            $out = (object) [
                'id' => (int) $r->id,
                'name' => $r->name,
                'contact' => $r->contact,
                'attending' => $r->attending,
                'total_guests' => $r->total_guests !== null ? (int) $r->total_guests : null,
                'menu_meat' => $r->menu_meat !== null ? (int) $r->menu_meat : null,
                'menu_vegi' => $r->menu_vegi !== null ? (int) $r->menu_vegi : null,
                'menu_kids' => $r->menu_kids !== null ? (int) $r->menu_kids : null,
                'allergies_has' => $r->allergies_has !== null ? (int) $r->allergies_has : 0,
                'allergies_text' => $r->allergies_text,
                'created_at' => $r->created_at,
                'guest_names' => null,
                'guest_details' => null,
            ];
            if ($r->guest_names !== null && $r->guest_names !== '') {
                $decoded = json_decode($r->guest_names, true);
                $out->guest_names = is_array($decoded) ? $decoded : null;
            }
            if ($r->guest_details !== null && $r->guest_details !== '') {
                $decoded = json_decode($r->guest_details, true);
                $out->guest_details = is_array($decoded) ? $decoded : null;
            }
            $rsvps[] = $out;
        }
        echo json_encode(['ok' => true, 'rsvps' => $rsvps]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Rückmeldungen konnten nicht geladen werden.']);
    }
    exit;
}

if ($method === 'DELETE') {
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id < 1) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'Ungültige ID.']);
        exit;
    }
    try {
        $pdo = getPdo();
        $stmt = $pdo->prepare('DELETE FROM rsvps WHERE id = ?');
        $stmt->execute([$id]);
        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Eintrag nicht gefunden.']);
            exit;
        }
        echo json_encode(['ok' => true]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Löschen fehlgeschlagen.']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
