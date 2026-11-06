// CONFIGURACIÓN SUPABASE
const SUPABASE_URL = "https://yawuxgvsztxagetmvmqs.supabase.co";
const SUPABASE_KEY = "sb_publishable_4ntuoV-tjtmto4ZHlxbJrg_CMPcCI0X";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// CÓDIGOS VIP VÁLIDOS (Para cortesías o fundadores)
const CODIGOS_VIP_VALIDOS = ["VENLEAL"];

let productosGlobales = [];
let categoriaActual = 'todos';
let filtroVendedorUrl = null;
let bloqueadoRateLimit = false;
let productoChatActualId = null;
let vendedorActualCalificacion = '';

let gestionProdId = null;
let gestionPinReal = '';
let gestionVendedorNombre = '';

// 🛡️ Sanitización anti-XSS
function sanitizarEntrada(texto) {
    if (typeof texto !== 'string') return '';
    return texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .trim();
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const vendedorQuery = urlParams.get('vendedor');

    if (vendedorQuery) {
        filtroVendedorUrl = sanitizarEntrada(vendedorQuery);
        mostrarBannerVendedor(filtroVendedorUrl);
    }

    cargarProductos();
    actualizarContadorFavoritos();
    
    const nombreGuardado = localStorage.getItem('tianguis_mi_nombre');
    if (nombreGuardado) {
        const inputRemitente = document.getElementById('chatInputRemitente');
        if (inputRemitente) inputRemitente.value = nombreGuardado;
    }
});

function mostrarBannerVendedor(vendedor) {
    const banner = document.getElementById('bannerVendedorActivo');
    const txt = document.getElementById('txtVendedorFiltrado');
    if (banner && txt) {
        txt.innerText = `🏪 Viendo puesto de: ${vendedor}`;
        banner.classList.remove('hidden');
    }
}

function limpiarFiltroVendedor() {
    filtroVendedorUrl = null;
    const banner = document.getElementById('bannerVendedorActivo');
    if (banner) banner.classList.add('hidden');
    
    window.history.pushState({}, document.title, window.location.pathname);
    renderizarProductos(productosGlobales);
}

// Cargar productos desde Supabase
async function cargarProductos() {
    const badgeCount = document.getElementById('product-count');

    try {
        const { data, error } = await db
            .from('productos')
            .select('*');

        if (error) {
            console.error("Error al cargar:", error.message);
            return;
        }

        const listaCruda = data || [];
        productosGlobales = listaCruda.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        if (badgeCount) badgeCount.textContent = `${productosGlobales.length} artículos`;
        renderizarProductos(productosGlobales);
        abrirModalFavoritos();

    } catch (err) {
        console.error("Excepción:", err);
    }
}

// ==========================================
// SISTEMA DE FAVORITOS (GUARDADOS)
// ==========================================
function obtenerFavoritos() {
    const favs = localStorage.getItem('tianguis_favoritos');
    return favs ? JSON.parse(favs) : [];
}

function toggleFavorito(id) {
    let favs = obtenerFavoritos();
    const index = favs.indexOf(id);

    if (index === -1) {
        favs.push(id);
        alert("❤️ ¡Producto guardado en tus Favoritos!");
    } else {
        favs.splice(index, 1);
        alert("🗑️ Producto removido de tus Favoritos.");
    }

    localStorage.setItem('tianguis_favoritos', JSON.stringify(favs));
    actualizarContadorFavoritos();
    renderizarProductos(productosGlobales);
    abrirModalFavoritos();
}

function actualizarContadorFavoritos() {
    const favs = obtenerFavoritos();
    const badge = document.getElementById('favoritos-count');
    if (badge) {
        badge.innerText = `${favs.length} artículos`;
    }
}

function abrirModalFavoritos() {
    const favIds = obtenerFavoritos();
    const productosFavs = productosGlobales.filter(p => favIds.includes(p.id));
    
    const container = document.getElementById('favoritosListaContainer');
    if (!container) return;

    actualizarContadorFavoritos();

    if (productosFavs.length === 0) {
        container.innerHTML = `<p class="text-center text-xs text-slate-400 py-8">Aún no has guardado productos en tu lista. Presiona el ❤️ en cualquier producto para guardarlo aquí.</p>`;
    } else {
        container.innerHTML = '';
        productosFavs.forEach(prod => {
            const precioLimpio = parseFloat(prod.precio).toFixed(2);
            const tituloLimpio = sanitizarEntrada(prod.titulo);
            const vendedorLimpio = sanitizarEntrada(prod.vendedor || 'Tianguis Local');
            const telefono = prod.telefono || prod.numero || '';

            let fotosArray = [];
            if (prod.fotos) {
                if (Array.isArray(prod.fotos)) {
                    fotosArray = prod.fotos;
                } else if (typeof prod.fotos === 'string' && prod.fotos.trim() !== '') {
                    fotosArray = prod.fotos.split(',').map(f => f.trim());
                }
            }
            if (fotosArray.length === 0 && prod.foto) {
                fotosArray.push(prod.foto);
            }
            const fotoPrincipal = fotosArray.length > 0 ? fotosArray[0] : '';
            let miniaturaHtml = fotoUrlValida(fotoPrincipal) ? `<img src="${fotoPrincipal}" class="w-12 h-12 object-cover rounded-xl shrink-0">` : `<div class="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-lg shrink-0">🛍️</div>`;

            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-2xl gap-2 shadow-sm';
            item.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden">
                    ${miniaturaHtml}
                    <div class="flex flex-col overflow-hidden">
                        <span class="font-bold text-xs text-slate-800 truncate">${tituloLimpio}</span>
                        <span class="text-[10px] text-slate-500 truncate">👤 ${vendedorLimpio}</span>
                        <span class="text-xs font-extrabold text-red-600">$${precioLimpio} MXN</span>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="contactarWhatsApp('${telefono}', '${tituloLimpio}', '${precioLimpio}', '${prod.id}')" class="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-sm">
                        <i class="fa-brands fa-whatsapp"></i>
                    </button>
                    <button onclick="toggleFavorito(${prod.id})" class="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-2.5 py-2 rounded-xl">
                        ✕
                    </button>
                </div>
            `;
            container.appendChild(item);
        });
    }
}

// Renderizar productos con botón de Favoritos
function renderizarProductos(lista) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';

    let listaFiltrada = lista;

    if (filtroVendedorUrl) {
        listaFiltrada = listaFiltrada.filter(p => (p.vendedor || '').toLowerCase() === filtroVendedorUrl.toLowerCase());
    }

    if (listaFiltrada.length === 0) {
        grid.innerHTML = `<p class="col-span-2 text-center text-xs text-slate-400 py-8">No hay productos disponibles aquí.</p>`;
        return;
    }

    const favsGuardados = obtenerFavoritos();

    listaFiltrada.forEach(prod => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-2xl p-2.5 space-y-2 border border-slate-200 shadow-sm flex flex-col justify-between relative';

        const tituloLimpio = sanitizarEntrada(prod.titulo);
        const vendedorLimpio = sanitizarEntrada(prod.vendedor || 'Tianguis Local');
        const precioLimpio = parseFloat(prod.precio).toFixed(2);
        const puntoLimpio = sanitizarEntrada(prod.punto_entrega || 'Centro');
        const descripcionLimpia = sanitizarEntrada(prod.descripcion || '');
        const pinSeguro = prod.pin ? prod.pin.toString() : '';
        const telefonoVendedor = prod.telefono || prod.numero || '';

        const esFavorito = favsGuardados.includes(prod.id);

        let fotosArray = [];
        if (prod.fotos) {
            if (Array.isArray(prod.fotos)) {
                fotosArray = prod.fotos;
            } else if (typeof prod.fotos === 'string' && prod.fotos.trim() !== '') {
                fotosArray = prod.fotos.split(',').map(f => f.trim());
            }
        }
        if (fotosArray.length === 0 && prod.foto) {
            fotosArray.push(prod.foto);
        }

        const fotoPrincipal = fotosArray.length > 0 ? fotosArray[0] : '';

        let contenidoImagen = `<div class="bg-slate-100 h-32 rounded-xl w-full flex items-center justify-center text-3xl">🛍️</div>`;
        if (fotoUrlValida(fotoPrincipal)) {
            const fotosJsonStr = JSON.stringify(fotosArray).replace(/"/g, '&quot;');
            contenidoImagen = `
                <div class="h-32 rounded-xl w-full overflow-hidden bg-slate-100 cursor-pointer relative group" onclick="abrirModalZoom(${fotosJsonStr})">
                    <img src="${fotoPrincipal}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onerror="this.parentElement.innerHTML='🛍️'">
                    <div class="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                        <i class="fa-solid fa-magnifying-glass-plus"></i> Ver más
                    </div>
                </div>`;
        }

        const elementoDescripcion = descripcionLimpia 
            ? `<p class="text-[10px] text-slate-600 mt-1 line-clamp-2">📝 ${descripcionLimpia}</p>` 
            : '';

        card.innerHTML = `
            <!-- Botón de Favorito flotante -->
            <button onclick="toggleFavorito(${prod.id})" class="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm p-1.5 rounded-full shadow hover:scale-110 transition-all text-xs">
                ${esFavorito ? '❤️' : '🤍'}
            </button>

            <div>
                ${contenidoImagen}
                <div class="mt-2">
                    <button onclick="filtrarPorVendedorDirecto('${vendedorLimpio}')" class="text-[9px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1 transition-all">
                        👤 ${vendedorLimpio} <i class="fa-solid fa-share-nodes text-[8px] text-slate-400"></i>
                    </button>
                    <h4 class="font-bold text-xs text-slate-800 line-clamp-1 mt-1">${tituloLimpio}</h4>
                    <p class="text-[10px] text-slate-500 mt-0.5">📍 ${puntoLimpio}</p>
                    ${elementoDescripcion}
                </div>
            </div>
            <div>
                <div class="flex items-center justify-between mt-1 mb-2">
                    <span class="text-xs font-extrabold text-red-600">$${precioLimpio} <small class="text-[9px]">MXN</small></span>
                </div>
                <!-- 4 BOTONES ORGANIZADOS EN DOS FILAS -->
                <div class="grid grid-cols-2 gap-1">
                    <button onclick="contactarWhatsApp('${telefonoVendedor}', '${tituloLimpio}', '${precioLimpio}', '${prod.id}')" class="bg-green-500 hover:bg-green-600 text-white font-bold text-[10px] py-1.5 px-1 rounded-lg text-center flex items-center justify-center gap-1 shadow-sm">
                        <i class="fa-brands fa-whatsapp text-xs"></i> WhatsApp
                    </button>
                    <button onclick="abrirModalChat(${prod.id}, '${tituloLimpio}')" class="bg-red-500 hover:bg-red-600 text-white font-bold text-[10px] py-1.5 px-1 rounded-lg text-center flex items-center justify-center gap-1 shadow-sm">
                        <i class="fa-solid fa-comments text-xs"></i> Chat Plaza
                    </button>
                    <button onclick="abrirModalCalificar('${vendedorLimpio}')" class="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-bold text-[10px] py-1.5 px-1 rounded-lg text-center flex items-center justify-center gap-1 shadow-sm">
                        <i class="fa-solid fa-star text-xs"></i> Reseña
                    </button>
                    <button onclick="abrirModalGestion('${prod.id}', '${pinSeguro}', '${vendedorLimpio}')" class="bg-slate-100 text-slate-700 font-bold text-[10px] py-1.5 px-1 rounded-lg hover:bg-slate-200 text-center flex items-center justify-center gap-1">
                        ⚙️ Puesto
                    </button>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });
}

// Contactar por WhatsApp Directo + Registro de Analítica en Supabase
async function contactarWhatsApp(telefono, titulo, precio, productoId) {
    if (!telefono || telefono.trim() === '') {
        const telManual = prompt(`Escribe el número de WhatsApp del vendedor para contactarlo por "${titulo}":`);
        if (telManual) {
            telefono = telManual.replace(/[^0-9]/g, '');
        } else {
            return;
        }
    }

    const numLimpio = telefono.toString().replace(/[^0-9]/g, '');
    const numFinal = numLimpio.length === 10 ? `52${numLimpio}` : numLimpio;

    // Registrar el clic en Supabase en segundo plano
    try {
        await db.from('clics_whatsapp').insert([
            {
                vendedor_telefono: numFinal,
                producto_id: productoId ? productoId.toString() : null,
                origen: 'plaza_digital_web'
            }
        ]);
    } catch (err) {
        console.error("Error registrando clic de WhatsApp:", err);
    }

    const mensaje = encodeURIComponent(`¡Hola! Vi tu producto "${titulo}" ($${precio} MXN) en Plaza Digital y me interesa adquirirlo.`);
    window.open(`https://wa.me/${numFinal}?text=${mensaje}`, '_blank');
}

function filtrarPorVendedorDirecto(vendedor) {
    filtroVendedorUrl = vendedor;
    mostrarBannerVendedor(vendedor);
    
    const urlCompartible = `${window.location.origin}${window.location.pathname}?vendedor=${encodeURIComponent(vendedor)}`;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(urlCompartible);
        alert(`🏪 Viendo solo el puesto de "${vendedor}".\n\n✨ ¡Copiamos el enlace directo a tu portapapeles para compartirlo en WhatsApp!`);
    } else {
        alert(`🏪 Viendo solo el puesto de "${vendedor}".`);
    }

    renderizarProductos(productosGlobales);
}

function fotoUrlValida(url) {
    return url && typeof url === 'string' && url.startsWith('http');
}

// Subir de 1 a 3 imágenes a Supabase Storage
async function subirMultiplesImagenes(inputFiles) {
    if (!inputFiles || inputFiles.length === 0) return [];

    const urlsImagenes = [];
    const archivos = Array.from(inputFiles).slice(0, 3);

    for (const archivo of archivos) {
        const nombreUnico = `${Date.now()}_${Math.random().toString(36).substring(7)}_${archivo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        
        const { data, error } = await db.storage
            .from('productos')
            .upload(nombreUnico, archivo, { cacheControl: '3600', upsert: false });

        if (error) {
            console.error("Error al subir imagen:", error.message);
            continue;
        }

        const { data: publicUrlData } = db.storage
            .from('productos')
            .getPublicUrl(nombreUnico);

        if (publicUrlData && publicUrlData.publicUrl) {
            urlsImagenes.push(publicUrlData.publicUrl);
        }
    }

    return urlsImagenes;
}

// 🔐 SISTEMA DE VERIFICACIÓN DE PASES EN SUPABASE
async function verificarPaseEnBaseDatos(telefono) {
    if (!telefono) return false;
    
    const numeroLimpio = telefono.toString().replace(/[^0-9]/g, '');
    const fechaHoy = new Date().toISOString();

    try {
        const { data, error } = await db
            .from('pases-vendedores')
            .select('*')
            .eq('telefono', numeroLimpio)
            .gte('fecha_vencimiento', fechaHoy)
            .maybeSingle();

        if (error) {
            console.error("Error al consultar pase:", error.message);
            return false;
        }

        return data ? true : false;
    } catch (err) {
        console.error("Excepción al verificar pase:", err);
        return false;
    }
}

function intentarPublicarPuesto() {
    abrirModalPublicar();
}

function abrirModalCanjeVIP() {
    document.getElementById('modalCanjeVIP').classList.remove('hidden');
}

function cerrarModalCanjeVIP() {
    document.getElementById('modalCanjeVIP').classList.add('hidden');
}

function validarCodigoVIP() {
    const input = document.getElementById('inputCodigoVIP');
    if (!input) return;

    const codigo = input.value.trim().toUpperCase();

    if (CODIGOS_VIP_VALIDOS.includes(codigo)) {
        alert("⭐ ¡Código VIP Válido!\n\nPara fundadores y cortesías, por favor contacta al administrador para registrar tu número directo en la base de datos con tu semana gratis.");
        cerrarModalCanjeVIP();
    } else {
        alert("❌ Código Promocional No Válido. Verifica con el administrador.");
    }
}

function comprarPase(tipo, precio) {
    const tuNumeroWhatsApp = "525514325463"; 
    const mensaje = encodeURIComponent(`Hola Admin, deseo adquirir el Pase ${tipo.toUpperCase()} ($${precio} MXN) para Plaza Digital. Adjunto mi comprobante de transferencia.`);
    window.open(`https://wa.me/${tuNumeroWhatsApp}?text=${mensaje}`, '_blank');
}

// Publicar producto con validación estricta en Supabase
async function publicarProducto() {
    const btn = document.getElementById('btnPublicar');

    if (bloqueadoRateLimit) {
        alert("⚠️ Por seguridad, espera unos segundos antes de publicar de nuevo.");
        return;
    }

    const telefono = sanitizarEntrada(document.getElementById('prodTel').value);
    
    if (!telefono || telefono.length !== 10) {
        alert("⚠️ Ingresa un número de WhatsApp válido a 10 dígitos para validar tu pase.");
        return;
    }

    const paseActivoBD = await verificarPaseEnBaseDatos(telefono);
    if (!paseActivoBD) {
        const deseaRenovar = confirm("🔒 Tu pase ha expirado o el número no cuenta con un pase activo en la base de datos.\n\n¿Deseas abrir WhatsApp para contactar al administrador y renovarlo?");
        
        if (deseaRenovar) {
            const tuNumeroWhatsApp = "525514325463"; 
            const mensaje = encodeURIComponent("Hola Admin, mi pase ha expirado o no está activo y deseo renovarlo para seguir publicando en Plaza Digital.");
            window.open(`https://wa.me/${tuNumeroWhatsApp}?text=${mensaje}`, '_blank');
        }

        cerrarModalPublicar();
        switchTab('passes');
        return;
    }

    const vendedor = sanitizarEntrada(document.getElementById('prodVendedor').value);
    const pin = sanitizarEntrada(document.getElementById('prodPin').value);
    const titulo = sanitizarEntrada(document.getElementById('prodTitulo').value);
    const precio = parseFloat(document.getElementById('prodPrecio').value);
    const categoria = document.getElementById('prodCategoria').value;
    const punto = sanitizarEntrada(document.getElementById('prodPunto').value);
    const descripcion = sanitizarEntrada(document.getElementById('prodDescripcion').value);
    
    const inputFile = document.getElementById('prodFotoFile');
    const archivosFotos = inputFile && inputFile.files ? inputFile.files : null;

    if (!vendedor || !pin || pin.length !== 4 || !titulo || isNaN(precio) || precio <= 0 || !punto) {
        alert("⚠️ Completa todos los campos obligatorios y un PIN de 4 números.");
        return;
    }

    bloqueadoRateLimit = true;
    if (btn) {
        btn.disabled = true;
        btn.innerText = "Subiendo a la nube...";
    }

    try {
        let urlsFotos = [];
        if (archivosFotos && archivosFotos.length > 0) {
            urlsFotos = await subirMultiplesImagenes(archivosFotos);
        }

        const { error } = await db.from('productos').insert([
            { 
                vendedor,
                telefono, 
                pin, 
                titulo, 
                precio, 
                categoria, 
                punto_entrega: punto, 
                descripcion: descripcion,
                fotos: urlsFotos.join(','),
                foto: urlsFotos[0] || ''  
            }
        ]);

        if (error) {
            alert("Error al publicar: " + error.message);
        } else {
            alert(`¡Tu puesto "${titulo}" ya está publicado! 🎪✨\n\n🔑 Recuerda tu PIN: ${pin}`);
            document.getElementById('publishForm').reset();
            cerrarModalPublicar();
            cargarProductos();
        }
    } catch (err) {
        console.error("Error al publicar:", err);
    } finally {
        setTimeout(() => {
            bloqueadoRateLimit = false;
            if (btn) {
                btn.disabled = false;
                btn.innerText = "🔒 Publicar con Seguridad";
            }
        }, 3000);
    }
}

// ⚙️ FUNCIONES DE GESTIÓN DE PUESTO / MODAL
function abrirModalGestion(id, pin, vendedor) {
    gestionProdId = id;
    gestionPinReal = pin;
    gestionVendedorNombre = vendedor;

    document.getElementById('gestionTituloVendedor').innerText = `Puesto de: ${vendedor}`;
    document.getElementById('inputPinGestion').value = '';
    document.getElementById('modalGestionPuesto').classList.remove('hidden');
}

function cerrarModalGestion() {
    document.getElementById('modalGestionPuesto').classList.add('hidden');
    gestionProdId = null;
    gestionPinReal = '';
    gestionVendedorNombre = '';
}

async function procesarAccionGestion(tipo) {
    const inputPin = document.getElementById('inputPinGestion').value.trim();

    if (!gestionPinReal || inputPin !== gestionPinReal) {
        alert("❌ PIN Incorrecto. Necesitas ingresar el PIN de 4 dígitos de este puesto.");
        return;
    }

    if (tipo === 'vendido' || tipo === 'eliminar') {
        const { error } = await db.from('productos').delete().eq('id', gestionProdId);
        if (!error) {
            alert(tipo === 'vendido' ? "🎉 ¡Felicidades por tu venta! Tu puesto fue retirado." : "🗑️ Producto eliminado.");
            cerrarModalGestion();
            cargarProductos();
        } else {
            alert("Error: " + error.message);
        }
    } else if (tipo === 'link') {
        const urlMiTienda = `${window.location.origin}${window.location.pathname}?vendedor=${encodeURIComponent(gestionVendedorNombre)}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(urlMiTienda);
            alert(`🔗 Tu link de vendedor es:\n${urlMiTienda}\n\n¡Copiado a tu portapapeles! Pégalo en WhatsApp.`);
        } else {
            alert(`🔗 Tu link de vendedor es:\n${urlMiTienda}`);
        }
        cerrarModalGestion();
    }
}

// Zoom de imágenes
function abrirModalZoom(fotos) {
    const modal = document.getElementById('modalZoom');
    const imgPrincipal = document.getElementById('zoomImagenPrincipal');
    const containerMiniaturas = document.getElementById('zoomMiniaturasContainer');
    
    if (!modal || !imgPrincipal) return;

    const listaFotos = Array.isArray(fotos) ? fotos : [fotos];
    imgPrincipal.src = listaFotos[0];
    containerMiniaturas.innerHTML = '';

    if (listaFotos.length > 1) {
        listaFotos.forEach((url, index) => {
            const miniatura = document.createElement('img');
            miniatura.src = url;
            miniatura.className = `w-14 h-14 object-cover rounded-xl cursor-pointer border-2 ${index === 0 ? 'border-red-500 scale-105' : 'border-white/40'} hover:opacity-100 transition-all`;
            miniatura.onclick = () => {
                imgPrincipal.src = url;
                containerMiniaturas.querySelectorAll('img').forEach(img => img.classList.remove('border-red-500', 'scale-105'));
                miniatura.classList.add('border-red-500', 'scale-105');
            };
            containerMiniaturas.appendChild(miniatura);
        });
    }

    modal.classList.remove('hidden');
}

function cerrarModalZoom() {
    const modal = document.getElementById('modalZoom');
    if (modal) modal.classList.add('hidden');
}

// Chat Interno
function guardarNombreChat(nombre) {
    if (nombre) {
        localStorage.setItem('tianguis_mi_nombre', nombre.trim());
    }
}

async function abrirModalChat(prodId, prodTitulo) {
    productoChatActualId = prodId;
    document.getElementById('chatProductoTitulo').innerText = `Chat: ${prodTitulo}`;
    document.getElementById('modalChat').classList.remove('hidden');
    cargarMensajesChat();
}

function cerrarModalChat() {
    document.getElementById('modalChat').classList.add('hidden');
    productoChatActualId = null;
}

async function cargarMensajesChat() {
    if (!productoChatActualId) return;

    const container = document.getElementById('chatMensajesContainer');
    container.innerHTML = '<p class="text-center text-[11px] text-slate-400 py-4">Cargando mensajes...</p>';

    const miNombre = (localStorage.getItem('tianguis_mi_nombre') || '').trim().toLowerCase();

    const { data, error } = await db
        .from('mensajes')
        .select('*')
        .eq('producto_id', productoChatActualId)
        .order('created_at', { ascending: true });

    if (error) {
        container.innerHTML = `<p class="text-center text-[11px] text-red-400 py-4">Error: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-center text-[11px] text-slate-400 py-4">Sé el primero en preguntar. 😊</p>';
        return;
    }

    container.innerHTML = '';
    data.forEach(m => {
        const remitenteOriginal = m.remitente || 'Interesado';
        const esMio = miNombre && remitenteOriginal.trim().toLowerCase() === miNombre;
        
        const msgWrapper = document.createElement('div');
        msgWrapper.className = `flex flex-col ${esMio ? 'items-end' : 'items-start'}`;

        const hora = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        msgWrapper.innerHTML = `
            <span class="text-[9px] text-slate-400 px-1 mb-0.5">${sanitizarEntrada(remitenteOriginal)}</span>
            <div class="max-w-[80%] p-2.5 rounded-2xl text-xs shadow-sm ${esMio ? 'bg-red-500 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'}">
                <p class="font-medium leading-relaxed">${sanitizarEntrada(m.mensaje)}</p>
                <span class="text-[8px] opacity-70 block text-right mt-1">${hora}</span>
            </div>
        `;
        container.appendChild(msgWrapper);
    });

    container.scrollTop = container.scrollHeight;
}

async function enviarMensajeChat() {
    const inputRemitente = document.getElementById('chatInputRemitente');
    const inputMensaje = document.getElementById('chatInputMensaje');
    
    const remitente = sanitizarEntrada(inputRemitente.value) || 'Interesado';
    const texto = sanitizarEntrada(inputMensaje.value);

    if (!texto || !productoChatActualId) return;

    guardarNombreChat(remitente);
    inputMensaje.value = '';

    const { error } = await db.from('mensajes').insert([
        { producto_id: productoChatActualId, remitente: remitente, mensaje: texto }
    ]);

    if (!error) cargarMensajesChat();
}

// Calificaciones (Reseñas del Vendedor)
async function abrirModalCalificar(vendedorNombre) {
    vendedorActualCalificacion = vendedorNombre;
    document.getElementById('calificaVendedorTitulo').innerText = `Reputación de: ${vendedorNombre}`;
    document.getElementById('modalCalificar').classList.remove('hidden');
    cargarCalificaciones();
}

function cerrarModalCalificar() {
    document.getElementById('modalCalificar').classList.add('hidden');
    vendedorActualCalificacion = '';
}

async function cargarCalificaciones() {
    if (!vendedorActualCalificacion) return;

    const container = document.getElementById('calificacionesContainer');
    container.innerHTML = '<p class="text-center text-[11px] text-slate-400 py-4">Cargando reseñas...</p>';

    const { data, error } = await db
        .from('calificaciones')
        .select('*')
        .eq('vendedor', vendedorActualCalificacion)
        .order('created_at', { ascending: false });

    if (error) {
        container.innerHTML = `<p class="text-center text-[11px] text-red-400 py-4">Error: ${error.message}</p>`;
        return;
    }

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="text-center text-[11px] text-slate-400 py-4">Sin calificaciones aún. ⭐</p>';
        return;
    }

    container.innerHTML = '';
    data.forEach(c => {
        const estrellasTxt = '⭐'.repeat(c.estrellas || 5);
        const reviewDiv = document.createElement('div');
        reviewDiv.className = 'bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm text-xs space-y-1';
        reviewDiv.innerHTML = `
            <div class="flex justify-between items-center text-[10px] text-slate-400">
                <span class="font-bold text-slate-700">👤 ${sanitizarEntrada(c.comprador || 'Comprador')}</span>
                <span class="text-yellow-500 font-bold">${estrellasTxt}</span>
            </div>
            <p class="text-slate-700 font-medium">${sanitizarEntrada(c.comentario)}</p>
        `;
        container.appendChild(reviewDiv);
    });
}

async function enviarCalificacion() {
    const inputComprador = document.getElementById('calificaComprador');
    const selectEstrellas = document.getElementById('calificaEstrellas');
    const inputComentario = document.getElementById('calificaComentario');

    const comprador = sanitizarEntrada(inputComprador.value) || 'Comprador Anónimo';
    const estrellas = parseInt(selectEstrellas.value);
    const comentario = sanitizarEntrada(inputComentario.value);

    if (!comentario || !vendedorActualCalificacion) {
        alert("⚠️ Escribe un comentario sobre tu experiencia.");
        return;
    }

    inputComentario.value = '';

    const { error } = await db.from('calificaciones').insert([
        { vendedor: vendedorActualCalificacion, comprador: comprador, estrellas: estrellas, comentario: comentario }
    ]);

    if (!error) cargarCalificaciones();
}

// Filtros y Pestañas
function filtrarCategoria(cat, elemento) {
    categoriaActual = cat;
    document.querySelectorAll('.categoria-btn').forEach(b => {
        b.classList.remove('bg-red-500', 'text-white', 'shadow-sm');
        b.classList.add('bg-slate-100', 'text-slate-700');
    });
    elemento.classList.add('bg-red-500', 'text-white', 'shadow-sm');
    elemento.classList.remove('bg-slate-100', 'text-slate-700');

    if (cat === 'todos') {
        renderizarProductos(productosGlobales);
    } else {
        const filtrados = productosGlobales.filter(p => p.categoria === cat);
        renderizarProductos(filtrados);
    }
}

function handleSearch() {
    const texto = sanitizarEntrada(document.getElementById('search-input').value.toLowerCase());
    const filtrados = productosGlobales.filter(p => 
        p.titulo.toLowerCase().includes(texto) ||
        (p.vendedor && p.vendedor.toLowerCase().includes(texto)) ||
        p.punto_entrega.toLowerCase().includes(texto) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(texto))
    );
    renderizarProductos(filtrados);
}

function switchTab(tab) {
    const viewFeed = document.getElementById('view-feed');
    const viewPasses = document.getElementById('view-passes');
    const viewFavoritos = document.getElementById('view-favoritos');
    
    const btnFeed = document.getElementById('nav-btn-feed');
    const btnPasses = document.getElementById('nav-btn-passes');
    const btnFavoritos = document.getElementById('nav-btn-favoritos');

    if (viewFeed) viewFeed.classList.add('hidden');
    if (viewPasses) viewPasses.classList.add('hidden');
    if (viewFavoritos) viewFavoritos.classList.add('hidden');

    if (btnFeed) btnFeed.className = "flex flex-col items-center text-xs font-bold text-slate-400";
    if (btnPasses) btnPasses.className = "flex flex-col items-center text-xs font-bold text-slate-400";
    if (btnFavoritos) btnFavoritos.className = "flex flex-col items-center text-xs font-bold text-slate-400";

    if (tab === 'feed') {
        if (viewFeed) viewFeed.classList.remove('hidden');
        if (btnFeed) btnFeed.className = "flex flex-col items-center text-xs font-bold text-red-500";
    } else if (tab === 'favoritos') {
        if (viewFavoritos) viewFavoritos.classList.remove('hidden');
        if (btnFavoritos) btnFavoritos.className = "flex flex-col items-center text-xs font-bold text-red-500";
        abrirModalFavoritos();
    } else if (tab === 'passes') {
        if (viewPasses) viewPasses.classList.remove('hidden');
        if (btnPasses) btnPasses.className = "flex flex-col items-center text-xs font-bold text-red-500";
    }
}

function abrirModalPublicar() {
    document.getElementById('modalPublicar').classList.remove('hidden');
}

function cerrarModalPublicar() {
    document.getElementById('modalPublicar').classList.add('hidden');
}