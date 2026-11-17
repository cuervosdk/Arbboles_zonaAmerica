/* ============================================================================== 
   Visor GIS Forestal — Zona América
   Lógica de mapa Leaflet, filtrado multicriterio, resaltado de tala y exportación
   ========================================================================== */

(function () {
  "use strict";

  // 1. Estado global de la aplicación
  const state = {
    allFeatures: [],
    filteredFeatures: [],
    intervencion: "ALL", // 'ALL' | 'Tala' | 'Conservación - Poda'
    estado: "ALL",
    especie: "ALL",
    alturaMin: 0,
    searchQuery: "",
    highlightTala: false,
    proportionalSize: false,
    activeBasemap: "satellite"
  };

  const markerById = new Map();

  // 2. Inicializar Mapa Leaflet
  const map = L.map("map", {
    center: [3.3276, -76.5181],
    zoom: 17,
    maxZoom: 21,
    zoomControl: true
  });

  L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);

  // 3. Capas Base (Satelital, Híbrido, Callejero, Claro)
  const basemaps = {
    satellite: L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 21,
        maxNativeZoom: 19,
        attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
      }
    ),
    hybrid: L.layerGroup([
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 21,
          maxNativeZoom: 19,
          attribution: "Tiles &copy; Esri"
        }
      ),
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        {
          maxZoom: 21,
          maxNativeZoom: 19
        }
      )
    ]),
    streets: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 21,
      maxNativeZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }),
    light: L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 21,
      maxNativeZoom: 20,
      attribution: "&copy; OpenStreetMap &copy; CARTO"
    })
  };

  let currentBaseLayer = basemaps.satellite.addTo(map);

  function setBasemap(key) {
    if (!basemaps[key] || state.activeBasemap === key) return;
    map.removeLayer(currentBaseLayer);
    currentBaseLayer = basemaps[key].addTo(map);
    state.activeBasemap = key;

    document.querySelectorAll(".basemap-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.basemap === key);
    });
  }

  // Capas vectoriales de árboles y halos de resaltado
  const highlightLayer = L.layerGroup().addTo(map);
  const treesLayer = L.layerGroup().addTo(map);

  // 4. Cargar datos GeoJSON
  function initData() {
    if (window.ARBOLES_GEOJSON && Array.isArray(window.ARBOLES_GEOJSON.features)) {
      state.allFeatures = window.ARBOLES_GEOJSON.features;
      populateSpeciesDropdown();
      applyFilters(true);
    } else {
      fetch("data/arboles.geojson")
        .then((res) => res.json())
        .then((data) => {
          state.allFeatures = data.features || [];
          populateSpeciesDropdown();
          applyFilters(true);
        })
        .catch((err) => {
          console.error("Error cargando datos espaciales:", err);
          alert("No se pudieron cargar los datos de árboles.");
        });
    }
  }

  function populateSpeciesDropdown() {
    const counts = {};
    state.allFeatures.forEach((f) => {
      const name = f.properties.nombre_comun;
      counts[name] = (counts[name] || 0) + 1;
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const select = document.getElementById("filterEspecie");
    select.innerHTML = `<option value="ALL">Todas las especies (${state.allFeatures.length})</option>`;
    sorted.forEach(([name, count]) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = `${name} (${count})`;
      select.appendChild(opt);
    });
  }

  // 5. Filtrado y Renderizado
  function applyFilters(fitBoundsOnInit = false) {
    const q = state.searchQuery.trim().toLowerCase();

    state.filteredFeatures = state.allFeatures.filter((f) => {
      const p = f.properties;
      if (state.intervencion !== "ALL" && p.intervencion !== state.intervencion) {
        return false;
      }
      if (state.estado !== "ALL" && p.estado_fitosanitario !== state.estado) {
        return false;
      }
      if (state.especie !== "ALL" && p.nombre_comun !== state.especie) {
        return false;
      }
      if (state.alturaMin > 0 && p.altura_m < state.alturaMin) {
        return false;
      }
      if (q) {
        const hay = `${p.id} ${p.nombre_comun} ${p.especie} ${p.familia} ${p.intervencion}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    updateKPIs();
    renderMapMarkers(fitBoundsOnInit);
    renderTable();
  }

  function updateKPIs() {
    const totalAll = state.allFeatures.length || 1;
    const vis = state.filteredFeatures.length;
    const talaCount = state.filteredFeatures.filter((f) => f.properties.intervencion === "Tala").length;
    const consCount = vis - talaCount;

    const avgAlt =
      vis > 0
        ? (
            state.filteredFeatures.reduce((acc, f) => acc + (Number(f.properties.altura_m) || 0), 0) / vis
          ).toFixed(1)
        : "0.0";

    document.getElementById("kpiTotal").textContent = vis;
    document.getElementById("kpiTotalPct").textContent = `${((vis / totalAll) * 100).toFixed(1)}% del inventario`;

    document.getElementById("kpiTala").textContent = talaCount;
    document.getElementById("kpiTalaPct").textContent =
      vis > 0 ? `${((talaCount / vis) * 100).toFixed(1)}% de visibles` : "0%";

    document.getElementById("kpiCons").textContent = consCount;
    document.getElementById("kpiConsPct").textContent =
      vis > 0 ? `${((consCount / vis) * 100).toFixed(1)}% de visibles` : "0%";

    document.getElementById("kpiAltura").textContent = avgAlt;
    document.getElementById("tableCountBadge").textContent = vis;
  }

  function buildPopupHTML(p) {
    const isTala = p.intervencion === "Tala";
    const gmapsUrl = `https://www.google.com/maps?q=${p.lat},${p.lon}`;
    return `
      <div class="popup-card">
        <div class="popup-head ${isTala ? "is-tala" : "is-cons"}">
          <h4>Árbol ID #${p.id}</h4>
          <span class="popup-badge">${p.intervencion}</span>
        </div>
        <div class="popup-body">
          <div class="popup-species">
            <strong>${p.nombre_comun}</strong>
            <em>${p.especie}</em> · <small>${p.familia}</small>
          </div>
          <div class="popup-grid">
            <div class="popup-field">
              <span>CAP (cm)</span>
              <strong>${p.cap}</strong>
            </div>
            <div class="popup-field">
              <span>Altura Total</span>
              <strong>${p.altura_m} m</strong>
            </div>
            <div class="popup-field">
              <span>Diámetro Copa</span>
              <strong>${p.copa_m} m</strong>
            </div>
            <div class="popup-field">
              <span>Estado Fitosanitario</span>
              <strong>${p.estado_fitosanitario}</strong>
            </div>
            <div class="popup-field">
              <span>Cota (msnm)</span>
              <strong>${p.msm} m</strong>
            </div>
            <div class="popup-field">
              <span>Coordenadas</span>
              <strong>${p.lat.toFixed(6)}, ${p.lon.toFixed(6)}</strong>
            </div>
          </div>
          <div class="popup-footer">
            <span>Registro #${p.num}</span>
            <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer">Ver en Google Maps ↗</a>
          </div>
        </div>
      </div>
    `;
  }

  function renderMapMarkers(fitBounds = false) {
    treesLayer.clearLayers();
    highlightLayer.clearLayers();
    markerById.clear();

    const boundsPoints = [];

    // Dibujar primero Conservación y luego Tala encima para máxima visibilidad
    const ordered = [...state.filteredFeatures].sort((a, b) => {
      const aTala = a.properties.intervencion === "Tala" ? 1 : 0;
      const bTala = b.properties.intervencion === "Tala" ? 1 : 0;
      return aTala - bTala;
    });

    ordered.forEach((f) => {
      const p = f.properties;
      const isTala = p.intervencion === "Tala";
      const latlng = [p.disp_lat, p.disp_lon];
      boundsPoints.push(latlng);

      // Radio base o proporcional a copa
      let radius = isTala ? 7 : 6;
      if (state.proportionalSize) {
        radius = Math.max(5, Math.min(16, (p.copa_prom_m || 4) * 1.15));
      }
      if (state.highlightTala && isTala) {
        radius += 2.5;
      }

      const markerStyle = isTala
        ? {
            radius: radius,
            fillColor: "#dc2626",
            color: state.highlightTala ? "#fef08a" : "#ffffff",
            weight: state.highlightTala ? 2.5 : 1.8,
            opacity: 1,
            fillOpacity: 0.92
          }
        : {
            radius: radius,
            fillColor: "#10b981",
            color: "#ffffff",
            weight: 1.5,
            opacity: state.highlightTala ? 0.3 : 0.95,
            fillOpacity: state.highlightTala ? 0.22 : 0.85
          };

      const marker = L.circleMarker(latlng, markerStyle);
      marker.bindPopup(buildPopupHTML(p), { maxWidth: 310 });
      marker.bindTooltip(`#${p.id} · ${p.nombre_comun} (${p.intervencion})`, {
        direction: "top",
        offset: [0, -6]
      });

      marker.addTo(treesLayer);
      markerById.set(p.id, marker);

      // Si modo resaltar tala está activo, agregar anillo pulsante a árboles de Tala
      if (state.highlightTala && isTala) {
        const pulseIcon = L.divIcon({
          className: "",
          html: '<div class="pulse-marker"></div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });
        L.marker(latlng, { icon: pulseIcon, interactive: false }).addTo(highlightLayer);
      }
    });

    if (fitBounds && boundsPoints.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPoints), { padding: [45, 45], maxZoom: 18 });
    }
  }

  function renderTable() {
    const tbody = document.getElementById("attrTableBody");
    const rowsHtml = state.filteredFeatures
      .map((f) => {
        const p = f.properties;
        const isTala = p.intervencion === "Tala";
        return `
          <tr data-id="${p.id}">
            <td><strong>#${p.id}</strong></td>
            <td><span class="tag-pill ${isTala ? "tag-tala" : "tag-cons"}">${p.intervencion}</span></td>
            <td>${p.nombre_comun}</td>
            <td><em>${p.especie}</em></td>
            <td>${p.familia}</td>
            <td>${p.cap}</td>
            <td>${p.altura_m}</td>
            <td>${p.copa_m}</td>
            <td>${p.estado_fitosanitario}</td>
            <td>${p.msm}</td>
          </tr>
        `;
      })
      .join("");

    tbody.innerHTML = rowsHtml;
  }

  // 6. Exportación de datos filtrados (CSV / GeoJSON)
  function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportFilteredCSV() {
    const headers = [
      "ID",
      "Intervencion_Propuesta",
      "Nombre_Comun",
      "Especie",
      "Familia",
      "CAP_cm",
      "Altura_m",
      "Copa_m",
      "Estado_Fitosanitario",
      "Latitud",
      "Longitud",
      "Cota_msnm"
    ];

    const lines = [headers.join(",")];
    state.filteredFeatures.forEach((f) => {
      const p = f.properties;
      const vals = [
        p.id,
        `"${p.intervencion}"`,
        `"${p.nombre_comun}"`,
        `"${p.especie}"`,
        `"${p.familia}"`,
        `"${p.cap}"`,
        p.altura_m,
        `"${p.copa_m}"`,
        `"${p.estado_fitosanitario}"`,
        p.lat,
        p.lon,
        p.msm
      ];
      lines.push(vals.join(","));
    });

    downloadBlob("\uFEFF" + lines.join("\n"), "arboles_zona_america_filtrado.csv", "text/csv;charset=utf-8;");
  }

  function exportFilteredGeoJSON() {
    const fc = {
      type: "FeatureCollection",
      name: "Arboles_Zona_America_Filtrado",
      features: state.filteredFeatures
    };
    downloadBlob(JSON.stringify(fc, null, 2), "arboles_zona_america_filtrado.geojson", "application/geo+json");
  }

  // 7. Sincronización de UI y Eventos
  function setIntervencionFilter(val) {
    state.intervencion = val;
    document.querySelectorAll(".seg-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.intervencion === val);
    });
    document.querySelectorAll(".pill-btn[data-quick]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.quick === val);
    });
    applyFilters(false);
  }

  function setHighlightMode(enabled) {
    state.highlightTala = enabled;
    document.getElementById("toggleHighlightTala").checked = enabled;
    document.getElementById("btnQuickHighlight").classList.toggle("active", enabled);
    renderMapMarkers(false);
  }

  // Eventos de botones de intervención
  document.querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => setIntervencionFilter(btn.dataset.intervencion));
  });

  document.querySelectorAll(".pill-btn[data-quick]").forEach((btn) => {
    btn.addEventListener("click", () => setIntervencionFilter(btn.dataset.quick));
  });

  // Eventos de resaltado de tala
  document.getElementById("toggleHighlightTala").addEventListener("change", (e) => {
    setHighlightMode(e.target.checked);
  });

  document.getElementById("btnQuickHighlight").addEventListener("click", () => {
    setHighlightMode(!state.highlightTala);
  });

  // Eventos de capas base
  document.querySelectorAll(".basemap-btn").forEach((btn) => {
    btn.addEventListener("click", () => setBasemap(btn.dataset.basemap));
  });

  // Búsqueda y filtros desplegables
  const searchInput = document.getElementById("searchInput");
  const btnClearSearch = document.getElementById("btnClearSearch");

  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    btnClearSearch.style.display = state.searchQuery ? "block" : "none";
    applyFilters(false);
  });

  btnClearSearch.addEventListener("click", () => {
    searchInput.value = "";
    state.searchQuery = "";
    btnClearSearch.style.display = "none";
    applyFilters(false);
  });

  document.getElementById("filterEstado").addEventListener("change", (e) => {
    state.estado = e.target.value;
    applyFilters(false);
  });

  document.getElementById("filterAltura").addEventListener("change", (e) => {
    state.alturaMin = Number(e.target.value) || 0;
    applyFilters(false);
  });

  document.getElementById("filterEspecie").addEventListener("change", (e) => {
    state.especie = e.target.value;
    applyFilters(false);
  });

  document.getElementById("toggleProportional").addEventListener("change", (e) => {
    state.proportionalSize = e.target.checked;
    renderMapMarkers(false);
  });

  // Botones de acción
  document.getElementById("btnResetFilters").addEventListener("click", () => {
    state.intervencion = "ALL";
    state.estado = "ALL";
    state.especie = "ALL";
    state.alturaMin = 0;
    state.searchQuery = "";
    state.proportionalSize = false;

    searchInput.value = "";
    btnClearSearch.style.display = "none";
    document.getElementById("filterEstado").value = "ALL";
    document.getElementById("filterAltura").value = "0";
    document.getElementById("filterEspecie").value = "ALL";
    document.getElementById("toggleProportional").checked = false;

    setHighlightMode(false);
    setIntervencionFilter("ALL");
    applyFilters(true);
  });

  document.getElementById("btnZoomExtent").addEventListener("click", () => {
    if (state.filteredFeatures.length > 0) {
      const pts = state.filteredFeatures.map((f) => [f.properties.disp_lat, f.properties.disp_lon]);
      map.fitBounds(L.latLngBounds(pts), { padding: [45, 45], maxZoom: 18 });
    }
  });

  document.getElementById("btnExportCSV").addEventListener("click", exportFilteredCSV);
  document.getElementById("btnExportGeoJSON").addEventListener("click", exportFilteredGeoJSON);

  // Tabla interactiva
  const tableDrawer = document.getElementById("tableDrawer");
  document.getElementById("btnToggleTable").addEventListener("click", () => {
    tableDrawer.classList.toggle("open");
  });
  document.getElementById("btnCloseTable").addEventListener("click", () => {
    tableDrawer.classList.remove("open");
  });

  document.getElementById("attrTableBody").addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const id = Number(tr.dataset.id);
    const marker = markerById.get(id);
    if (marker) {
      map.flyTo(marker.getLatLng(), 20, { duration: 0.7 });
      marker.openPopup();
    }
  });

  // Sidebar móvil
  const sidebar = document.getElementById("sidebar");
  document.getElementById("btnOpenSidebar").addEventListener("click", () => sidebar.classList.add("open"));
  document.getElementById("btnCloseSidebar").addEventListener("click", () => sidebar.classList.remove("open"));

  // Coordenadas en tiempo real
  map.on("mousemove", (e) => {
    document.getElementById("cursorCoords").textContent =
      `Lat: ${e.latlng.lat.toFixed(6)}, Lon: ${e.latlng.lng.toFixed(6)}`;
  });

  // Iniciar
  initData();
})();
