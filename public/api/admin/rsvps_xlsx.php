<?php
/**
 * GET /api/admin/rsvps_xlsx.php?token=… – Excel-Export
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

function formatDateExcel($createdAt) {
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
    return ['has' => count($parts) > 0, 'text' => implode('; ', $parts)];
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

$gold = 'FFC79A58';
$goldFill = ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['argb' => $gold]];
$lightBg = ['fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFF7F5F1']];
$goldBorder = [
    'borders' => [
        'allBorders' => ['borderStyle' => \PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN, 'color' => ['argb' => $gold]],
    ],
];

$spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('Auswertung');

$sheet->getColumnDimension('A')->setWidth(14);
$sheet->getColumnDimension('B')->setWidth(18);
$sheet->getColumnDimension('C')->setWidth(18);
$sheet->getColumnDimension('D')->setWidth(8);
$sheet->getColumnDimension('E')->setWidth(8);
$sheet->getColumnDimension('F')->setWidth(8);
$sheet->getColumnDimension('G')->setWidth(10);
$sheet->getColumnDimension('H')->setWidth(8);
$sheet->getColumnDimension('I')->setWidth(8);
$sheet->getColumnDimension('J')->setWidth(24);

$sheet->mergeCells('A1:J1');
$sheet->setCellValue('A1', 'Rückmeldungen');
$sheet->getStyle('A1')->getFont()->setBold(true)->setSize(18)->getColor()->setARGB($gold);
$sheet->getStyle('A1')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

$sheet->mergeCells('A2:J2');
$sheet->setCellValue('A2', 'Cristina & Raffaele');
$sheet->getStyle('A2')->getFont()->setSize(14)->getColor()->setARGB($gold);
$sheet->getStyle('A2')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

$sheet->mergeCells('A3:J3');
$sheet->setCellValue('A3', 'Auswertung der Anmeldungen');
$sheet->getStyle('A3')->getFont()->setSize(11)->getColor()->setARGB('FF5A5A5A');
$sheet->getStyle('A3')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

$sheet->setCellValue('A5', 'Zusammenfassung');
$sheet->getStyle('A5')->getFont()->setBold(true)->setSize(12);

$summaryLabels1 = ['Zusagen', 'Absagen', 'Gesamtgäste'];
$summaryVals1 = [$sumYes, $sumNo, $sumGuests];
for ($c = 0; $c < 3; $c++) {
    $col = chr(65 + $c);
    $sheet->setCellValue($col . '6', $summaryLabels1[$c]);
    $sheet->setCellValue($col . '7', $summaryVals1[$c]);
    $sheet->getStyle($col . '6')->applyFromArray(['fill' => $lightBg, 'borders' => $goldBorder['borders']]);
    $sheet->getStyle($col . '7')->applyFromArray(['fill' => $lightBg, 'borders' => $goldBorder['borders'], 'font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => $gold]]]);
}
$summaryLabels2 = ['Menü Fleisch', 'Menü Vegetarisch', 'Menü Kinder'];
$summaryVals2 = [$sumMeat, $sumVegi, $sumKids];
for ($c = 0; $c < 3; $c++) {
    $col = chr(65 + $c);
    $sheet->setCellValue($col . '8', $summaryLabels2[$c]);
    $sheet->setCellValue($col . '9', $summaryVals2[$c]);
    $sheet->getStyle($col . '8')->applyFromArray(['fill' => $lightBg, 'borders' => $goldBorder['borders']]);
    $sheet->getStyle($col . '9')->applyFromArray(['fill' => $lightBg, 'borders' => $goldBorder['borders'], 'font' => ['bold' => true, 'size' => 12, 'color' => ['argb' => $gold]]]);
}

$sheet->setCellValue('A11', 'Details');
$sheet->getStyle('A11')->getFont()->setBold(true)->setSize(12);

$detailHeaders = ['Datum', 'Name', 'Kontakt', 'Status', 'Gäste', 'Fleisch', 'Vegetarisch', 'Kinder', 'Allergien', 'Allergietext'];
for ($c = 0; $c < 10; $c++) {
    $sheet->setCellValueByColumnAndRow($c + 1, 12, $detailHeaders[$c]);
}
$sheet->getStyle('A12:J12')->applyFromArray(['fill' => $goldFill, 'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF']]]);

$rowNum = 13;
foreach ($rows as $r) {
    $merged = getMergedAllergies($r);
    $sheet->setCellValueByColumnAndRow(1, $rowNum, formatDateExcel($r->created_at ?? ''));
    $sheet->setCellValueByColumnAndRow(2, $rowNum, $r->name ?? '');
    $sheet->setCellValueByColumnAndRow(3, $rowNum, $r->contact ?? '');
    $sheet->setCellValueByColumnAndRow(4, $rowNum, $r->attending === 'yes' ? 'Ja' : 'Nein');
    $sheet->setCellValueByColumnAndRow(5, $rowNum, $r->total_guests !== null ? (int) $r->total_guests : '');
    $sheet->setCellValueByColumnAndRow(6, $rowNum, $r->menu_meat !== null ? (int) $r->menu_meat : '');
    $sheet->setCellValueByColumnAndRow(7, $rowNum, $r->menu_vegi !== null ? (int) $r->menu_vegi : '');
    $sheet->setCellValueByColumnAndRow(8, $rowNum, $r->menu_kids !== null ? (int) $r->menu_kids : '');
    $sheet->setCellValueByColumnAndRow(9, $rowNum, $merged['has'] ? 'ja' : 'nein');
    $sheet->setCellValueByColumnAndRow(10, $rowNum, $merged['text'] ?? '');
    $rowNum++;
}

try {
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="Rückmeldungen_Cristina_Raffaele.xlsx"');
    header('Cache-Control: max-age=0');
    $writer = \PhpOffice\PhpSpreadsheet\IOFactory::createWriter($spreadsheet, 'Xlsx');
    $writer->save('php://output');
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Excel konnte nicht erstellt werden.']);
}
