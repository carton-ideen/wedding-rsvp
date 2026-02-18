<?php
/**
 * GET /api/admin/rsvps_pdf.php?token=… – PDF-Export
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../../vendor/autoload.php';

$token = isset($_GET['token']) ? (string) $_GET['token'] : '';
if ($token !== ADMIN_TOKEN) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Nicht autorisiert.']);
    exit;
}

function formatDatePdf($createdAt) {
    if (empty($createdAt)) return '';
    $m = [];
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', (string) $createdAt, $m)) {
        return $m[3] . '.' . $m[2] . '.' . $m[1];
    }
    return (string) $createdAt;
}

function getMergedAllergies($r) {
    $parts = [];
    $mainHas = !empty($r->allergies_has) && (int) $r->allergies_has === 1;
    $mainText = isset($r->allergies_text) && trim((string) $r->allergies_text) !== '' ? trim((string) $r->allergies_text) : '';
    if ($mainHas && $mainText !== '') {
        $parts[] = (isset($r->name) && $r->name !== '' ? $r->name : 'Hauptgast') . ': ' . $mainText;
    }
    $guestDetails = [];
    if (isset($r->guest_details) && trim((string) $r->guest_details) !== '') {
        $decoded = json_decode($r->guest_details, true);
        $guestDetails = is_array($decoded) ? $decoded : [];
    }
    foreach ($guestDetails as $g) {
        $gHas = !empty($g['allergies_has']) && (int) $g['allergies_has'] === 1;
        $gText = isset($g['allergies_text']) && trim((string) $g['allergies_text']) !== '' ? trim((string) $g['allergies_text']) : '';
        if ($gHas && $gText !== '') {
            $parts[] = (isset($g['name']) && $g['name'] !== '' ? $g['name'] : 'Gast') . ': ' . $gText;
        }
    }
    $text = implode('; ', $parts);
    return ['has' => count($parts) > 0, 'text' => $text];
}

try {
    $pdo = getPdo();
    $stmt = $pdo->query('SELECT * FROM rsvps ORDER BY id DESC');
    $rows = $stmt->fetchAll(PDO::FETCH_OBJ);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Daten konnten nicht geladen werden.']);
    exit;
}

$sumYes = 0;
$sumNo = 0;
$sumGuests = 0;
$sumMeat = 0;
$sumVegi = 0;
$sumKids = 0;
foreach ($rows as $r) {
    if ($r->attending === 'yes') {
        $sumYes++;
        $sumGuests += (int) ($r->total_guests ?? 0);
        $sumMeat += (int) ($r->menu_meat ?? 0);
        $sumVegi += (int) ($r->menu_vegi ?? 0);
        $sumKids += (int) ($r->menu_kids ?? 0);
    } else {
        $sumNo++;
    }
}

$gold = '#c79a58';
$gray = '#5a5a5a';
$lightBg = '#f7f5f1';

$html = '
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: Helvetica, Arial, sans-serif; font-size: 11px; color: #333; margin: 20px; }
h1 { color: ' . $gold . '; font-size: 22px; text-align: center; margin-bottom: 4px; }
h2 { color: ' . $gold . '; font-size: 18px; text-align: center; margin-bottom: 4px; }
.sub { color: ' . $gray . '; font-size: 11px; text-align: center; margin-bottom: 24px; }
.section { font-weight: bold; font-size: 12px; margin: 16px 0 8px 0; }
.box-wrap { margin-bottom: 20px; }
.box { display: inline-block; width: 120px; padding: 10px; margin: 4px; border-radius: 4px; border: 1px solid ' . $gold . '; background: ' . $lightBg . '; vertical-align: top; }
.box-label { font-size: 9px; color: ' . $gray . '; }
.box-value { font-size: 14px; font-weight: bold; color: ' . $gold . '; }
table { border-collapse: collapse; width: 100%; margin-top: 8px; font-size: 8px; }
th { background: ' . $gold . '; color: white; padding: 6px 4px; text-align: left; font-weight: bold; }
td { padding: 5px 4px; border-bottom: 1px solid #eee; }
tr:nth-child(even) { background: #fafafa; }
</style>
</head>
<body>
<h1>Rückmeldungen</h1>
<h2>Cristina & Raffaele</h2>
<p class="sub">Auswertung der Anmeldungen</p>

<p class="section">Zusammenfassung</p>
<div class="box-wrap">
  <div class="box"><div class="box-label">Zusagen</div><div class="box-value">' . (int) $sumYes . '</div></div>
  <div class="box"><div class="box-label">Absagen</div><div class="box-value">' . (int) $sumNo . '</div></div>
  <div class="box"><div class="box-label">Gesamtgäste</div><div class="box-value">' . (int) $sumGuests . '</div></div>
  <div class="box"><div class="box-label">Menü Fleisch</div><div class="box-value">' . (int) $sumMeat . '</div></div>
  <div class="box"><div class="box-label">Menü Vegetarisch</div><div class="box-value">' . (int) $sumVegi . '</div></div>
  <div class="box"><div class="box-label">Menü Kinder</div><div class="box-value">' . (int) $sumKids . '</div></div>
</div>

<p class="section">Details</p>
<table>
<thead>
<tr>
  <th>Datum</th><th>Name</th><th>Kontakt</th><th>Status</th><th>Gäste</th>
  <th>Fleisch</th><th>Vegi</th><th>Kinder</th><th>Allerg.</th><th>Allergietext</th>
</tr>
</thead>
<tbody>';

$dash = '–';
foreach ($rows as $r) {
    $isYes = $r->attending === 'yes';
    $merged = getMergedAllergies($r);
    $date = formatDatePdf($r->created_at ?? '');
    $name = mb_substr((string) ($r->name ?? ''), 0, 14);
    $contact = mb_substr((string) ($r->contact ?? ''), 0, 14);
    $status = $isYes ? 'Ja' : 'Nein';
    $guests = $isYes ? (string) ($r->total_guests !== null ? $r->total_guests : $dash) : $dash;
    $meat = $isYes ? (string) ($r->menu_meat !== null ? $r->menu_meat : $dash) : $dash;
    $vegi = $isYes ? (string) ($r->menu_vegi !== null ? $r->menu_vegi : $dash) : $dash;
    $kids = $isYes ? (string) ($r->menu_kids !== null ? $r->menu_kids : $dash) : $dash;
    $allerg = $merged['has'] ? 'ja' : 'nein';
    $allergText = mb_substr($merged['text'], 0, 22);
    $html .= '<tr>';
    $html .= '<td>' . htmlspecialchars($date, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '<td>' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '<td>' . htmlspecialchars($contact, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '<td>' . htmlspecialchars($status, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '<td>' . htmlspecialchars($guests, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '<td>' . htmlspecialchars($meat, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '<td>' . htmlspecialchars($vegi, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '<td>' . htmlspecialchars($kids, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '<td>' . htmlspecialchars($allerg, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '<td>' . htmlspecialchars($allergText, ENT_QUOTES, 'UTF-8') . '</td>';
    $html .= '</tr>';
}

$html .= '</tbody></table></body></html>';

try {
    $mpdf = new \Mpdf\Mpdf(['mode' => 'utf-8', 'format' => 'A4', 'margin_left' => 15, 'margin_right' => 15, 'margin_top' => 15, 'margin_bottom' => 15]);
    $mpdf->WriteHTML($html, \Mpdf\HTMLParserMode::HTML_BODY);
    $mpdf->Output('Rueckmeldungen_Cristina_Raffaele.pdf', \Mpdf\Output\Destination::DOWNLOAD);
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'PDF konnte nicht erstellt werden.']);
}
