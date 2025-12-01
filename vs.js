document.addEventListener('DOMContentLoaded', function() {
  const zipcodeInput = document.getElementById('zipcode');
  const cityInput = document.getElementById('city');
  const zipcodeLoading = document.getElementById('zipcodeLoading');
  const cityLoading = document.getElementById('cityLoading') || createCityLoadingElement();
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

  // Cache für API-Abfragen (speichert bereits abgerufene PLZ/Stadt-Kombinationen)
  const apiCache = new Map();
  const reverseCache = new Map(); // Cache für Stadt → PLZ
  let debounceTimeout = null;
  let reverseDebounceTimeout = null;

  // Lade-Indikator für Stadt-Suche erstellen falls nicht vorhanden
  function createCityLoadingElement() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'cityLoading';
    loadingDiv.className = 'loading';
    loadingDiv.textContent = 'Suche Postleitzahl...';
    loadingDiv.style.display = 'none';
    loadingDiv.style.fontSize = '0.9em';
    loadingDiv.style.color = '#007bff';
    loadingDiv.style.marginTop = '5px';
    cityInput.parentNode.appendChild(loadingDiv);
    return loadingDiv;
  }

  // 1. PLZ → Stadt Suche
  zipcodeInput.addEventListener('input', function() {
    const zipcode = this.value.trim();

    // Clear previous timeout
    clearTimeout(debounceTimeout);

    // Nur suchen, wenn die Postleitzahl 5-stellig ist
    if (zipcode.length === 5 && /^\d{5}$/.test(zipcode)) {
      zipcodeLoading.style.display = 'block';
      cityInput.value = '';

      // Debouncing: Warte 500ms nach der letzten Eingabe
      debounceTimeout = setTimeout(async () => {
        await lookupCityByZipCode(zipcode);
        zipcodeLoading.style.display = 'none';
      }, 500);
    } else if (zipcode.length > 0) {
      // Warnung bei ungültiger PLZ
      if (zipcode.length > 5) {
        showWarning('Postleitzahl darf maximal 5 Ziffern haben', zipcodeInput);
      } else if (!/^\d+$/.test(zipcode)) {
        showWarning('Postleitzahl darf nur Ziffern enthalten', zipcodeInput);
      }
      cityInput.value = '';
    }
  });

  // 2. Stadt → PLZ Suche
  cityInput.addEventListener('input', function() {
    const city = this.value.trim();

    // Clear previous timeout
    clearTimeout(reverseDebounceTimeout);

    // Nur suchen, wenn mindestens 3 Zeichen eingegeben wurden
    if (city.length >= 3) {
      cityLoading.style.display = 'block';
      zipcodeInput.value = '';

      // Debouncing: Warte 700ms nach der letzten Eingabe (mehr Zeichen für bessere Ergebnisse)
      reverseDebounceTimeout = setTimeout(async () => {
        await lookupZipCodeByCity(city);
        cityLoading.style.display = 'none';
      }, 700);
    } else if (city.length > 0) {
      zipcodeInput.value = '';
    }
  });

  // Funktion: PLZ → Stadt via Zippopotam API
  async function lookupCityByZipCode(zipcode) {
    // Cache prüfen
    if (apiCache.has(zipcode)) {
      const cachedResult = apiCache.get(zipcode);
      if (cachedResult) {
        cityInput.value = cachedResult.city;
        console.log(`PLZ ${zipcode} aus Cache: ${cachedResult.city}`);
        return cachedResult;
      } else {
        showZipCodeNotFound(zipcode);
        return null;
      }
    }

    // Zippopotam API abfragen
    try {
      const result = await fetchCityFromZippopotam(zipcode);

      if (result && result.city) {
        cityInput.value = result.city;
        // Im Cache speichern
        apiCache.set(zipcode, result);
        // Auch in Reverse-Cache speichern
        if (!reverseCache.has(result.city.toLowerCase())) {
          reverseCache.set(result.city.toLowerCase(), [{ zipcode, state: result.state }]);
        }
        console.log(`PLZ ${zipcode} gefunden via API: ${result.city}`);
        return result;
      } else {
        apiCache.set(zipcode, null); // Negative Caching
        showZipCodeNotFound(zipcode);
        return null;
      }
    } catch (error) {
      console.error('API Fehler bei PLZ-Suche:', error);
      showZipCodeError(zipcode);
      return null;
    }
  }

  // Funktion: Stadt → PLZ via Zippopotam (Reverse-Suche)
  async function lookupZipCodeByCity(cityName) {
    const normalizedCity = cityName.toLowerCase().trim();

    // Cache prüfen
    if (reverseCache.has(normalizedCity)) {
      const cachedResults = reverseCache.get(normalizedCity);
      if (cachedResults && cachedResults.length > 0) {
        // Wenn nur ein Ergebnis, automatisch eintragen
        if (cachedResults.length === 1) {
          zipcodeInput.value = cachedResults[0].zipcode;
          console.log(`Stadt ${cityName} aus Cache: PLZ ${cachedResults[0].zipcode}`);
          showCityFound(cityName, cachedResults);
        } else {
          // Mehrere Ergebnisse - Dropdown anzeigen
          showCitySelection(cityName, cachedResults);
        }
        return cachedResults;
      }
    }

    // API für Reverse-Suche (wir müssen anders vorgehen, da Zippopotam keine direkte Stadt-Suche hat)
    try {
      // Da Zippopotam keine direkte Stadt-Suche hat, verwenden wir eine Kombination
      // von Vermutungen oder suchen nach bekannten Städten
      const results = await searchZipCodesForCity(cityName);

      if (results && results.length > 0) {
        // In Cache speichern
        reverseCache.set(normalizedCity, results);

        if (results.length === 1) {
          zipcodeInput.value = results[0].zipcode;
          console.log(`Stadt ${cityName} gefunden: PLZ ${results[0].zipcode}`);
          showCityFound(cityName, results);
        } else {
          showCitySelection(cityName, results);
        }
        return results;
      } else {
        showCityNotFound(cityName);
        return null;
      }
    } catch (error) {
      console.error('API Fehler bei Stadt-Suche:', error);
      showCityError(cityName);
      return null;
    }
  }

  // Hilfsfunktion für Stadt-Suche (da Zippopotam keine direkte Stadt-Suche bietet)
  async function searchZipCodesForCity(cityName) {
    // Für bekannte deutsche Großstädte haben wir eine kleine Referenzliste
    const knownCities = {
      'berlin': ['10115', '10178', '10243', '10318', '10405', '10551', '10623', '10707', '10825', '10961'],
      'münchen': ['80331', '80335', '80469', '80538', '80634', '80796', '80801', '80802', '80803', '80804'],
      'hamburg': ['20095', '20097', '20099', '20144', '20146', '20249', '20251', '20253', '20255', '20354'],
      'köln': ['50667', '50668', '50670', '50672', '50674', '50676', '50677', '50678', '50679', '50733'],
      'frankfurt am main': ['60311', '60313', '60314', '60316', '60318', '60320', '60322', '60323', '60325', '60326']
    };

    const normalizedCity = cityName.toLowerCase();

    // 1. Zuerst bekannte Städte prüfen
    if (knownCities[normalizedCity]) {
      const results = [];
      for (const zip of knownCities[normalizedCity]) {
        // Für jede PLZ die Stadtdaten holen
        const cityData = await lookupCityByZipCode(zip);
        if (cityData) {
          results.push({
            zipcode: zip,
            city: cityData.city,
            state: cityData.state
          });
        }
      }
      return results.length > 0 ? results : null;
    }

    // 2. Alternative: Für andere Städte müssen wir raten oder eine andere API verwenden
    // Hier könntest du eine andere API wie OpenStreetMap oder GeoNames einbinden
    console.log(`Keine direkte API-Suche für ${cityName} verfügbar`);
    return null;
  }

  // Zippopotam API-Abfrage (PLZ → Stadt)
  async function fetchCityFromZippopotam(zipcode) {
    try {
      const response = await fetch(`https://api.zippopotam.us/de/${zipcode}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: createAbortSignal(5000)
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // PLZ nicht gefunden
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.places && data.places.length > 0) {
        const place = data.places[0];
        return {
          city: place['place name'],
          state: place['state'],
          latitude: place['latitude'],
          longitude: place['longitude']
        };
      }

      return null;

    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('API Timeout für PLZ:', zipcode);
        throw new Error('API-Anfrage timeout');
      }
      throw error;
    }
  }

  // Fallback für AbortSignal
  function createAbortSignal(timeoutMs) {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  }

  // UI-Funktionen für PLZ-Suche
  function showZipCodeNotFound(zipcode) {
    cityInput.value = '';
    cityInput.placeholder = 'Stadt nicht gefunden';
    cityInput.classList.add('error');

    setTimeout(() => {
      cityInput.placeholder = 'Wird automatisch ausgefüllt';
      cityInput.classList.remove('error');
    }, 3000);

    console.warn(`PLZ ${zipcode} nicht gefunden`);
  }

  function showZipCodeError(zipcode) {
    cityInput.value = '';
    cityInput.placeholder = 'API-Fehler - bitte manuell eintragen';
    cityInput.classList.add('error');
    showManualEntryButton(cityInput, 'Stadt manuell eingeben');
    console.error(`Fehler bei PLZ-Suche für ${zipcode}`);
  }

  // UI-Funktionen für Stadt-Suche
  function showCityFound(cityName, results) {
    const result = results[0];
    zipcodeInput.classList.remove('error');
    zipcodeInput.placeholder = '';

    // Optional: Kleine Erfolgsmeldung
    const successMsg = document.createElement('div');
    successMsg.className = 'success-msg';
    successMsg.textContent = `Postleitzahl ${result.zipcode} gefunden (${result.state})`;
    successMsg.style.cssText = `
            color: #28a745;
            font-size: 0.8em;
            margin-top: 3px;
        `;

    removeExistingMessages(zipcodeInput);
    zipcodeInput.parentNode.appendChild(successMsg);

    setTimeout(() => successMsg.remove(), 3000);
  }

  function showCitySelection(cityName, results) {
    // Dropdown für mehrere Ergebnisse
    const dropdown = document.createElement('div');
    dropdown.className = 'city-selection-dropdown';
    dropdown.style.cssText = `
            border: 1px solid #ddd;
            background: white;
            max-height: 200px;
            overflow-y: auto;
            position: absolute;
            z-index: 1000;
            width: ${cityInput.offsetWidth}px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;

    results.forEach(result => {
      const option = document.createElement('div');
      option.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
            `;
      option.innerHTML = `
                <strong>${result.zipcode}</strong> - ${result.city}
                <div style="font-size: 0.8em; color: #666;">${result.state}</div>
            `;

      option.addEventListener('click', () => {
        zipcodeInput.value = result.zipcode;
        cityInput.value = result.city;
        dropdown.remove();
      });

      option.addEventListener('mouseenter', () => {
        option.style.backgroundColor = '#f5f5f5';
      });
      option.addEventListener('mouseleave', () => {
        option.style.backgroundColor = 'white';
      });

      dropdown.appendChild(option);
    });

    // Positionieren und anzeigen
    const cityRect = cityInput.getBoundingClientRect();
    dropdown.style.top = `${cityRect.bottom + window.scrollY}px`;
    dropdown.style.left = `${cityRect.left + window.scrollX}px`;

    // Vorherige Dropdowns entfernen
    document.querySelectorAll('.city-selection-dropdown').forEach(el => el.remove());
    document.body.appendChild(dropdown);

    // Dropdown schließen bei Klick außerhalb
    setTimeout(() => {
      const closeDropdown = (e) => {
        if (!dropdown.contains(e.target) && e.target !== cityInput) {
          dropdown.remove();
          document.removeEventListener('click', closeDropdown);
        }
      };
      document.addEventListener('click', closeDropdown);
    }, 0);
  }

  function showCityNotFound(cityName) {
    zipcodeInput.value = '';
    zipcodeInput.placeholder = 'Keine PLZ gefunden';
    zipcodeInput.classList.add('error');

    setTimeout(() => {
      zipcodeInput.placeholder = '';
      zipcodeInput.classList.remove('error');
    }, 3000);

    console.warn(`Keine PLZ für Stadt ${cityName} gefunden`);
  }

  function showCityError(cityName) {
    zipcodeInput.value = '';
    zipcodeInput.placeholder = 'Suche fehlgeschlagen';
    zipcodeInput.classList.add('error');
    showManualEntryButton(zipcodeInput, 'PLZ manuell eingeben');
    console.error(`Fehler bei Stadt-Suche für ${cityName}`);
  }

  // Allgemeine Hilfsfunktionen
  function showWarning(message, inputElement) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'input-warning';
    warningDiv.textContent = message;
    warningDiv.style.cssText = `
            color: #856404;
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 8px;
            margin-top: 5px;
            border-radius: 4px;
            font-size: 0.9em;
        `;

    removeExistingMessages(inputElement);
    inputElement.parentNode.appendChild(warningDiv);

    setTimeout(() => warningDiv.remove(), 3000);
  }

  function showManualEntryButton(inputElement, text) {
    const buttonId = `manual-btn-${inputElement.id}`;
    if (!document.getElementById(buttonId)) {
      const manualBtn = document.createElement('button');
      manualBtn.id = buttonId;
      manualBtn.className = 'manual-entry-btn';
      manualBtn.textContent = text;
      manualBtn.type = 'button';
      manualBtn.style.cssText = `
                margin-top: 5px;
                padding: 5px 10px;
                background-color: #f0f0f0;
                border: 1px solid #ccc;
                border-radius: 3px;
                cursor: pointer;
                font-size: 0.9em;
            `;

      manualBtn.addEventListener('click', function() {
        inputElement.readOnly = false;
        inputElement.focus();
        inputElement.placeholder = text.replace(' manuell eingeben', '');
        this.remove();
      });

      inputElement.parentNode.appendChild(manualBtn);
    }
  }

  function removeExistingMessages(inputElement) {
    inputElement.parentNode.querySelectorAll('.input-warning, .success-msg').forEach(el => el.remove());
  }

  // Der REST des Codes bleibt unverändert (Bildupload, Formular, etc.)
  uploadButton.addEventListener('click', function() {
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    handleFiles(this.files);
  });

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

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(form);
    const accommodationData = {};
    for (let [key, value] of formData.entries()) {
      accommodationData[key] = value;
    }
    const uploadedImages = [];
    const previewItems = imagePreview.querySelectorAll('.preview-item img');
    previewItems.forEach(img => {
      uploadedImages.push(img.src);
    });
    accommodationData.images = uploadedImages;
    console.log('Unterkunftsdaten:', accommodationData);
    displayAccommodationDetails(accommodationData);
    previewModal.style.display = 'block';
  });

  closeModal.addEventListener('click', function() {
    previewModal.style.display = 'none';
  });

  editBtn.addEventListener('click', function() {
    previewModal.style.display = 'none';
  });

  confirmBtn.addEventListener('click', function() {
    previewModal.style.display = 'none';
    form.reset();
    imagePreview.innerHTML = '';
    alert('Unterkunft wurde erfolgreich gespeichert!');
  });

  window.addEventListener('click', function(e) {
    if (e.target === previewModal) {
      previewModal.style.display = 'none';
    }
  });

  function displayAccommodationDetails(data) {
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

  // CSS für das erweiterte System
  const style = document.createElement('style');
  style.textContent = `
        .error {
            border-color: #dc3545 !important;
            background-color: #fff8f8 !important;
        }
        
        input[readonly] {
            background-color: #f8f9fa;
            cursor: not-allowed;
        }
        
        #zipcodeLoading, #cityLoading {
            display: none;
            color: #007bff;
            font-size: 0.9em;
            margin-top: 5px;
        }
        
        .city-selection-dropdown {
            font-family: inherit;
            font-size: 14px;
        }
        
        .city-selection-dropdown div:hover {
            background-color: #f8f9fa !important;
        }
        
        .success-msg {
            color: #28a745;
            font-size: 0.8em;
            margin-top: 3px;
        }
    `;
  document.head.appendChild(style);
});