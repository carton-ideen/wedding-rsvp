<?php
/**
 * POST /api/rsvp – Rückmeldung speichern
 */

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$body = $raw !== '' ? json_decode($raw, true) : null;
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Ungültige Anfrage.']);
    exit;
}

const MAX_NAME_LENGTH = 200;
const MAX_CONTACT_LENGTH = 200;
const MAX_ALLERGIES_LENGTH = 500;

$errors = [];
$name = isset($body['name']) ? trim(mb_substr((string) $body['name'], 0, MAX_NAME_LENGTH)) : '';
if ($name === '') {
    $errors[] = 'Bitte gib einen Namen ein.';
}
$contact = isset($body['contact']) ? trim(mb_substr((string) $body['contact'], 0, MAX_CONTACT_LENGTH)) : '';
$attending = isset($body['attending']) ? strtolower(trim((string) $body['attending'])) : '';
if ($attending !== 'yes' && $attending !== 'no') {
    $errors[] = 'Bitte wähle, ob du kommst oder nicht.';
}

$allergiesHas = false;
$allergiesText = '';
$guestDetails = isset($body['guest_details']) && is_array($body['guest_details']) ? $body['guest_details'] : [];

if ($attending === 'yes') {
    if (count($guestDetails) > 0) {
        $total = count($guestDetails);
        if ($total < 1 || $total > 20) {
            $errors[] = 'Anzahl Gäste muss zwischen 1 und 20 liegen.';
        }
        $menuTypes = ['meat', 'vegi', 'kids'];
        foreach ($guestDetails as $g) {
            $gName = isset($g['name']) ? trim(mb_substr((string) $g['name'], 0, MAX_NAME_LENGTH)) : '';
            if ($gName === '') {
                $errors[] = 'Bitte für jeden Gast einen Namen eintragen.';
            }
            $mt = isset($g['menu_type']) ? strtolower(trim((string) $g['menu_type'])) : '';
            if (!in_array($mt, $menuTypes, true)) {
                $errors[] = 'Bitte für jeden Gast ein Menü (Fleisch / Vegetarisch / Kinder) wählen.';
            }
            $aHas = isset($g['allergies_has']) && ($g['allergies_has'] === true || $g['allergies_has'] === 'true' || $g['allergies_has'] === 1 || $g['allergies_has'] === '1');
            $aText = isset($g['allergies_text']) ? trim(mb_substr((string) $g['allergies_text'], 0, MAX_ALLERGIES_LENGTH)) : '';
            if ($aHas && mb_strlen($aText) < 2) {
                $errors[] = 'Bitte Allergien beschreiben (mind. 2 Zeichen), sofern angegeben.';
            }
        }
    } else {
        $total = isset($body['total_guests']) ? (int) $body['total_guests'] : 0;
        if ($total < 1 || $total > 20) {
            $errors[] = 'Anzahl Gäste muss zwischen 1 und 20 liegen.';
        }
        $guestNames = isset($body['guest_names']) && is_array($body['guest_names']) ? $body['guest_names'] : [];
        if ($total > 1) {
            $needed = $total - 1;
            if (count($guestNames) !== $needed) {
                $errors[] = 'Bitte Namen aller weiteren Gäste eintragen.';
            } else {
                foreach ($guestNames as $n) {
                    if (trim(mb_substr((string) $n, 0, MAX_NAME_LENGTH)) === '') {
                        $errors[] = 'Bitte Namen aller weiteren Gäste eintragen.';
                        break;
                    }
                }
            }
        }
        $meat = isset($body['menu_meat']) ? (int) $body['menu_meat'] : 0;
        $vegi = isset($body['menu_vegi']) ? (int) $body['menu_vegi'] : 0;
        $kids = isset($body['menu_kids']) ? (int) $body['menu_kids'] : 0;
        if ($meat < 0 || $vegi < 0 || $kids < 0) {
            $errors[] = 'Menüanzahlen dürfen nicht negativ sein.';
        }
        if ($total > 0 && ($meat + $vegi + $kids) !== $total) {
            $errors[] = 'Die Summe der Menüs (Fleisch + Vegetarisch + Kinder) muss der Anzahl Gäste entsprechen.';
        }
    }
}

if (count($guestDetails) === 0) {
    $allergiesHas = isset($body['allergies_has']) && ($body['allergies_has'] === true || $body['allergies_has'] === 'true' || $body['allergies_has'] === '1');
    $allergiesText = isset($body['allergies_text']) ? trim(mb_substr((string) $body['allergies_text'], 0, MAX_ALLERGIES_LENGTH)) : '';
    if ($allergiesHas && mb_strlen($allergiesText) < 2) {
        $errors[] = 'Bitte beschreibe die Allergien (mindestens 2 Zeichen).';
    }
}

if (count($errors) > 0) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => implode(' ', $errors)]);
    exit;
}

$total_guests = null;
$menu_meat = null;
$menu_vegi = null;
$menu_kids = null;
$guest_names_json = null;
$guest_details_json = null;
$saveName = $name;

if ($attending === 'yes') {
    $guestDetails = isset($body['guest_details']) && is_array($body['guest_details']) ? $body['guest_details'] : [];
    if (count($guestDetails) > 0) {
        $total_guests = count($guestDetails);
        $meat = $vegi = $kids = 0;
        $details = [];
        foreach ($guestDetails as $g) {
            $mt = isset($g['menu_type']) ? strtolower(trim((string) $g['menu_type'])) : 'meat';
            if ($mt === 'meat') $meat++;
            elseif ($mt === 'vegi') $vegi++;
            elseif ($mt === 'kids') $kids++;
            $details[] = [
                'name' => trim(mb_substr((string) ($g['name'] ?? ''), 0, MAX_NAME_LENGTH)),
                'menu_type' => in_array($mt, ['meat', 'vegi', 'kids'], true) ? $mt : 'meat',
                'allergies_has' => (isset($g['allergies_has']) && ($g['allergies_has'] === true || $g['allergies_has'] === 'true' || $g['allergies_has'] === 1 || $g['allergies_has'] === '1')) ? 1 : 0,
                'allergies_text' => trim(mb_substr((string) ($g['allergies_text'] ?? ''), 0, MAX_ALLERGIES_LENGTH)),
            ];
        }
        if (isset($details[0]['name']) && $details[0]['name'] !== '') {
            $saveName = $details[0]['name'];
        }
        $menu_meat = $meat;
        $menu_vegi = $vegi;
        $menu_kids = $kids;
        $guest_details_json = json_encode($details);
    } else {
        $total_guests = (int) ($body['total_guests'] ?? 0);
        $menu_meat = (int) ($body['menu_meat'] ?? 0);
        $menu_vegi = (int) ($body['menu_vegi'] ?? 0);
        $menu_kids = (int) ($body['menu_kids'] ?? 0);
        $guestNames = isset($body['guest_names']) && is_array($body['guest_names']) ? $body['guest_names'] : [];
        if (count($guestNames) > 0) {
            $names = array_map(function ($n) {
                return trim(mb_substr((string) $n, 0, MAX_NAME_LENGTH));
            }, array_slice($guestNames, 0, max(0, ($total_guests ?: 1) - 1)));
            $guest_names_json = json_encode($names);
        }
    }
}

try {
    require_once __DIR__ . '/db.php';
    $pdo = getPdo();
    $stmt = $pdo->prepare("
        INSERT INTO rsvps (name, contact, attending, total_guests, menu_meat, menu_vegi, menu_kids, allergies_has, allergies_text, guest_names, guest_details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $saveName,
        $contact !== '' ? $contact : null,
        $attending,
        $total_guests,
        $menu_meat,
        $menu_vegi,
        $menu_kids,
        $allergiesHas ? 1 : 0,
        $allergiesHas ? $allergiesText : null,
        $guest_names_json,
        $guest_details_json,
    ]);
    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Speichern fehlgeschlagen. Bitte später erneut versuchen.']);
}
