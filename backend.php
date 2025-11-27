<?php
// Beispiel für eine einfache PHP-Backend-Verarbeitung
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Daten aus dem Formular empfangen
    $accommodationData = [
        'name' => $_POST['name'] ?? '',
        'type' => $_POST['type'] ?? '',
        'street' => $_POST['street'] ?? '',
        'zipcode' => $_POST['zipcode'] ?? '',
        'city' => $_POST['city'] ?? '',
        'country' => $_POST['country'] ?? '',
        'rooms' => $_POST['rooms'] ?? '',
        'bathrooms' => $_POST['bathrooms'] ?? '',
        'maxGuests' => $_POST['maxGuests'] ?? '',
        'size' => $_POST['size'] ?? '',
        'description' => $_POST['description'] ?? '',
        'contactName' => $_POST['contactName'] ?? '',
        'contactEmail' => $_POST['contactEmail'] ?? '',
        'contactPhone' => $_POST['contactPhone'] ?? '',
        'contactWebsite' => $_POST['contactWebsite'] ?? '',
        'created_at' => date('Y-m-d H:i:s')
    ];

    // Hier würde normalerweise die Datenbank-Verbindung und das Speichern erfolgen

    // Bild Upload verarbeiten
    if (!empty($_FILES['images'])) {
        $uploadedImages = [];
        foreach ($_FILES['images']['tmp_name'] as $key => $tmp_name) {
            if ($_FILES['images']['error'][$key] === UPLOAD_ERR_OK) {
                $filename = uniqid() . '_' . $_FILES['images']['name'][$key];
                $destination = 'uploads/' . $filename;

                if (move_uploaded_file($tmp_name, $destination)) {
                    $uploadedImages[] = $destination;
                }
            }
        }
        $accommodationData['images'] = $uploadedImages;
    }

    // Erfolgsantwort senden
    echo json_encode([
        'success' => true,
        'message' => 'Unterkunft erfolgreich gespeichert',
        'data' => $accommodationData
    ]);
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}
?>