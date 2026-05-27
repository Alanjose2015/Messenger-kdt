const TELEFONO_KDT = "5493815555555"; 
const PRECIO_BASE = 400;              
const PRECIO_POR_KM = 250;            

let mapa = null;
let marcadorOrigen = null;
let marcadorDestino = null;
let libreriasCargadas = false;

// 1. FUNCIÓN CLAVE: Inyecta los archivos del mapa en paralelo sin trabar la apertura de la app
function cargarLibreriasMapas() {
    return new Promise((resolve) => {
        if (typeof L !== 'undefined') return resolve();

        // Cargar CSS de Leaflet de forma asíncrona
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com';
        document.head.appendChild(link);

        // Cargar Script JS de Leaflet de forma asíncrona
        const script = document.createElement('script');
        script.src = 'https://unpkg.com';
        script.onload = () => {
            libreriasCargadas = true;
            resolve();
        };
        script.onerror = () => resolve(false); // Manejo silencioso si no hay red
        document.body.appendChild(script);
    });
}

// 2. Inicialización ultra veloz
async function inicializarApp() {
    // Escuchar cambios desde el segundo cero (la interfaz ya es interactiva)
    vincularEventosInputs();
    calcularTarifaManual(); // Deja el botón listo con precio estimado base de inmediato

    // Descargar el mapa de fondo mientras el usuario lee o escribe
    await cargarLibreriasMapas();

    if (typeof L === 'undefined') {
        activarContingenciaSeguimiento();
        return;
    }

    try {
        const coordsCentro = [-26.82414, -65.22260];
        mapa = L.map('map-container', { fadeAnimation: true, zoomAnimation: true }).setView(coordsCentro, 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(mapa);

        marcadorOrigen = L.marker(coordsCentro).addTo(mapa);
        marcadorDestino = L.marker(coordsCentro).addTo(mapa);

        const textoEstado = document.getElementById('estado-mapa');
        if (textoEstado) textoEstado.textContent = "📍 Mapa en vivo listo.";

        calcularRutaYPrecio();
    } catch (e) {
        activarContingenciaSeguimiento();
    }
}

function vincularEventosInputs() {
    const inputOrigen = document.getElementById('origen');
    const inputDestino = document.getElementById('destino');
    if (inputOrigen) inputOrigen.addEventListener('change', calcularRutaYPrecio);
    if (inputDestino) inputDestino.addEventListener('change', calcularRutaYPrecio);
}

// Cálculo instantáneo local por si las llamadas de red tardan
function calcularTarifaManual() {
    const actualPrecioElement = document.getElementById('precioEstimado');
    if (actualPrecioElement && actualPrecioElement.textContent === "$0") {
        actualPrecioElement.textContent = `$${PRECIO_BASE}`;
    }
    const txtOrigen = document.getElementById('origen').value.trim();
    const txtDestino = document.getElementById('destino').value.trim();
    actualizarEnlaceWhatsApp(txtOrigen, txtDestino, PRECIO_BASE);
}

// Geocodificación rápida optimizada
async function buscarCoordenadas(direccion) {
    if (!direccion) return null;
    try {
        // Petición con límite de tiempo corto para que no quede la app colgada esperando
        const controladorTiempo = new AbortController();
        setTimeout(() => controladorTiempo.abort(), 4000); 

        const url = `https://openstreetmap.org{encodeURIComponent(direccion + ', San Miguel de Tucumán')}&limit=1`;
        const respuesta = await fetch(url, { signal: controladorTiempo.signal });
        const datos = await respuesta.json();
        if (datos && datos.length > 0) {
            return [parseFloat(datos.lat), parseFloat(datos.lon)];
        }
    } catch (error) {
        console.warn("Búsqueda lenta o cancelada:", error);
    }
    return null;
}

async function calcularRutaYPrecio() {
    const txtOrigen = document.getElementById('origen').value.trim();
    const txtDestino = document.getElementById('destino').value.trim();
    const actualPrecioElement = document.getElementById('precioEstimado');
    const textoEstado = document.getElementById('estado-mapa');

    if (!txtOrigen || !txtDestino) return;

    if (!mapa || typeof L === 'undefined') {
        calcularTarifaManual();
        return;
    }

    if (textoEstado) textoEstado.textContent = "🔍 Midiendo distancia...";

    const coordsOrigen = await buscarCoordenadas(txtOrigen);
    const coordsDestino = await buscarCoordenadas(txtDestino);

    if (coordsOrigen && coordsDestino) {
        marcadorOrigen.setLatLng(coordsOrigen);
        marcadorDestino.setLatLng(coordsDestino);
        mapa.fitBounds(L.latLngBounds([coordsOrigen, coordsDestino]), { padding: [30, 30] });

        const distanciaKm = (mapa.distance(coordsOrigen, coordsDestino)) / 1000;
        const costoFinal = Math.round(PRECIO_BASE + (distanciaKm * PRECIO_POR_KM));

        if (actualPrecioElement) actualPrecioElement.textContent = `$${costoFinal}`;
        if (textoEstado) textoEstado.textContent = `Distancia: ${distanciaKm.toFixed(2)} km.`;

        actualizarEnlaceWhatsApp(txtOrigen, txtDestino, costoFinal);
    } else {
        if (textoEstado) textoEstado.textContent = "⚠ Ajustando precio estimado estándar...";
        calcularTarifaManual();
    }
}

function activarContingenciaSeguimiento() {
    const btnContingencia = document.getElementById('btn-contingencia-seguimiento');
    const textoEstado = document.getElementById('estado-mapa');
    if (textoEstado) textoEstado.textContent = "⚠ Conexión lenta. Gestión manual activa.";
    if (btnContingencia) btnContingencia.style.display = "block";

    btnContingencia.onclick = function() {
        const txtOrigen = document.getElementById('origen').value.trim() || "No especificado";
        const txtDestino = document.getElementById('destino').value.trim() || "No especificado";
        const mensaje = `Hola Messenger KDT, la red está lenta. 📲\n\n¿Me confirman cobertura y seguimiento?\n📍 *Desde:* ${txtOrigen}\n📍 *Hacia:* ${txtDestino}`;
        window.open(`https://wa.me{TELEFONO_KDT}?text=${encodeURIComponent(mensaje)}`, '_blank');
    };
}

function actualizarEnlaceWhatsApp(origen, destino, costo) {
    const botonWhatsApp = document.getElementById('btn-whatsapp');
    if (!botonWhatsApp) return;

    const formatoMensaje = `Hola Messenger KDT, quiero solicitar un cadete y coordinar el pago. 🏍\n\n` +
                           `🛫 *Origen (Retiro):* ${origen}\n` +
                           `🛬 *Destino (Entrega):* ${destino}\n\n` +
                           `💵 *Costo Estimado:* $${costo}\n\n` +
                           `Por favor, envíenme la información de pago correspondiente.`;

    botonWhatsApp.onclick = () => {
        window.open(`https://wa.me{TELEFONO_KDT}?text=${encodeURIComponent(formatoMensaje)}`, '_blank');
    };
}

// Disparar la inicialización en cuanto el navegador procese el HTML estructural
document.addEventListener("DOMContentLoaded", inicializarApp);
