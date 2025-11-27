// Simulierte Datenbank für Postleitzahlen und Städte
const zipCodeDatabase = {
    "10115": "Berlin",
    "80331": "München",
    "50667": "Köln",
    "60311": "Frankfurt am Main",
    "20095": "Hamburg",
    "70173": "Stuttgart",
    "40213": "Düsseldorf",
    "44135": "Dortmund",
    "45127": "Essen",
    "66111": "Saarbrücken",
    "01067": "Dresden",
    "04103": "Leipzig",
    "30159": "Hannover",
    "99084": "Erfurt",
    "55116": "Mainz",
    "66117": "Saarbrücken",
    "97070": "Würzburg",
    "93047": "Regensburg",
    "86150": "Augsburg",
    "94032": "Passau",
    "88212": "Ravensburg",
    "88339": "Bad Waldsee"
};
//Ablauf nach Eingabe einer Postleitzahl
document.addEventListener('DOMContentLoaded', function() {
    const zipcodeInput = document.getElementById('zipcode');
    const cityInput = document.getElementById('city');
    const zipcodeLoading = document.getElementById('zipcodeLoading');
    const form = document.getElementById('accommodationForm');
    const uploadContainer = document.getElementById('uploadContainer');
    const uploadButton = document.getElementById('uploadButton');
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const previewModal = document.getElementById('previewModal');
    const closeModal = document.getElementById('closeModal');
    const editBtn = document.getElementById('editBtn');
    const confirmBtn = document.getElementById('confirmBtn');
    const accommodationDetails = document.getElementById('accommodationDetails');

    // Event-Listener für Postleitzahl-Änderungen
    zipcodeInput.addEventListener('input', function() {
        const zipcode = this.value.trim();

        // Nur suchen, wenn die Postleitzahl 5-stellig ist
        if (zipcode.length === 5) {
            zipcodeLoading.style.display = 'block';

            // Simuliere eine kurze Verzögerung für die Datenbankabfrage
            setTimeout(() => {
                const city = zipCodeDatabase[zipcode];

                if (city) {
                    cityInput.value = city;
                } else {
                    cityInput.value = '';
                    alert('Postleitzahl nicht gefunden. Bitte überprüfen Sie die Eingabe.');
                }

                zipcodeLoading.style.display = 'none';
            }, 800);
        } else {
            cityInput.value = '';
        }
    });

    // Bildupload Funktionalität
    uploadButton.addEventListener('click', function() {
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    // Drag & Drop Funktionalität
    uploadContainer.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadContainer.classList.add('drag-over');
    });

    uploadContainer.addEventListener('dragleave', function() {
        uploadContainer.classList.remove('drag-over');
    });

    uploadContainer.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadContainer.classList.remove('drag-over');

        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // Funktion zum Verarbeiten der hochgeladenen Dateien
    function handleFiles(files) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            if (!file.type.match('image.*')) {
                alert('Nur Bilddateien sind erlaubt!');
                continue;
            }

            const reader = new FileReader();

            reader.onload = function(e) {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';

                const img = document.createElement('img');
                img.src = e.target.result;

                const removeBtn = document.createElement('button');
                removeBtn.className = 'remove-btn';
                removeBtn.innerHTML = '<i class="fas fa-times"></i>';

                removeBtn.addEventListener('click', function() {
                    previewItem.remove();
                });

                previewItem.appendChild(img);
                previewItem.appendChild(removeBtn);
                imagePreview.appendChild(previewItem);
            };

            reader.readAsDataURL(file);
        }
    }

    // Formular SubmitEvent
    form.addEventListener('submit', function(e) {
        e.preventDefault();

        // Formulardaten sammeln
        const formData = new FormData(form);
        const accommodationData = {};

        for (let [key, value] of formData.entries()) {
            accommodationData[key] = value;
        }

        // Hochgeladene Bilder sammeln
        const uploadedImages = [];
        const previewItems = imagePreview.querySelectorAll('.preview-item img');
        previewItems.forEach(img => {
            uploadedImages.push(img.src);
        });
        accommodationData.images = uploadedImages;

        console.log('Unterkunftsdaten:', accommodationData);

        // Modal mit den Daten füllen
        displayAccommodationDetails(accommodationData);

        // Modal anzeigen
        previewModal.style.display = 'block';
    });

    // Modal schließen
    closeModal.addEventListener('click', function() {
        previewModal.style.display = 'none';
    });

    // Bearbeiten-Button
    editBtn.addEventListener('click', function() {
        previewModal.style.display = 'none';
        // Hier könnte man das Formular zur Bearbeitung wieder öffnen
    });

    // Bestätigen Button
    confirmBtn.addEventListener('click', function() {
        previewModal.style.display = 'none';
        form.reset();
        imagePreview.innerHTML = '';
        alert('Unterkunft wurde erfolgreich in der Datenbank gespeichert!');
    });

    // Modal schließen, wenn außerhalb geklickt wird
    window.addEventListener('click', function(e) {
        if (e.target === previewModal) {
            previewModal.style.display = 'none';
        }
    });

    // Funktion zum Anzeigen der Unterkunftsdetails im Modal
    function displayAccommodationDetails(data) {
        // Übersetzung für Unterkunftstypen
        const typeTranslations = {
            'hotel': 'Hotel',
            'apartment': 'Ferienwohnung',
            'hostel': 'Hostel',
            'guesthouse': 'Pension',
            'villa': 'Villa',
            'other': 'Andere'
        };

        let html = `
            <div class="detail-group">
                <div class="detail-label">Name</div>
                <div class="detail-value">${data.name || '-'}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Art der Unterkunft</div>
                <div class="detail-value">${typeTranslations[data.type] || data.type || '-'}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Beschreibung</div>
                <div class="detail-value">${data.description || 'Keine Beschreibung vorhanden'}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Adresse</div>
                <div class="detail-value">${data.street || '-'}, ${data.zipcode || ''} ${data.city || ''}, ${data.country || ''}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Ausstattung</div>
                <div class="detail-value">
                    ${data.rooms || '0'} Zimmer, 
                    ${data.bathrooms || '0'} Badezimmer, 
                    ${data.maxGuests || '0'} Gäste max.
                    ${data.size ? `, ${data.size} m²` : ''}
                </div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Kontaktdaten</div>
                <div class="detail-value">
                    <strong>${data.contactName || '-'}</strong><br>
                    E-Mail: ${data.contactEmail || '-'}<br>
                    Telefon: ${data.contactPhone || '-'}<br>
                    ${data.contactWebsite ? `Website: ${data.contactWebsite}` : ''}
                </div>
            </div>
            <div class="detail-group detail-images" style="grid-column: 1 / -1;">
                <div class="detail-label">Hochgeladene Bilder</div>
        `;

        if (data.images && data.images.length > 0) {
            html += `<div class="modal-images">`;
            data.images.forEach(imgSrc => {
                html += `<img src="${imgSrc}" class="modal-image" alt="Unterkunft Bild">`;
            });
            html += `</div>`;
        } else {
            html += `<div class="no-images">Keine Bilder hochgeladen</div>`;
        }

        html += `</div>`;

        accommodationDetails.innerHTML = html;
    }
});