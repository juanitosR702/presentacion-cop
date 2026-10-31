# El viajero invisible

Presentación interactiva sobre los **Compuestos Orgánicos Persistentes (COP)** para 10.º grado. Nueve escenas, cinco bloques y un guion del expositor integrado. El diseño es cinematográfico nocturno: azul profundo, retícula técnica, datos luminosos, tipografía Montserrat + Inter y citas en serif.

**Duración objetivo:** 18–20 minutos.
**Formato:** 16:9, lienzo base de 1920 × 1080. Reveal.js escala la presentación a la ventana.

## Cómo abrirla

No requiere instalación ni compilación. Las librerías se cargan por CDN, así que la primera apertura necesita internet.

```bash
cd presentacion-cop
python -m http.server 8123
```

Abrir <http://localhost:8123/index.html>. Si el puerto está ocupado, usar otro, por ejemplo `python -m http.server 8080`.

También se puede abrir `index.html` con doble clic, pero se recomienda el servidor local para que las rutas de `assets/` funcionen igual en todos los navegadores. Para presentar, pulsar **F** (pantalla completa) y luego **S** para abrir el guion.

## Controles

| Acción | Cómo |
| --- | --- |
| Avanzar / retroceder | `←` `→`, `Espacio`, botones de flecha del HUD |
| Abrir o cerrar el guion | `S` o el botón **Guion** |
| Abrir o cerrar el mapa de escenas | `M` o el botón **Mapa** |
| Pantalla completa | `F` o el botón de la esquina superior derecha |
| Cerrar paneles | `Esc` |
| Reiniciar | Botón **Volver al inicio** en la escena 09 |
| Pausar o reanudar la secuencia de características | Botón **Pausar / Reanudar** en la escena 04. Un clic en una tarjeta también detiene la secuencia. |

El panel de guion muestra las notas de la escena actual. Cada escena tiene notas en español pensadas para el docente; no se proyectan al público.

## Mapa de escenas

| # | Escena | Bloque | Qué ocurre | Tiempo |
| --- | --- | --- | --- | --- |
| 01 | El viajero invisible | 01 · Apertura | Hero con mapa y partículas. El recorrido y la lectura del sensor se activan al entrar; el botón permite repetirlo. | 2 min |
| 02 | No necesita pasaporte | 01 · Apertura | Tres rutas de transporte a larga distancia. Se animan al entrar; las tarjetas permiten reproducir cada ruta por separado. | 1 min |
| 03 | No es un veneno cualquiera | 02 · Características | Definición de COP y simulador **Sol UV / Agua / Bacterias**. La secuencia de resistencia comienza al entrar; también se puede probar cada ataque. | 2 min |
| 04 | Cuatro propiedades. Un mismo destino | 02 · Características | Cuatro tarjetas clicables (persistencia, bioacumulación, toxicidad, movilidad) con ilustraciones SVG animadas. La secuencia avanza sola cada 10 s; el botón **Pausar** la detiene y **Repetir** la reinicia. | 2 min |
| 05 | La docena sucia | 03 · Origen | Doce fichas de los COP originales. Las tres rutas de entrada abren un detalle; el enlace lleva al caso DDT. | 2 min |
| 06 | El caso DDT: la prueba estaba en la cáscara | 03 · Origen | Línea de tiempo 1947–1972 con grosor de cáscara relativo. La secuencia se reproduce al entrar; el deslizador permite explorar y el botón repetirla. | 2 min |
| 07 | La cima paga la cuenta | 04 · Simulador | Pirámide trófica de cinco niveles. La dosis recorre la cadena al entrar; los controles permiten explorar los niveles o repetir la secuencia. | 4–5 min |
| 08 | El mundo dijo basta | 05 · Tratado | Mapa de partes, hitos del Convenio de Estocolmo y checklist de cuatro acciones locales con contador. | 2 min |
| 09 | Lo que vuelve | 05 · Cierre | Cierre con la muestra ártica, fuentes y botón de reinicio. Cierra el relato con la pregunta inicial. | 1 min |

Los tiempos son una guía; el mapa de escenas del propio deck también los muestra. Si hay poco tiempo, se pueden saltar escenas completas con las flechas y usar los controles manuales para explorar solo los datos que hagan falta.

## Contenido y datos clave

- **Definición:** sustancia orgánica, tóxica y resistente a la degradación; muchos COP están halogenados y son lipofílicos.
- **Cuatro características:** persistencia, bioacumulación, toxicidad y movilidad.
- **Docena Sucia:** aldrín, clordano, DDT, dieldrín, endrín, heptacloro, hexaclorobenceno, mirex, toxafeno, PCBs, dioxinas y furanos.
- **Tres rutas de entrada:** plaguicidas (8), industriales (2) y accidentales (2).
- **DDT:** se degrada a DDE, más persistente; interfiere con el transporte de calcio y adelgaza la cáscara de las aves. El Convenio lo restringe, no lo prohíbe en todos los usos: permite el control de malaria bajo lineamientos de la OMS.
- **Biomagnificación:** factores ilustrativos de 1×, 10×, 100×, 1.000× y 10.000× desde el agua hasta el depredador ápice.
- **Convenio de Estocolmo:** adoptado el 22 de mayo de 2001, en vigor desde el 17 de mayo de 2004. La presentación muestra 186 partes (185 Estados + Unión Europea) y más de 30 sustancias listadas.

## Archivos

```
presentacion-cop/
├── index.html          # 9 escenas, HUD, guion y mapa de escenas
├── styles.css          # sistema visual base, componentes y responsive
├── styles-cine.css     # capa de dirección de arte cinematográfica nocturna
├── app.js              # Reveal, Anime.js e interacciones
├── README.md
└── assets/
    ├── world-map.svg   # mapa estilizado para el hero y el tratado
    └── ratify-dots.svg # capa de puntos de ratificación
```

Todos los gráficos son SVG o CSS; no hay imágenes de mapa de bits, clipart ni emojis. Las animaciones se hacen con transformaciones y opacidad.

## Notas y límites

- **Datos para clase, no para auditoría:** las cifras de partes y sustancias corresponden a lo que muestra el deck. Conviene verificarlas antes de reutilizarlo en otro contexto o año.
- **Mapa estilizado:** no es una proyección cartográfica exacta ni una prueba legal de ratificación. Los puntos y las cruces son una lectura didáctica.
- **Modelos didácticos:** el grosor de la cáscara del DDT es un índice relativo, no una medición; los factores de biomagnificación son ilustrativos y varían según el compuesto, la especie y el ecosistema.
- **Secuencias automáticas:** los recorridos y demostraciones se activan al entrar en su escena. Se pueden repetir o explorar con los controles disponibles; la secuencia de características recorre las cuatro tarjetas en 30 segundos (10 s por tarjeta). Con la preferencia del sistema «reducir movimiento», se omite el movimiento automático y se ocultan los controles de reproducción automática.
- **CDN:** Reveal.js 6.0.2, Anime.js 4.5.0 y las fuentes se cargan desde internet. Para usar la presentación sin conexión, hay que descargar esas dependencias y actualizar las referencias en `index.html`, `styles.css` y `styles-cine.css`.
- **Pantallas pequeñas:** el diseño está pensado para proyector o laptop 16:9. Revel lo escala, pero los textos pequeños del HUD y de las fichas pueden perder legibilidad en un teléfono.
- **Guion:** las notas están en el HTML de cada escena. Si se edita una escena, conviene actualizar también sus notas.

## Fuentes

- PNUMA — Convenio de Estocolmo sobre Contaminantes Orgánicos Persistentes: <https://www.pops.int>
- Organización Mundial de la Salud — dioxinas y sus efectos en la salud: <https://www.who.int/es/news-room/fact-sheets/detail/dioxins-and-their-effects-on-human-health>
- US EPA — Persistent Organic Pollutants: A Global Issue, A Global Response: <https://www.epa.gov/international-cooperation/persistent-organic-pollutants-global-issue-global-response>
- AMAP — Arctic Monitoring and Assessment Programme, informes sobre COP en el Ártico: <https://www.amap.no>

---

Presentación elaborada como material educativo. Las interacciones están pensadas para acompañar la explicación, no para reemplazarla.
