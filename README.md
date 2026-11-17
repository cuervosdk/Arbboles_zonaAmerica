# Visor GIS Arbóreo — Proyecto Zona América

Visor cartográfico web estático desarrollado para la consulta, filtrado y visualización espacial del inventario forestal del proyecto **Zona América** (324 individuos arbóreos georreferenciados en WGS84).

## Características principales

- **Capas base intercambiables**:
  - **Satelital** (Esri World Imagery)
  - **Híbrido** (Satelital + etiquetas de calles y lugares)
  - **Callejero** (OpenStreetMap)
  - **Claro** (CartoDB Positron)
- **Filtrado y resaltado de árboles a talar**:
  - Filtro rápido entre **Todos (324)**, **Tala (91)** y **Conservación - Poda (233)**.
  - **Modo "Resaltar árboles a talar"**: destaca con halo pulsante rojo y mayor tamaño los 91 individuos propuestos para tala y atenúa visualmente los de conservación.
  - Filtros combinables por **Estado fitosanitario**, **Especie / Nombre común**, **Altura mínima (m)** y **Búsqueda instantánea** por ID o nombre.
- **Tabla de atributos interactiva y exportación**:
  - Clic sobre cualquier fila de la tabla para acercar el mapa (`flyTo`) y abrir la ficha técnica del árbol.
  - Descarga directa de los registros filtrados en formato **CSV** o **GeoJSON**.

## Estructura de archivos

```text
visor-gis-zona-america/
├── index.html             # Interfaz principal del visor GIS
├── css/
│   └── styles.css         # Estilos responsivos y simbología
├── js/
│   └── app.js             # Lógica de mapa (Leaflet), filtros y exportación
├── data/
│   ├── arboles.geojson    # Capa vectorial estándar (compatible con QGIS/AutoCAD Map)
│   └── arboles_data.js    # Datos embebidos para ejecución sin servidor (file://)
└── README.md
```
