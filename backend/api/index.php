<?php
declare(strict_types=1);

$cfg = require __DIR__ . '/config.php';
date_default_timezone_set($cfg['zona']);

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
    'secure'   => !empty($_SERVER['HTTPS']),
]);
session_start();
header('Content-Type: application/json; charset=utf-8');

const ESTADOS = ['PROGRAMADA', 'ATENDIDA', 'CANCELADA', 'NO_ASISTIO'];

function out($data, int $code = 200): never {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(string $msg, int $code = 400): never { out(['error' => $msg], $code); }

function db(): PDO {
    static $pdo = null;
    global $cfg;
    if ($pdo === null) {
        $d = $cfg['db'];
        $pdo = new PDO(
            "mysql:host={$d['host']};dbname={$d['name']};charset=utf8mb4",
            $d['user'], $d['pass'],
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
    }
    return $pdo;
}

function fechaValida(string $f): bool {
    $d = DateTime::createFromFormat('Y-m-d', $f);
    return $d && $d->format('Y-m-d') === $f;
}
function horaValida(string $h): bool {
    $d = DateTime::createFromFormat('H:i', $h);
    return $d && $d->format('H:i') === $h;
}

$r = $_GET['r'] ?? '';
$m = $_SERVER['REQUEST_METHOD'];
$in = $_POST ?: (json_decode(file_get_contents('php://input') ?: '', true) ?: []);

try {
    // ---------- RUTAS PÚBLICAS ----------
    if ($r === 'config') {
        out(['nombreSistema' => $cfg['nombreSistema'], 'nombreCorto' => $cfg['nombreCorto'], 'colores' => $cfg['colores'], 'clinica' => $cfg['clinica']]);
    }
    if ($r === 'sesion') {
        out(['autenticado' => !empty($_SESSION['usuario'])]);
    }
    if ($r === 'login' && $m === 'POST') {
        $ok = hash_equals($cfg['admin']['usuario'], (string)($in['usuario'] ?? ''))
           && password_verify((string)($in['clave'] ?? ''), $cfg['admin']['hash']);
        if (!$ok) { sleep(1); fail('Usuario o contraseña incorrectos.', 401); }
        session_regenerate_id(true);
        $_SESSION['usuario'] = $cfg['admin']['usuario'];
        out(['ok' => true]);
    }
    if ($r === 'logout') {
        session_destroy();
        out(['ok' => true]);
    }

    // ---------- TODO LO DEMÁS REQUIERE SESIÓN ----------
    if (empty($_SESSION['usuario'])) fail('Debes iniciar sesión.', 401);

    switch ($r) {
        // CRUD de administración para el entregable 03-A. Los nombres de
        // tabla/columna son constantes internas y todas las entradas usan binds.
        case 'crud':
            $entidad = (string)($_GET['entidad'] ?? $in['entidad'] ?? '');
            $accion = (string)($in['accion'] ?? '');
            $id = (int)($in['id'] ?? 0);
            $catalogo = [
                'pacientes' => ['table'=>'pacientes','fields'=>['nombre','especie','propietario','telefono','notas','activo'],'search'=>['nombre','especie','propietario','telefono'],'order'=>'nombre'],
                'citas' => ['table'=>'citas','fields'=>['paciente_id','fecha','hora','motivo','estado','observaciones','domicilio','direccion_domicilio'],'search'=>['motivo','estado'],'order'=>'fecha DESC, hora DESC'],
                'registros' => ['table'=>'registros_clinicos','fields'=>['paciente_id','fecha','tipo','descripcion','peso'],'search'=>['tipo','descripcion'],'order'=>'fecha DESC, id DESC'],
                'especies' => ['table'=>'especies','fields'=>['nombre'],'search'=>['nombre'],'order'=>'nombre'],
            ];
            if (!isset($catalogo[$entidad])) fail('Entidad no válida.');
            $def = $catalogo[$entidad]; $pdo = db();
            if ($m === 'GET') {
                $q = trim((string)($_GET['q'] ?? ''));
                $where = ''; $params = [];
                if ($entidad === 'pacientes' && ($_GET['incluirInactivos'] ?? '') !== '1') $where = ' WHERE activo = 1';
                if ($q !== '') {
                    $parts = [];
                    foreach ($def['search'] as $col) { $parts[] = "$col LIKE ?"; $params[] = "%$q%"; }
                    $where .= ($where === '' ? ' WHERE ' : ' AND ') . '(' . implode(' OR ', $parts) . ')';
                }
                if ($entidad === 'citas') {
                    $sql = 'SELECT c.id,c.paciente_id,p.nombre AS paciente,c.fecha,TIME_FORMAT(c.hora,"%H:%i") hora,c.motivo,c.estado,c.observaciones,c.domicilio,c.direccion_domicilio FROM citas c JOIN pacientes p ON p.id=c.paciente_id' . ($where ? str_replace(['paciente_id','motivo','estado'],['c.paciente_id','c.motivo','c.estado'],$where) : '') . ' ORDER BY c.fecha DESC,c.hora DESC';
                } elseif ($entidad === 'registros') {
                    $sql = 'SELECT r.id,r.paciente_id,p.nombre AS paciente,r.fecha,r.tipo,r.descripcion,r.peso FROM registros_clinicos r JOIN pacientes p ON p.id=r.paciente_id' . ($where ? str_replace(['tipo','descripcion'],['r.tipo','r.descripcion'],$where) : '') . ' ORDER BY r.fecha DESC,r.id DESC';
                } else $sql = 'SELECT id,' . implode(',', $def['fields']) . ' FROM ' . $def['table'] . $where . ' ORDER BY ' . $def['order'];
                $s = $pdo->prepare($sql); $s->execute($params); out($s->fetchAll());
            }
            if ($m !== 'POST') fail('Método no permitido.', 405);
            if (!in_array($accion, ['crear','actualizar','eliminar'], true)) fail('Acción no válida.');
            if ($accion === 'eliminar') {
                if (!$id) fail('Falta indicar el registro.');
                if ($entidad === 'pacientes') {
                    $pdo->beginTransaction();
                    $pdo->prepare("UPDATE citas SET estado='CANCELADA' WHERE paciente_id=? AND estado='PROGRAMADA'")->execute([$id]);
                    $s=$pdo->prepare('UPDATE pacientes SET activo=0 WHERE id=?'); $s->execute([$id]);
                    $pdo->commit(); out(['ok'=>true,'mensaje'=>'Paciente dado de baja; historial conservado.']);
                }
                if ($entidad === 'especies') {
                    $nombre=(string)($in['nombre'] ?? '');
                    $s=$pdo->prepare('SELECT COUNT(*) FROM pacientes WHERE especie=?'); $s->execute([$nombre]);
                    if ((int)$s->fetchColumn()) fail('No se puede eliminar: hay pacientes que usan esta especie.');
                }
                $s=$pdo->prepare('DELETE FROM ' . $def['table'] . ' WHERE id=?'); $s->execute([$id]);
                if (!$s->rowCount()) fail('Registro no encontrado.',404);
                out(['ok'=>true,'mensaje'=>'Registro eliminado.']);
            }
            if ($accion === 'actualizar' && !$id) fail('Falta indicar el registro.');
            $v=[];
            foreach ($def['fields'] as $field) $v[$field] = $in[$field] ?? null;
            foreach (['nombre','especie','propietario','telefono','motivo','observaciones','direccion_domicilio','descripcion','peso'] as $campo) if (isset($v[$campo]) && is_string($v[$campo])) $v[$campo]=trim($v[$campo]);
            if ($entidad==='pacientes' && mb_strlen((string)$v['nombre'])<2) fail('El nombre requiere al menos 2 caracteres.');
            if ($entidad==='especies' && ($v['nombre']==='' || mb_strlen((string)$v['nombre'])>60)) fail('Indica una especie de hasta 60 caracteres.');
            if ($entidad==='especies') {
                $sql='SELECT COUNT(*) FROM especies WHERE nombre=?' . ($accion==='actualizar' ? ' AND id<>?' : '');
                $args=[$v['nombre']]; if ($accion==='actualizar') $args[]=$id;
                $s=$pdo->prepare($sql); $s->execute($args); if ((int)$s->fetchColumn()) fail('Ya existe una especie con ese nombre.');
            }
            if ($entidad==='citas' && (!(int)$v['paciente_id'] || !fechaValida((string)$v['fecha']) || !horaValida(substr((string)$v['hora'],0,5)) || !in_array($v['estado'],ESTADOS,true))) fail('Paciente, fecha, hora o estado inválidos.');
            if ($entidad==='registros' && (!(int)$v['paciente_id'] || !fechaValida((string)$v['fecha']) || !in_array($v['tipo'],['CONSULTA','VACUNA','TRATAMIENTO','CIRUGIA','OTRO'],true) || mb_strlen((string)$v['descripcion'])<3 || ($v['peso']!==null && $v['peso']!=='' && (!is_numeric($v['peso']) || (float)$v['peso']<0 || (float)$v['peso']>9999.99)))) fail('Datos del registro clínico inválidos.');
            if ($entidad==='citas' && !in_array((string)$v['domicilio'],['0','1',''],true)) fail('Valor de domicilio inválido.');
            if ($entidad==='citas' && (int)$v['domicilio']===1 && trim((string)$v['direccion_domicilio'])==='') fail('Indica la dirección del servicio a domicilio.');
            if (in_array($entidad,['citas','registros'],true)) {
                $s=$pdo->prepare('SELECT COUNT(*) FROM pacientes WHERE id=?' . ($entidad==='citas' ? ' AND activo=1' : ''));
                $s->execute([(int)$v['paciente_id']]); if (!(int)$s->fetchColumn()) fail('El paciente seleccionado no está disponible.');
            }
            if ($entidad==='citas' && $v['estado']==='PROGRAMADA') {
                $sql="SELECT COUNT(*) FROM citas WHERE fecha=? AND hora=? AND estado='PROGRAMADA'";
                $args=[$v['fecha'],$v['hora']]; if ($accion==='actualizar') { $sql.=' AND id<>?'; $args[]=$id; }
                $s=$pdo->prepare($sql); $s->execute($args); if ((int)$s->fetchColumn()) fail('Ya existe una cita programada en esa fecha y hora.');
            }
            if ($entidad==='registros' && ($v['peso']==='' || $v['peso']===null)) $v['peso']=null;
            $columns=$def['fields']; $values=array_values($v);
            if ($accion==='crear') {
                if ($entidad==='citas') { $columns[]='usuario'; $values[]=(string)$_SESSION['usuario']; }
                $sql='INSERT INTO '.$def['table'].' ('.implode(',',$columns).') VALUES ('.implode(',',array_fill(0,count($columns),'?')).')';
                $pdo->prepare($sql)->execute($values); out(['ok'=>true,'id'=>(int)$pdo->lastInsertId(),'mensaje'=>'Registro creado.'],201);
            }
            $sets=implode(',',array_map(fn($c)=>"$c=?",$columns)); $values[]=$id;
            $s=$pdo->prepare('UPDATE '.$def['table'].' SET '.$sets.' WHERE id=?'); $s->execute($values);
            out(['ok'=>true,'mensaje'=>'Cambios guardados.']);

        case 'resumen':
            $hoy = date('Y-m-d');
            $sem = date('Y-m-d', strtotime('+7 days'));
            $q = db()->prepare("SELECT
                (SELECT COUNT(*) FROM pacientes) AS totalPacientes,
                (SELECT COUNT(*) FROM citas WHERE estado='PROGRAMADA' AND fecha = ?) AS citasHoy,
                (SELECT COUNT(*) FROM citas WHERE estado='PROGRAMADA' AND fecha BETWEEN ? AND ?) AS citasSemana,
                (SELECT COUNT(*) FROM citas WHERE estado='PROGRAMADA') AS citasProgramadas");
            $q->execute([$hoy, $hoy, $sem]);
            out($q->fetch());

        case 'especies':
            out(db()->query('SELECT nombre FROM especies ORDER BY nombre')->fetchAll(PDO::FETCH_COLUMN));

        case 'pacientes':
            if ($m === 'GET') {
                $t = trim((string)($_GET['q'] ?? ''));
                if ($t === '') {
                    $rows = db()->query('SELECT id, nombre, especie, propietario, telefono, foto, notas FROM pacientes WHERE activo = 1 ORDER BY nombre')->fetchAll();
                } else {
                    $s = db()->prepare('SELECT id, nombre, especie, propietario, telefono, foto, notas FROM pacientes
                                        WHERE activo = 1 AND (nombre LIKE ? OR propietario LIKE ?) ORDER BY nombre');
                    $s->execute(["%$t%", "%$t%"]);
                    $rows = $s->fetchAll();
                }
                out($rows);
            }
            if ($m === 'POST') {
                $nombre = trim((string)($in['nombre'] ?? ''));
                if (mb_strlen($nombre) < 2) fail('El nombre de la mascota es obligatorio (mínimo 2 caracteres).');

                $foto = '';
                if (!empty($_FILES['foto']['tmp_name']) && $_FILES['foto']['error'] === UPLOAD_ERR_OK) {
                    if ($_FILES['foto']['size'] > 3 * 1024 * 1024) fail('La foto pesa más de 3 MB.');
                    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($_FILES['foto']['tmp_name']);
                    $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
                    if (!$ext) fail('La foto debe ser JPG, PNG o WEBP.');
                    $dir = __DIR__ . '/storage/fotos';
                    if (!is_dir($dir)) mkdir($dir, 0755, true);
                    $foto = bin2hex(random_bytes(12)) . '.' . $ext;
                    if (!move_uploaded_file($_FILES['foto']['tmp_name'], "$dir/$foto")) fail('No se pudo guardar la foto.', 500);
                }
                $s = db()->prepare('INSERT INTO pacientes (nombre, especie, propietario, telefono, foto, notas) VALUES (?,?,?,?,?,?)');
                $s->execute([
                    $nombre,
                    trim((string)($in['especie'] ?? '')),
                    trim((string)($in['propietario'] ?? '')),
                    trim((string)($in['telefono'] ?? '')),
                    $foto,
                    trim((string)($in['notas'] ?? '')),
                ]);
                out(['ok' => true, 'mensaje' => 'Paciente agregado correctamente.', 'id' => (int)db()->lastInsertId()], 201);
            }
            fail('Método no permitido.', 405);

        case 'paciente_baja':
            if ($m !== 'POST') fail('Método no permitido.', 405);
            $pid = (int)($in['id'] ?? 0);
            if (!$pid) fail('Falta indicar el paciente.');

            $pdo = db();
            $pdo->beginTransaction();
            $s = $pdo->prepare('SELECT nombre FROM pacientes WHERE id = ? AND activo = 1');
            $s->execute([$pid]);
            $nombre = $s->fetchColumn();
            if (!$nombre) { $pdo->rollBack(); fail('El paciente no existe o ya estaba dado de baja.', 404); }

            $pdo->prepare('UPDATE pacientes SET activo = 0 WHERE id = ?')->execute([$pid]);
            // Las citas futuras que tuviera programadas se cancelan; el historial de citas pasadas NO se borra.
            $pdo->prepare("UPDATE citas SET estado = 'CANCELADA' WHERE paciente_id = ? AND estado = 'PROGRAMADA'")->execute([$pid]);
            $pdo->commit();
            out(['ok' => true, 'mensaje' => "$nombre fue dado de baja. Su historial de citas se conservó."]);

        case 'foto':
            $s = db()->prepare('SELECT foto FROM pacientes WHERE id = ?');
            $s->execute([(int)($_GET['id'] ?? 0)]);
            $f = (string)$s->fetchColumn();
            $ruta = __DIR__ . '/storage/fotos/' . basename($f);
            if ($f === '' || !is_file($ruta)) fail('Sin foto.', 404);
            header('Content-Type: ' . (new finfo(FILEINFO_MIME_TYPE))->file($ruta));
            header('Cache-Control: private, max-age=3600');
            readfile($ruta);
            exit;

        case 'citas':
            if ($m === 'GET') {
                $sql = 'SELECT c.id, c.paciente_id AS idPaciente, p.nombre AS nombrePaciente, c.fecha,
                               TIME_FORMAT(c.hora, "%H:%i") AS hora, c.motivo, c.estado, c.observaciones,
                               c.domicilio, c.direccion_domicilio AS direccionDomicilio
                        FROM citas c JOIN pacientes p ON p.id = c.paciente_id WHERE 1=1';
                $par = [];
                if (!empty($_GET['desde'])) { $sql .= ' AND c.fecha >= ?'; $par[] = $_GET['desde']; }
                if (!empty($_GET['hasta'])) { $sql .= ' AND c.fecha <= ?'; $par[] = $_GET['hasta']; }
                if (!empty($_GET['estado']) && in_array($_GET['estado'], ESTADOS, true)) { $sql .= ' AND c.estado = ?'; $par[] = $_GET['estado']; }
                $s = db()->prepare($sql . ' ORDER BY c.fecha, c.hora');
                $s->execute($par);
                out($s->fetchAll());
            }
            if ($m === 'POST') {
                $pid = (int)($in['idPaciente'] ?? 0);
                $fecha = (string)($in['fecha'] ?? '');
                $hora = (string)($in['hora'] ?? '');
                if (!$pid || !fechaValida($fecha) || !horaValida($hora)) fail('Paciente, fecha y hora son obligatorios y deben ser válidos.');

                $pdo = db();
                $pdo->beginTransaction();
                $e = $pdo->prepare('SELECT COUNT(*) FROM pacientes WHERE id = ? AND activo = 1');
                $e->execute([$pid]);
                if (!(int)$e->fetchColumn()) { $pdo->rollBack(); fail('El paciente no existe o fue dado de baja del sistema.'); }

                $o = $pdo->prepare("SELECT COUNT(*) FROM citas WHERE fecha = ? AND hora = ? AND estado = 'PROGRAMADA' FOR UPDATE");
                $o->execute([$fecha, $hora]);
                if ((int)$o->fetchColumn()) { $pdo->rollBack(); fail("Ya existe una cita programada para $fecha a las $hora."); }

                $domicilio = !empty($in['domicilio']) && $in['domicilio'] !== '0' && $in['domicilio'] !== 'false';
                $direccionDomicilio = $domicilio ? trim((string)($in['direccionDomicilio'] ?? '')) : null;
                if ($domicilio && $direccionDomicilio === '') { $pdo->rollBack(); fail('Falta la dirección para la cita a domicilio.'); }

                $s = $pdo->prepare('INSERT INTO citas (paciente_id, fecha, hora, motivo, observaciones, domicilio, direccion_domicilio, usuario) VALUES (?,?,?,?,?,?,?,?)');
                $s->execute([
                    $pid, $fecha, $hora,
                    trim((string)($in['motivo'] ?? '')),
                    trim((string)($in['observaciones'] ?? '')),
                    $domicilio ? 1 : 0,
                    $direccionDomicilio,
                    $_SESSION['usuario'],
                ]);
                $pdo->commit();
                out(['ok' => true, 'mensaje' => 'Cita registrada correctamente.'], 201);
            }
            fail('Método no permitido.', 405);

        case 'cita_estado':
            $estado = (string)($in['estado'] ?? '');
            if ($m !== 'POST' || !in_array($estado, ESTADOS, true)) fail('Datos inválidos.');
            $s = db()->prepare('UPDATE citas SET estado = ? WHERE id = ?');
            $s->execute([$estado, (int)($in['id'] ?? 0)]);
            out(['ok' => true, 'mensaje' => 'Estado de la cita actualizado.']);
        case 'registros':
            if ($m === 'GET') {
                $pid = (int)($_GET['idPaciente'] ?? 0);
                if (!$pid) fail('Falta indicar el paciente.');
                $s = db()->prepare('SELECT id, fecha, tipo, descripcion, peso FROM registros_clinicos WHERE paciente_id = ? ORDER BY fecha DESC, id DESC');
                $s->execute([$pid]);
                out($s->fetchAll());
            }
            if ($m === 'POST') {
                $pid = (int)($in['idPaciente'] ?? 0);
                $fecha = (string)($in['fecha'] ?? '');
                $tipo = (string)($in['tipo'] ?? '');
                $descripcion = trim((string)($in['descripcion'] ?? ''));
                $pesoRaw = trim((string)($in['peso'] ?? ''));
                $tiposValidos = ['CONSULTA', 'VACUNA', 'TRATAMIENTO', 'CIRUGIA', 'OTRO'];
                if (!$pid || !fechaValida($fecha)) fail('Paciente y fecha son obligatorios.');
                if (!in_array($tipo, $tiposValidos, true)) fail('Tipo de registro no válido.');
                if (mb_strlen($descripcion) < 3) fail('La descripción es obligatoria (mínimo 3 caracteres).');
                $peso = null;
                if ($pesoRaw !== '') {
                    if (!is_numeric($pesoRaw)) fail('El peso debe ser un número.');
                    $peso = round((float)$pesoRaw, 2);
                }
                $e = db()->prepare('SELECT COUNT(*) FROM pacientes WHERE id = ?');
                $e->execute([$pid]);
                if (!(int)$e->fetchColumn()) fail('El paciente no existe.');
                $s = db()->prepare('INSERT INTO registros_clinicos (paciente_id, fecha, tipo, descripcion, peso) VALUES (?,?,?,?,?)');
                $s->execute([$pid, $fecha, $tipo, $descripcion, $peso]);
                out(['ok' => true, 'mensaje' => 'Registro agregado al expediente.'], 201);
            }
            fail('Método no permitido.', 405);
            
case 'carnet':
    if ($m !== 'GET') fail('Método no permitido.', 405);
    $pid = (int)($_GET['id'] ?? 0);
    $s = db()->prepare('SELECT * FROM pacientes WHERE id = ?');
    $s->execute([$pid]);
    $p = $s->fetch();
    if (!$p) fail('Paciente no encontrado.', 404);
    $rs = db()->prepare(
        'SELECT * FROM registros_clinicos
         WHERE paciente_id = ?
         ORDER BY fecha DESC, id DESC'
    );
    $rs->execute([$pid]);
    $registros = $rs->fetchAll();
    $fpdfPath = __DIR__ . '/lib/fpdf/fpdf.php';
    if (!is_file($fpdfPath)) {
        fail(
            'Falta instalar la librería FPDF en backend/api/lib/fpdf/fpdf.php. Revisa LEEME.txt en esa carpeta.',
            500
        );
    }
    require_once $fpdfPath;
    $t = function (string $s): string {
        return @iconv(
            'UTF-8',
            'windows-1252//TRANSLIT',
            $s
        ) ?: $s;
    };
    if (!class_exists('CarnetPDF')) {
        class CarnetPDF extends FPDF {
            public array $clinica = [];
            public $conv;
            function Header() {
                $c = $this->clinica;
                $this->SetFont('Helvetica', 'B', 14);
                $this->Cell(
                    0,
                    8,
                    ($this->conv)(
                        $c['nombreSistema'] ?? 'Clinica Veterinaria'
                    ),
                    0,
                    1,
                    'C'
                );
                $this->SetFont('Helvetica', '', 9);
                $this->Cell(
                    0,
                    5,
                    ($this->conv)(
                        trim(
                            ($c['doctor'] ?? '') .
                            ' - Ced. ' .
                            ($c['cedula'] ?? '')
                        )
                    ),
                    0,
                    1,
                    'C'
                );
                $this->Cell(
                    0,
                    5,
                    ($this->conv)(
                        trim(
                            ($c['direccion'] ?? '') .
                            ' - Tel. ' .
                            ($c['telefono'] ?? '')
                        )
                    ),
                    0,
                    1,
                    'C'
                );
                $this->Ln(3);
                $this->SetDrawColor(190, 190, 190);
                $this->Line(
                    10,
                    $this->GetY(),
                    200,
                    $this->GetY()
                );
                $this->Ln(5);
            }
            function Footer() {
                $this->SetY(-15);
                $this->SetFont('Helvetica', 'I', 8);
                $this->Cell(
                    0,
                    10,
                    ($this->conv)(
                        'Generado el ' .
                        date('d/m/Y H:i')
                    ),
                    0,
                    0,
                    'C'
                );
            }
        }
    }
    $pdf = new CarnetPDF('P', 'mm', 'Letter');
    $pdf->clinica =
        ($cfg['clinica'] ?? []) +
        ['nombreSistema' => $cfg['nombreSistema']];
    $pdf->conv = $t;
    $pdf->SetAutoPageBreak(true, 20);

    $pdf->AddPage();
    $fotoTmp = null;
    if (!empty($p['foto'])) {
        $ruta = __DIR__ .
            '/storage/fotos/' .
            basename($p['foto']);
        if (is_file($ruta)) {
            $ext = strtolower(
                pathinfo($ruta, PATHINFO_EXTENSION)
            );
            if (
                in_array(
                    $ext,
                    ['jpg', 'jpeg', 'png'],
                    true
                )
            ) {
                $fotoTmp = $ruta;
            }
            elseif (
                $ext === 'webp' &&
                function_exists('imagecreatefromwebp')
            ) {
                $img = @imagecreatefromwebp($ruta);
                if ($img) {
                    $fotoTmp =
                        sys_get_temp_dir() .
                        '/' .
                        bin2hex(random_bytes(6)) .
                        '.png';
                    imagepng($img, $fotoTmp);
                    imagedestroy($img);
                    register_shutdown_function(
                        fn() => @unlink($fotoTmp)
                    );
                }
            }
        }
    }
    $yCarnet = $pdf->GetY();
    $pdf->SetFont('Helvetica', 'B', 13);
    $pdf->SetFillColor(230, 240, 248);
    $pdf->Cell(
        0,
        9,
        $t('CARNET DE IDENTIFICACION'),
        1,
        1,
        'C',
        true
    );
    $yCaja = $pdf->GetY();
    $pdf->Rect(
        10,
        $yCaja,
        190,
        62
    );
    if ($fotoTmp) {
        $pdf->Rect(
            15,
            $yCaja + 6,
            45,
            45
        );
        $imgInfo = @getimagesize($fotoTmp);
        if (
            $imgInfo &&
            isset($imgInfo[0], $imgInfo[1]) &&
            $imgInfo[0] > 0 &&
            $imgInfo[1] > 0
        ) {
            $imgW = (float)$imgInfo[0];
            $imgH = (float)$imgInfo[1];
            $maxW = 41;
            $maxH = 41;
            $escala = min(
                $maxW / $imgW,
                $maxH / $imgH
            );
            $drawW = $imgW * $escala;
            $drawH = $imgH * $escala;
            $drawX =
                15 +
                (($maxW - $drawW) / 2) +
                2;
            $drawY =
                $yCaja +
                6 +
                (($maxH - $drawH) / 2) +
                2;
            $pdf->Image(
                $fotoTmp,
                $drawX,
                $drawY,
                $drawW,
                $drawH
            );
        } else {
            $pdf->Image(
                $fotoTmp,
                17,
                $yCaja + 8,
                41,
                41
            );
        }
    } else {
        $pdf->SetFont('Helvetica', 'I', 8);
        $pdf->SetXY(
            15,
            $yCaja + 24
        );
        $pdf->Cell(
            45,
            8,
            $t('Sin fotografia'),
            0,
            0,
            'C'
        );
    }
    $xInfo = 67;
    $yInfo = $yCaja + 7;
    $pdf->SetXY(
        $xInfo,
        $yInfo
    );
    $pdf->SetFont(
        'Helvetica',
        'B',
        15
    );
    $pdf->Cell(
        125,
        9,
        $t(
            $p['nombre'] ?: 'Sin nombre'
        ),
        0,
        1
    );
    $pdf->SetX($xInfo);
    $pdf->SetFont(
        'Helvetica',
        'B',
        9
    );
    $pdf->Cell(
        28,
        6,
        $t('Especie:'),
        0,
        0
    );
    $pdf->SetFont(
        'Helvetica',
        '',
        9
    );
    $pdf->Cell(
        90,
        6,
        $t(
            $p['especie'] ?: '-'
        ),
        0,
        1
    );
    $pdf->SetX($xInfo);
    $pdf->SetFont(
        'Helvetica',
        'B',
        9
    );
    $pdf->Cell(
        28,
        6,
        $t('Propietario:'),
        0,
        0
    );
    $pdf->SetFont(
        'Helvetica',
        '',
        9
    );
    $pdf->Cell(
        90,
        6,
        $t(
            $p['propietario'] ?: '-'
        ),
        0,
        1
    );
    $pdf->SetX($xInfo);
    $pdf->SetFont(
        'Helvetica',
        'B',
        9
    );
    $pdf->Cell(
        28,
        6,
        $t('Telefono:'),
        0,
        0
    );
    $pdf->SetFont(
        'Helvetica',
        '',
        9
    );
    $pdf->Cell(
        90,
        6,
        $t(
            $p['telefono'] ?: '-'
        ),
        0,
        1
    );
    $pdf->SetX($xInfo);
    $pdf->SetFont(
        'Helvetica',
        'B',
        9
    );
    $pdf->Cell(
        28,
        6,
        $t('ID paciente:'),
        0,
        0
    );
    $pdf->SetFont(
        'Helvetica',
        '',
        9
    );
    $pdf->Cell(
        90,
        6,
        $t((string)$p['id']),
        0,
        1
    );
    $pdf->SetXY(
        15,
        $yCaja + 52
    );
    $pdf->SetFont(
        'Helvetica',
        'I',
        7
    );
    $pdf->Cell(
        175,
        5,
        $t(
            'Documento de identificacion y referencia clinica del paciente'
        ),
        0,
        0,
        'C'
    );
    $pdf->SetY(
        $yCaja + 68
    );
    if (trim((string)$p['notas']) !== '') {
        $pdf->SetFont(
            'Helvetica',
            'B',
            10
        );
        $pdf->Cell(
            0,
            7,
            $t('Notas del paciente'),
            0,
            1
        );
        $pdf->SetFont(
            'Helvetica',
            '',
            9
        );
        $pdf->SetFillColor(
            248,
            248,
            248
        );
        $pdf->MultiCell(
            190,
            5,
            $t($p['notas']),
            1,
            'L',
            true
        );
        $pdf->Ln(4);
    }
    $pdf->SetFont(
        'Helvetica',
        'B',
        12
    );
    $pdf->Cell(
        0,
        8,
        $t('EXPEDIENTE CLINICO'),
        0,
        1
    );
    $pdf->SetFont(
        'Helvetica',
        '',
        8
    );
    $pdf->Cell(
        0,
        5,
        $t(
            'Historial de consultas y registros clinicos del paciente'
        ),
        0,
        1
    );
    $pdf->Ln(2);
    $pdf->SetFillColor(
        230,
        240,
        248
    );
    $pdf->SetFont(
        'Helvetica',
        'B',
        8
    );
    $pdf->Cell(
        112,
        7,
        $t('Descripcion'),
        1,
        0,
        'C',
        true
    );
    $pdf->Cell(
        24,
        7,
        $t('Fecha'),
        1,
        0,
        'C',
        true
    );
    $pdf->Cell(
        28,
        7,
        $t('Tipo'),
        1,
        0,
        'C',
        true
    );
    $pdf->Cell(
        26,
        7,
        $t('Peso'),
        1,
        1,
        'C',
        true
    );
    $pdf->SetFont(
        'Helvetica',
        '',
        8
    );
    if (!$registros) {
        $pdf->Cell(
            190,
            8,
            $t(
                'Sin registros clinicos todavia.'
            ),
            1,
            1,
            'C'
        );
    } else {
        foreach ($registros as $r) {
            $yAntes = $pdf->GetY();
            $xAntes = $pdf->GetX();
            $pdf->MultiCell(
                112,
                5,
                $t(
                    $r['descripcion'] ?: '-'
                ),
                1
            );
            $alto =
                max(
                    $pdf->GetY() - $yAntes,
                    7
                );
            $pdf->SetXY(
                $xAntes + 112,
                $yAntes
            );

            $pdf->Cell(
                24,
                $alto,
                $t(
                    $r['fecha'] ?: '-'
                ),
                1,
                0,
                'C'
            );
            $pdf->Cell(
                28,
                $alto,
                $t(
                    $r['tipo'] ?: '-'
                ),
                1,
                0,
                'C'
            );
            $peso =
                $r['peso'] !== null &&
                $r['peso'] !== ''
                    ? $r['peso'] . ' kg'
                    : '-';
            $pdf->Cell(
                26,
                $alto,
                $t($peso),
                1,
                0,
                'C'
            );
            $pdf->SetXY(
                $xAntes,
                $yAntes + $alto
            );
        }
    }
    $nombreArchivo =
        'carnet-' .
        preg_replace(
            '/[^a-z0-9]+/i',
            '-',
            $p['nombre']
        ) .
        '.pdf';

    $pdf->Output(
        'I',
        $nombreArchivo
    );

    exit;

        case 'diagnostico':
            $errores = [];
            foreach (['especies', 'pacientes', 'citas', 'registros_clinicos'] as $t) {
                if (!db()->query("SHOW TABLES LIKE '$t'")->fetchColumn()) $errores[] = "Falta la tabla: $t";
            }
            if (!is_writable(__DIR__ . '/storage/fotos')) $errores[] = 'La carpeta storage/fotos no tiene permiso de escritura.';
            if ($cfg['admin']['hash'] === 'PEGA_AQUI_EL_HASH') $errores[] = 'No has configurado la contraseña en config.php.';
            if (!is_file(__DIR__ . '/lib/fpdf/fpdf.php')) $errores[] = 'Falta instalar FPDF (backend/api/lib/fpdf/fpdf.php) para poder imprimir el carnet.';
            out(['errores' => $errores]);

        default:
            fail('Ruta no encontrada.', 404);
    }
} catch (Throwable $e) {
    error_log('[dental] ' . $e->getMessage());
    fail('Error interno del servidor. Revisa el log de PHP.', 500);
}
