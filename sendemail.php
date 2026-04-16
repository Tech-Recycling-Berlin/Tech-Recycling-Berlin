<?php
/**
 * Tech Recycling Berlin — Contact form handler
 * Uses PHPMailer (install via composer or copy from vendor/)
 */

header('Content-Type: text/html; charset=utf-8');

// Only POST allowed
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method not allowed');
}

// Language detection from referrer (DE or EN)
$lang = 'de';
if (isset($_SERVER['HTTP_REFERER']) && strpos($_SERVER['HTTP_REFERER'], '/en/') !== false) {
    $lang = 'en';
}

// Messages in both languages
$msg = [
    'de' => [
        'success'     => 'Vielen Dank! Ihre Nachricht wurde erfolgreich gesendet. Wir melden uns innerhalb von 24 Stunden.',
        'error'       => 'Beim Senden ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut oder rufen Sie uns an.',
        'invalid'     => 'Bitte füllen Sie alle Pflichtfelder korrekt aus.',
        'consent'     => 'Bitte stimmen Sie der Datenschutzerklärung zu.',
        'back'        => 'Zurück zur Startseite',
        'subject'     => 'Neue Anfrage über techrecycling-berlin.com',
    ],
    'en' => [
        'success'     => 'Thank you! Your message was sent successfully. We will reply within 24 hours.',
        'error'       => 'An error occurred. Please try again later or give us a call.',
        'invalid'     => 'Please fill in all required fields correctly.',
        'consent'     => 'Please agree to the Privacy Policy.',
        'back'        => 'Back to home',
        'subject'     => 'New enquiry via techrecycling-berlin.com',
    ],
][$lang];

// Basic validation
$name    = trim($_POST['name']    ?? '');
$email   = trim($_POST['email']   ?? '');
$company = trim($_POST['company'] ?? '');
$phone   = trim($_POST['phone']   ?? '');
$service = trim($_POST['service'] ?? '');
$message = trim($_POST['message'] ?? '');
$consent = isset($_POST['consent']);

$errors = [];
if ($name === '' || strlen($name) < 2)        $errors[] = $msg['invalid'];
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = $msg['invalid'];
if ($message === '' || strlen($message) < 10) $errors[] = $msg['invalid'];
if (!$consent)                                 $errors[] = $msg['consent'];

// Honeypot (optional anti-spam field — can be added to form later)
if (!empty($_POST['website'])) exit('spam');

// Simple rate-limit stub (sessions/IP) — keep minimal
function send_response($status, $message, $back_url, $page_title) {
    echo <<<HTML
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>{$page_title}</title>
<link rel="stylesheet" href="assets/css/style.css">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&family=Inter&display=swap">
</head>
<body>
<section class="section" style="min-height:60vh;display:flex;align-items:center">
<div class="container" style="max-width:540px;text-align:center">
<div style="background:#fff;border:1px solid var(--line);border-radius:var(--radius-lg);padding:3rem 2rem">
<div style="width:60px;height:60px;margin:0 auto 1.5rem;border-radius:50%;background:var(--green-light);display:flex;align-items:center;justify-content:center">
<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="var(--green)" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg>
</div>
<h2>{$page_title}</h2>
<p style="color:var(--ink-soft)">{$message}</p>
<a href="{$back_url}" class="btn btn--primary" style="margin-top:1rem">Zurück</a>
</div>
</div>
</section>
</body>
</html>
HTML;
}

if (!empty($errors)) {
    send_response('error', implode(' ', array_unique($errors)), ($lang==='en'?'/en/contact.html':'/kontakt.html'), 'Fehler / Error');
    exit;
}

// Prepare mail — attempt to use PHPMailer if available, else mail()
$recipient = 'info@techrecycling-berlin.com';
$body = "Neue Anfrage / New enquiry\n\n";
$body .= "Name:     $name\n";
$body .= "Firma/Co: $company\n";
$body .= "E-Mail:   $email\n";
$body .= "Telefon:  $phone\n";
$body .= "Leistung: $service\n";
$body .= "Sprache:  $lang\n\n";
$body .= "Nachricht / Message:\n$message\n";

$headers = "From: noreply@techrecycling-berlin.com\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "Content-Type: text/plain; charset=utf-8\r\n";

// Try PHPMailer (recommended)
$phpmailer_path = __DIR__ . '/vendor/autoload.php';
$sent = false;
if (file_exists($phpmailer_path)) {
    require_once $phpmailer_path;
    try {
        $mail = new PHPMailer\PHPMailer\PHPMailer(true);
        // Configure SMTP here for production:
        // $mail->isSMTP();
        // $mail->Host       = 'smtp.example.com';
        // $mail->SMTPAuth   = true;
        // $mail->Username   = 'user';
        // $mail->Password   = 'pass';
        // $mail->SMTPSecure = 'tls';
        // $mail->Port       = 587;
        $mail->setFrom('noreply@techrecycling-berlin.com', 'Website');
        $mail->addAddress($recipient);
        $mail->addReplyTo($email, $name);
        $mail->Subject = $msg['subject'];
        $mail->Body    = $body;
        $mail->CharSet = 'UTF-8';
        $sent = $mail->send();
    } catch (Exception $e) {
        $sent = @mail($recipient, $msg['subject'], $body, $headers);
    }
} else {
    $sent = @mail($recipient, $msg['subject'], $body, $headers);
}

$back_url = $lang === 'en' ? '/en/' : '/';
if ($sent) {
    send_response('success', $msg['success'], $back_url, ($lang==='en'?'Message sent':'Nachricht gesendet'));
} else {
    send_response('error', $msg['error'], ($lang==='en'?'/en/contact.html':'/kontakt.html'), ($lang==='en'?'Error':'Fehler'));
}
