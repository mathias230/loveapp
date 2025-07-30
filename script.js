// Variables globales
let currentUser = '';
let messages = [];
let photos = [];
let currentPhotoIndex = 0;
let supabase = null;
let isSupabaseConnected = false;
let isFirebaseConnected = false; // Variable temporal para evitar errores

// Configuración de Supabase - REEMPLAZA CON TUS CREDENCIALES REALES
const supabaseConfig = {
    url: 'https://hwzlclcksjcykynntopy.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3emxjbGNrc2pjeWt5bm50b3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM2MjQ1NjksImV4cCI6MjA2OTIwMDU2OX0.n5sEWveSSkxZUsJDP6twJYSxvvymlnmigVvtRyTvuv8'
};

// INSTRUCCIONES PARA CONFIGURAR SUPABASE REAL:
// 1. Ve a https://supabase.com
// 2. Crea una cuenta gratis (no necesitas tarjeta de crédito)
// 3. Crea un nuevo proyecto llamado "loveapp"
// 4. Ve a Settings > API y copia:
//    - Project URL (reemplaza 'https://tu-proyecto.supabase.co')
//    - anon/public key (reemplaza el anonKey de arriba)
// 5. Ve a SQL Editor y ejecuta este código para crear las tablas:
//    
//    -- Tabla para mensajes
//    CREATE TABLE messages (
//      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//      text TEXT NOT NULL,
//      author TEXT NOT NULL,
//      date TEXT NOT NULL,
//      timestamp BIGINT NOT NULL,
//      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
//    );
//    
//    -- Tabla para fotos
//    CREATE TABLE photos (
//      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
//      name TEXT NOT NULL,
//      url TEXT NOT NULL,
//      date TEXT NOT NULL,
//      timestamp BIGINT NOT NULL,
//      uploaded_by TEXT NOT NULL,
//      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
//    );
//    
//    -- Habilitar Row Level Security (RLS) pero permitir todo por ahora
//    ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
//    ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
//    
//    -- Políticas para permitir todo (para desarrollo)
//    CREATE POLICY "Allow all operations on messages" ON messages FOR ALL USING (true);
//    CREATE POLICY "Allow all operations on photos" ON photos FOR ALL USING (true);
//    
// 6. Ve a Storage y crea un bucket llamado "photos" con acceso público

// Frases románticas predefinidas
const loveQuotes = [
    "Eres la razón por la que sonrío cada día ❤️",
    "En tus ojos encontré mi hogar 🏠",
    "Contigo cada momento es mágico ✨",
    "Eres mi persona favorita en todo el universo 🌟",
    "Tu amor es mi lugar seguro 💕",
    "Cada día te amo más que ayer 💖",
    "Eres mi sol en los días nublados ☀️",
    "Tu sonrisa es mi felicidad 😊",
    "Contigo el tiempo se detiene ⏰",
    "Eres mi sueño hecho realidad 💭"
];

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando aplicación de amor...');
    
    // Verificar si hay una carta compartida en la URL
    checkForSharedLetter();
    
    // Inicializar Supabase
    initializeSupabase();
    
    // Configurar event listeners
    setupEventListeners();
    updateLetterDate();
    
    // Verificar si hay usuario guardado (solo si no hay carta compartida)
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('letter')) {
        const savedUser = localStorage.getItem('loveAppUser');
        if (savedUser) {
            currentUser = savedUser;
            showMainScreen();
        }
    }
    
    console.log('✅ Aplicación iniciada correctamente');
});

// Inicialización de Supabase
function initializeSupabase() {
    try {
        console.log('🚀 Inicializando Supabase...');
        
        // Inicializar Supabase
        supabase = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
        
        // Verificar conexión haciendo una consulta simple
        supabase
            .from('messages')
            .select('count', { count: 'exact', head: true })
            .then(({ error }) => {
                if (error && error.code === 'PGRST116') {
                    // Tabla no existe, mostrar instrucciones
                    console.warn('⚠️ Tablas no encontradas. Necesitas crear las tablas en Supabase.');
                    showToast('Configuración pendiente', 'Necesitas crear las tablas en Supabase. Revisa las instrucciones en el código.', 'warning');
                    isSupabaseConnected = false;
                    loadData(); // Usar localStorage mientras tanto
                } else if (error) {
                    console.error('❌ Error conectando a Supabase:', error);
                    showToast('Error de conexión', 'No se pudo conectar a Supabase. Usando modo offline.', 'error');
                    isSupabaseConnected = false;
                    loadData();
                } else {
                    isSupabaseConnected = true;
                    console.log('✅ Conectado a Supabase en tiempo real!');
                    showToast('Conectado', 'Conectado a Supabase en tiempo real 🚀', 'success');
                    setupRealtimeListeners();
                    loadDataFromSupabase();
                }
            });
        
    } catch (error) {
        console.error('❌ Error inicializando Supabase:', error);
        showToast('Error de configuración', 'Error en la configuración de Supabase. Usando modo offline.', 'error');
        isSupabaseConnected = false;
        loadData(); // Fallback a localStorage
    }
}

// Configurar listeners en tiempo real
function setupRealtimeListeners() {
    if (!isSupabaseConnected || !supabase) return;
    
    console.log('🔊 Configurando listeners en tiempo real de Supabase...');
    
    // Suscripción a cambios en mensajes
    const messagesSubscription = supabase
        .channel('messages')
        .on('postgres_changes', 
            { 
                event: '*', 
                schema: 'public', 
                table: 'messages' 
            }, 
            payload => {
                console.log('Cambio en mensajes:', payload);
                loadDataFromSupabase(); // Recargar datos cuando hay cambios
            }
        )
        .subscribe();
    
    // Suscripción a cambios en fotos
    const photosSubscription = supabase
        .channel('photos')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'photos'
            },
            payload => {
                console.log('Cambio en fotos:', payload);
                loadDataFromSupabase(); // Recargar datos cuando hay cambios
            }
        )
        .subscribe();
    
    console.log('✅ Listeners en tiempo real de Supabase configurados');
    
    // Retornar las suscripciones para poder cancelarlas si es necesario
    return () => {
        supabase.removeChannel(messagesSubscription);
        supabase.removeChannel(photosSubscription);
    };
}

// Funciones de carga de datos desde Supabase
function loadDataFromSupabase() {
    if (!isSupabaseConnected || !supabase) {
        console.log('⚠️ Supabase no conectado, usando localStorage');
        loadData();
        return;
    }
    
    console.log('📊 Cargando datos desde Supabase...');
    
    // Cargar mensajes
    supabase
        .from('messages')
        .select('*')
        .order('timestamp', { ascending: false })
        .then(({ data, error }) => {
            if (error) {
                console.error('❌ Error cargando mensajes:', error);
                loadData(); // Fallback
            } else {
                messages = data || [];
                console.log(`✅ ${messages.length} mensajes cargados desde Supabase`);
                loadMessages();
            }
        });
    
    // Cargar fotos
    supabase
        .from('photos')
        .select('*')
        .order('timestamp', { ascending: false })
        .then(({ data, error }) => {
            if (error) {
                console.error('❌ Error cargando fotos:', error);
                loadData(); // Fallback
            } else {
                photos = data || [];
                console.log(`✅ ${photos.length} fotos cargadas desde Supabase`);
                loadPhotos();
            }
        });
}

// Guardar mensaje en Supabase
function saveMessageToSupabase(message) {
    if (!isSupabaseConnected || !supabase) {
        console.log('Guardando mensaje en localStorage como fallback');
        saveData();
        return;
    }
    
    supabase
        .from('messages')
        .insert({
            text: message.text,
            author: message.author,
            date: message.date,
            timestamp: message.timestamp
        })
        .then(({ data, error }) => {
            if (error) {
                console.error('❌ Error guardando mensaje en Supabase:', error);
                // Fallback a localStorage
                messages.unshift({id: Date.now(), ...message});
                saveData();
                loadMessages();
            } else {
                console.log('✅ Mensaje guardado en Supabase');
                // Actualizar la vista inmediatamente
                loadDataFromSupabase();
            }
        });
}

// Subir foto a Supabase con fallback a localStorage
function uploadPhotoToSupabase(photoData, fileName) {
    if (!isSupabaseConnected || !supabase) {
        console.log('Supabase no conectado, guardando foto en localStorage');
        savePhotoToLocalStorage(photoData, fileName);
        return;
    }
    
    // Intentar subir a Supabase Storage
    console.log('📤 Intentando subir foto a Supabase Storage...');
    
    // Convertir data URL a blob
    const byteString = atob(photoData.split(',')[1]);
    const mimeString = photoData.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    
    // Subir a Supabase Storage
    supabase.storage
        .from('photos')
        .upload(fileName, blob)
        .then(({ data, error }) => {
            if (error) {
                console.error('❌ Error subiendo foto a Storage:', error);
                console.log('🔄 Usando fallback a localStorage...');
                showToast('Modo offline', 'Foto guardada localmente (Storage no disponible)', 'warning');
                
                // Fallback a localStorage
                savePhotoToLocalStorage(photoData, fileName);
                return;
            }
            
            console.log('✅ Foto subida a Storage exitosamente');
            
            // Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('photos')
                .getPublicUrl(fileName);
            
            // Guardar referencia en la base de datos
            supabase
                .from('photos')
                .insert({
                    name: fileName,
                    url: publicUrl,
                    date: new Date().toLocaleDateString('es-ES'),
                    timestamp: Date.now(),
                    uploaded_by: currentUser
                })
                .then(({ error: dbError }) => {
                    if (dbError) {
                        console.error('❌ Error guardando referencia de foto:', dbError);
                        showToast('Parcialmente guardada', 'Foto subida pero referencia no guardada', 'warning');
                        
                        // Fallback: guardar también en localStorage
                        savePhotoToLocalStorage(photoData, fileName);
                    } else {
                        console.log('✅ Foto y referencia guardadas en Supabase');
                        showToast('¡Foto subida!', 'Foto guardada en la nube 📷✨', 'success');
                        
                        // Recargar fotos
                        loadDataFromSupabase();
                    }
                });
        })
        .catch(error => {
            console.error('❌ Error inesperado subiendo foto:', error);
            showToast('Error de conexión', 'Guardando foto localmente', 'warning');
            savePhotoToLocalStorage(photoData, fileName);
        });
}

// Función auxiliar para guardar fotos en localStorage
function savePhotoToLocalStorage(photoData, fileName) {
    const photo = {
        id: Date.now() + Math.random(),
        src: photoData,
        name: fileName,
        date: new Date().toLocaleDateString('es-ES'),
        timestamp: Date.now(),
        uploaded_by: currentUser
    };
    
    photos.unshift(photo);
    saveData();
    loadPhotos();
    
    showToast('¡Foto guardada!', 'Foto guardada localmente 📷', 'success');
    showHeartAnimation();
}



// Sistema de notificaciones Toast
function showToast(title, message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="toast-icon ${icons[type]}"></i>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Mostrar toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // Ocultar y remover toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, duration);
}

function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Enter en el input de login
    const usernameInput = document.getElementById('usernameInput');
    if (usernameInput) {
        usernameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                login();
            }
        });
    }
    
    // Enter en el textarea de mensajes
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                saveMessage();
            }
        });
    }
    
    // Subir fotos
    const photoInput = document.getElementById('photoInput');
    if (photoInput) {
        photoInput.addEventListener('change', handlePhotoUpload);
    }
    
    // Cerrar modal al hacer clic fuera
    const photoModal = document.getElementById('photoModal');
    if (photoModal) {
        photoModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closePhotoModal();
            }
        });
    }
    
    console.log('✅ Event listeners configurados');
}

// Funciones de autenticación
function login() {
    console.log('🔐 Intentando login...');
    
    try {
        const usernameInput = document.getElementById('usernameInput');
        
        if (!usernameInput) {
            console.error('❌ No se encontró el input de usuario');
            alert('Error: No se pudo encontrar el campo de usuario');
            return;
        }
        
        const username = usernameInput.value.trim();
        console.log('Username ingresado:', username);
        
        if (username) {
            currentUser = username;
            localStorage.setItem('loveAppUser', username);
            console.log(`✅ Usuario logueado: ${username}`);
            
            // Mostrar pantalla principal
            showMainScreen();
            
            // Mostrar notificación si la función existe
            if (typeof showToast === 'function') {
                showToast('¡Bienvenida!', `Hola ${username} ❤️`, 'success');
            }
        } else {
            alert('Por favor ingresa tu nombre hermoso 💕');
            usernameInput.focus();
        }
    } catch (error) {
        console.error('Error en login:', error);
        alert('Hubo un error al intentar ingresar. Por favor recarga la página.');
    }
}

function logout() {
    if (confirm('¿Estás segura que quieres salir? 🥺')) {
        currentUser = '';
        localStorage.removeItem('loveAppUser');
        showToast('Hasta pronto', 'Vuelve pronto mi amor 💕', 'info');
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('mainScreen').classList.remove('active');
    document.getElementById('usernameInput').value = '';
}

function showMainScreen() {
    try {
        console.log('📱 Mostrando pantalla principal...');
        
        const loginScreen = document.getElementById('loginScreen');
        const mainScreen = document.getElementById('mainScreen');
        
        if (loginScreen && mainScreen) {
            loginScreen.classList.remove('active');
            mainScreen.classList.add('active');
            console.log('✅ Pantallas cambiadas');
        } else {
            console.error('❌ No se encontraron las pantallas');
            return;
        }
        
        // Actualizar nombre de usuario
        const userNameElement = document.getElementById('userName');
        const letterSenderElement = document.getElementById('letterSender');
        
        if (userNameElement) {
            userNameElement.textContent = currentUser;
        }
        
        if (letterSenderElement) {
            letterSenderElement.textContent = currentUser;
        }
        
        // Cargar datos
        if (typeof loadMessages === 'function') {
            loadMessages();
        }
        
        if (typeof loadPhotos === 'function') {
            loadPhotos();
        }
        
        console.log('✅ Pantalla principal mostrada correctamente');
        
    } catch (error) {
        console.error('Error en showMainScreen:', error);
    }
}

// Navegación entre secciones
function showSection(sectionName) {
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    document.getElementById(sectionName + 'Section').classList.add('active');
    
    // Actualizar navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    // Ocultar formulario de nuevo mensaje si está visible
    if (sectionName !== 'messages') {
        hideNewMessageForm();
    }
}

// Funciones de mensajes
function showNewMessageForm() {
    const form = document.getElementById('newMessageForm');
    form.classList.remove('hidden');
    document.getElementById('messageInput').focus();
    
    // Sugerir una frase romántica aleatoria
    const randomQuote = loveQuotes[Math.floor(Math.random() * loveQuotes.length)];
    document.getElementById('messageInput').placeholder = `Ejemplo: ${randomQuote}`;
}

function hideNewMessageForm() {
    document.getElementById('newMessageForm').classList.add('hidden');
    document.getElementById('messageInput').value = '';
}

function saveMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) {
        showToast('Error', 'No se pudo encontrar el campo de mensaje', 'error');
        return;
    }
    
    const messageText = messageInput.value.trim();
    if (messageText) {
        const message = {
            text: messageText,
            author: currentUser,
            date: new Date().toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            timestamp: Date.now()
        };
        
        // Guardar en Supabase (tiempo real) o localStorage (fallback)
        if (isSupabaseConnected && supabase) {
            saveMessageToSupabase(message);
        } else {
            messages.unshift({id: Date.now(), ...message});
            saveData();
            loadMessages();
        }
        
        hideNewMessageForm();
        
        // Mostrar notificación y animación
        showToast('¡Mensaje enviado!', 'Tu mensaje de amor ha sido publicado 💕', 'success');
        showHeartAnimation();
        
    } else {
        showToast('Mensaje vacío', 'Escribe algo hermoso primero 💕', 'warning');
        messageInput.focus();
    }
}

function deleteMessage(messageId) {
    if (confirm('¿Estás segura que quieres eliminar este mensaje? 💔')) {
        if (isSupabaseConnected && supabase) {
            // Eliminar de Supabase
            supabase
                .from('messages')
                .delete()
                .eq('id', messageId)
                .then(({ error }) => {
                    if (error) {
                        console.error('❌ Error eliminando mensaje de Supabase:', error);
                        showToast('Error', 'No se pudo eliminar el mensaje', 'error');
                    } else {
                        console.log('✅ Mensaje eliminado de Supabase');
                        showToast('Eliminado', 'Mensaje eliminado correctamente 💔', 'success');
                        // Recargar mensajes desde Supabase
                        loadDataFromSupabase();
                    }
                });
        } else {
            // Eliminar de localStorage
            messages = messages.filter(msg => msg.id !== messageId);
            saveData();
            loadMessages();
            showToast('Eliminado', 'Mensaje eliminado correctamente 💔', 'success');
        }
    }
}

function loadMessages() {
    const messagesList = document.getElementById('messagesList');
    
    if (messages.length === 0) {
        messagesList.innerHTML = `
            <div class="message-card">
                <div class="message-content">
                    ¡Bienvenida mi amor! 💕<br><br>
                    Este es nuestro espacio especial donde puedes escribir mensajes hermosos.
                    Haz clic en "Nuevo" para comenzar a crear recuerdos juntos ❤️
                </div>
                <div class="message-meta">
                    <span>💝 Mensaje de bienvenida</span>
                </div>
            </div>
        `;
        return;
    }
    
    messagesList.innerHTML = messages.map(message => {
        const isCurrentUser = message.author === currentUser;
        const messageId = message.id || Date.now(); // Fallback para IDs faltantes
        return `
            <div class="message-bubble ${isCurrentUser ? 'own-message' : 'other-message'}">
                <div class="message-header">
                    <span class="message-author">${message.author}</span>
                    <span class="message-time">${new Date(message.timestamp).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <div class="message-content">${message.text}</div>
                <div class="message-actions">
                    ${isCurrentUser ? `<button onclick="deleteMessage('${messageId}')" class="delete-message" title="Eliminar mensaje"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// Funciones de cartas
function updateLetterDate() {
    const today = new Date().toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    document.getElementById('letterDate').textContent = today;
}

// Descargar carta como texto
function downloadLetter() {
    const content = document.getElementById('letterContent').value;
    const sender = document.getElementById('letterSender').textContent;
    const recipient = document.getElementById('letterRecipient').textContent;
    const date = document.getElementById('letterDate').textContent;
    
    if (!content.trim()) {
        showToast('Carta vacía', 'Escribe algo en la carta primero 💌', 'warning');
        return;
    }
    
    const letterContent = `
CARTA DE AMOR 💕
═══════════════════════════════════════

Para: ${recipient}
De: ${sender}
Fecha: ${date}

${content}

═══════════════════════════════════════
Creado con amor en nuestra página especial ❤️
    `;
    
    const blob = new Blob([letterContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Carta_de_amor_${date.replace(/\s/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('Carta descargada', 'Tu carta de texto ha sido descargada 📝', 'success');
    showHeartAnimation();
}

// Descargar carta como imagen
function downloadLetterAsImage() {
    const content = document.getElementById('letterContent').value;
    const sender = document.getElementById('letterSender').textContent;
    const recipient = document.getElementById('letterRecipient').textContent;
    const date = document.getElementById('letterDate').textContent;
    
    if (!content.trim()) {
        showToast('Carta vacía', 'Escribe algo en la carta primero 💌', 'warning');
        return;
    }
    
    // Crear elemento temporal para renderizar la carta
    const letterContainer = document.createElement('div');
    letterContainer.className = 'letter-image-container';
    letterContainer.innerHTML = `
        <div class="letter-image-header">
            <div class="letter-image-title">Carta de Amor</div>
            <div class="letter-image-meta">Para: ${recipient}</div>
            <div class="letter-image-meta">De: ${sender}</div>
            <div class="letter-image-meta">Fecha: ${date}</div>
        </div>
        <div class="letter-image-content">${content}</div>
        <div class="letter-image-footer">
            Creado con amor en nuestra página especial ❤️
        </div>
    `;
    
    // Agregar al DOM temporalmente
    letterContainer.style.position = 'absolute';
    letterContainer.style.left = '-9999px';
    letterContainer.style.background = 'white';
    document.body.appendChild(letterContainer);
    
    // Usar html2canvas si está disponible, sino usar canvas manual
    if (typeof html2canvas !== 'undefined') {
        html2canvas(letterContainer, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true
        }).then(canvas => {
            // Descargar imagen
            const link = document.createElement('a');
            link.download = `Carta_de_amor_${date.replace(/\s/g, '_')}.png`;
            link.href = canvas.toDataURL();
            link.click();
            
            // Limpiar
            document.body.removeChild(letterContainer);
            showToast('Imagen descargada', 'Tu carta como imagen ha sido descargada 🖼️', 'success');
            showHeartAnimation();
        });
    } else {
        // Fallback: crear imagen con canvas manualmente
        createLetterImageCanvas(content, sender, recipient, date);
        document.body.removeChild(letterContainer);
    }
}

// Crear imagen de carta con canvas
function createLetterImageCanvas(content, sender, recipient, date) {
    const canvas = document.getElementById('letterCanvas');
    const ctx = canvas.getContext('2d');
    
    // Configurar canvas
    canvas.width = 800;
    canvas.height = 1000;
    
    // Fondo
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#ffeef0');
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Borde
    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    
    // Línea decorativa
    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(80, 60);
    ctx.lineTo(80, canvas.height - 60);
    ctx.stroke();
    ctx.globalAlpha = 1;
    
    // Título
    ctx.fillStyle = '#ff6b9d';
    ctx.font = 'bold 48px Dancing Script, cursive';
    ctx.textAlign = 'center';
    ctx.fillText('Carta de Amor', canvas.width / 2, 120);
    
    // Corazón decorativo
    ctx.font = '32px Arial';
    ctx.fillText('💕', canvas.width - 80, 80);
    
    // Metadatos
    ctx.fillStyle = '#666';
    ctx.font = '24px Dancing Script, cursive';
    ctx.textAlign = 'left';
    ctx.fillText(`Para: ${recipient}`, 100, 180);
    ctx.fillText(`De: ${sender}`, 100, 210);
    ctx.fillText(`Fecha: ${date}`, 100, 240);
    
    // Línea separadora
    ctx.strokeStyle = '#ff6b9d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 260);
    ctx.lineTo(canvas.width - 100, 260);
    ctx.stroke();
    
    // Contenido de la carta
    ctx.fillStyle = '#333';
    ctx.font = '28px Dancing Script, cursive';
    ctx.textAlign = 'left';
    
    const lines = content.split('\n');
    let y = 320;
    const lineHeight = 40;
    const maxWidth = canvas.width - 200;
    
    lines.forEach(line => {
        const words = line.split(' ');
        let currentLine = '';
        
        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
                ctx.fillText(currentLine.trim(), 100, y);
                currentLine = word + ' ';
                y += lineHeight;
            } else {
                currentLine = testLine;
            }
        });
        
        ctx.fillText(currentLine.trim(), 100, y);
        y += lineHeight;
    });
    
    // Footer
    ctx.fillStyle = '#999';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Creado con amor en nuestra página especial ❤️', canvas.width / 2, canvas.height - 60);
    
    // Descargar
    const link = document.createElement('a');
    link.download = `Carta_de_amor_${date.replace(/\s/g, '_')}.png`;
    link.href = canvas.toDataURL();
    link.click();
    
    showToast('Imagen descargada', 'Tu carta como imagen ha sido descargada 🖼️', 'success');
    showHeartAnimation();
}

// Copiar link de la carta
function copyLetterLink() {
    const content = document.getElementById('letterContent').value;
    const sender = document.getElementById('letterSender').textContent;
    const recipient = document.getElementById('letterRecipient').textContent;
    const date = document.getElementById('letterDate').textContent;
    
    if (!content.trim()) {
        showToast('Carta vacía', 'Escribe algo en la carta primero 💌', 'warning');
        return;
    }
    
    // Crear ID único para la carta
    const letterId = btoa(encodeURIComponent(JSON.stringify({
        content,
        sender,
        recipient,
        date,
        timestamp: Date.now()
    }))).replace(/[+/=]/g, '');
    
    // Crear URL
    const letterUrl = `${window.location.origin}${window.location.pathname}?letter=${letterId}`;
    
    // Copiar al portapapeles
    navigator.clipboard.writeText(letterUrl).then(() => {
        showToast('Link copiado', 'El link de tu carta ha sido copiado al portapapeles 🔗', 'success');
        
        // Mostrar animación de carta volando al sobre
        showLetterToEnvelopeAnimation();
        
    }).catch(() => {
        // Fallback para navegadores que no soportan clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = letterUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        showToast('Link copiado', 'El link de tu carta ha sido copiado 🔗', 'success');
        showLetterToEnvelopeAnimation();
    });
}

// Animación de carta volando al sobre
function showLetterToEnvelopeAnimation() {
    const animationContainer = document.getElementById('letterToEnvelopeAnimation');
    animationContainer.classList.remove('hidden');
    
    // Ocultar después de la animación
    setTimeout(() => {
        animationContainer.classList.add('hidden');
    }, 3000);
}

function clearLetter() {
    if (confirm('¿Estás segura que quieres limpiar la carta? 🗑️')) {
        document.getElementById('letterContent').value = '';
    }
}

// Funciones de fotos
function handlePhotoUpload(event) {
    const files = event.target.files;
    let uploadedCount = 0;
    let totalFiles = 0;
    
    if (files.length === 0) return;
    
    // Contar archivos válidos
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            totalFiles++;
        }
    }
    
    if (totalFiles === 0) {
        showToast('Sin imágenes', 'No se encontraron imágenes válidas', 'warning');
        return;
    }
    
    showToast('Subiendo fotos', `Procesando ${totalFiles} foto(s)... 📸`, 'info');
    
    for (let file of files) {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const fileName = `${Date.now()}_${file.name}`;
                
                // Subir a Supabase (tiempo real) o guardar en localStorage (fallback)
                if (isSupabaseConnected && supabase) {
                    uploadPhotoToSupabase(e.target.result, fileName);
                } else {
                    // Fallback a localStorage
                    const photo = {
                        id: Date.now() + Math.random(),
                        src: e.target.result,
                        name: file.name,
                        date: new Date().toLocaleDateString('es-ES'),
                        timestamp: Date.now(),
                        uploaded_by: currentUser  // Cambiado de uploadedBy a uploaded_by para coincidir con Supabase
                    };
                    
                    photos.unshift(photo);
                    saveData();
                    loadPhotos();
                    
                    // Mostrar notificación de éxito
                    showToast('¡Fotos subidas!', 'Foto agregada a la galería 💕', 'success');
                    showHeartAnimation();
                }
            };
            reader.readAsDataURL(file);
        } else {
            showToast('Archivo inválido', `${file.name} no es una imagen válida`, 'warning');
        }
    }
    
    // Limpiar el input
    event.target.value = '';
}

function loadPhotos() {
    const photosGrid = document.getElementById('photosGrid');
    
    if (photos.length === 0) {
        photosGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #666;">
                <i class="fas fa-camera" style="font-size: 3rem; margin-bottom: 1rem; color: #ff6b9d;"></i>
                <p>Aún no hay fotos en nuestra galería 📸</p>
                <p>¡Sube algunas fotos hermosas para comenzar! 💕</p>
            </div>
        `;
        return;
    }
    
    photosGrid.innerHTML = photos.map((photo, index) => `
        <div class="photo-item" onclick="openPhotoModal(${index})">
            <img src="${photo.src}" alt="${photo.name}">
        </div>
    `).join('');
}

function openPhotoModal(index) {
    currentPhotoIndex = index;
    const photo = photos[index];
    document.getElementById('modalImage').src = photo.src;
    document.getElementById('photoModal').classList.add('active');
}

function closePhotoModal() {
    document.getElementById('photoModal').classList.remove('active');
}

function deletePhoto() {
    if (confirm('¿Estás segura que quieres eliminar esta foto? 💔')) {
        photos.splice(currentPhotoIndex, 1);
        saveData();
        loadPhotos();
        closePhotoModal();
    }
}

// Funciones de almacenamiento
function saveData() {
    localStorage.setItem('loveAppMessages', JSON.stringify(messages));
    localStorage.setItem('loveAppPhotos', JSON.stringify(photos));
}

function loadData() {
    const savedMessages = localStorage.getItem('loveAppMessages');
    const savedPhotos = localStorage.getItem('loveAppPhotos');
    
    if (savedMessages) {
        messages = JSON.parse(savedMessages);
    }
    
    if (savedPhotos) {
        photos = JSON.parse(savedPhotos);
    }
}

// Animaciones
function showHeartAnimation() {
    const heart = document.createElement('div');
    heart.innerHTML = '💕';
    heart.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 3rem;
        z-index: 9999;
        pointer-events: none;
        animation: heartPop 1s ease-out forwards;
    `;
    
    // Agregar keyframes si no existen
    if (!document.querySelector('#heartAnimation')) {
        const style = document.createElement('style');
        style.id = 'heartAnimation';
        style.textContent = `
            @keyframes heartPop {
                0% { transform: translate(-50%, -50%) scale(0); opacity: 1; }
                50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
                100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(heart);
    
    setTimeout(() => {
        document.body.removeChild(heart);
    }, 1000);
}

// Función para agregar mensajes románticos automáticamente (opcional)
function addRandomLoveMessage() {
    const randomQuote = loveQuotes[Math.floor(Math.random() * loveQuotes.length)];
    const message = {
        id: Date.now(),
        text: randomQuote,
        author: 'Mensaje del corazón',
        date: new Date().toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    };
    
    messages.unshift(message);
    saveData();
    loadMessages();
    showHeartAnimation();
}

// Atajos de teclado
document.addEventListener('keydown', function(e) {
    // Ctrl + Enter para guardar mensaje
    if (e.ctrlKey && e.key === 'Enter' && !document.getElementById('newMessageForm').classList.contains('hidden')) {
        saveMessage();
    }
    
    // Escape para cerrar modal
    if (e.key === 'Escape') {
        closePhotoModal();
        hideNewMessageForm();
    }
});

// Prevenir zoom en iOS
document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
});

let lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    const now = (new Date()).getTime();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Verificar si hay una carta compartida en la URL
function checkForSharedLetter() {
    const urlParams = new URLSearchParams(window.location.search);
    const letterId = urlParams.get('letter');
    
    if (letterId) {
        try {
            // Decodificar la carta
            const letterData = JSON.parse(decodeURIComponent(atob(letterId)));
            showSharedLetter(letterData);
        } catch (error) {
            console.error('Error al decodificar la carta:', error);
            showToast('Error', 'El link de la carta no es válido 😔', 'error');
        }
    }
}

// Mostrar carta compartida con animación de sobre
function showSharedLetter(letterData) {
    // Crear pantalla especial para la carta
    const sharedLetterScreen = document.createElement('div');
    sharedLetterScreen.id = 'sharedLetterScreen';
    sharedLetterScreen.className = 'screen active';
    sharedLetterScreen.innerHTML = `
        <div class="shared-letter-container">
            <div class="envelope-animation" id="envelopeAnimation">
                <div class="envelope-large">
                    <div class="envelope-flap-large" id="envelopeFlap"></div>
                    <div class="envelope-body-large"></div>
                    <div class="envelope-seal">💕</div>
                </div>
                <div class="click-instruction">
                    <p>Haz clic en el sobre para abrir tu carta 💌</p>
                    <div class="pulse-animation">⬇️</div>
                </div>
            </div>
            
            <div class="letter-content-display hidden" id="letterDisplay">
                <div class="letter-paper-large">
                    <div class="letter-header-large">
                        <h1>Carta de Amor</h1>
                        <div class="letter-meta-large">
                            <p><strong>Para:</strong> ${letterData.recipient}</p>
                            <p><strong>De:</strong> ${letterData.sender}</p>
                            <p><strong>Fecha:</strong> ${letterData.date}</p>
                        </div>
                    </div>
                    <div class="letter-content-large">
                        ${letterData.content.replace(/\n/g, '<br>')}
                    </div>
                    <div class="letter-footer-large">
                        <p>Creado con amor en nuestra página especial ❤️</p>
                    </div>
                </div>
                <div class="shared-letter-actions">
                    <button onclick="downloadSharedLetterAsImage()" class="btn-primary">
                        <i class="fas fa-image"></i> Descargar Imagen
                    </button>
                    <button onclick="goToMainApp()" class="btn-secondary">
                        <i class="fas fa-heart"></i> Ir a la App
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Reemplazar el contenido actual
    document.body.innerHTML = '';
    document.body.appendChild(sharedLetterScreen);
    
    // Agregar event listener para abrir el sobre
    document.getElementById('envelopeAnimation').addEventListener('click', function() {
        openEnvelopeAnimation(letterData);
    });
    
    // Guardar datos de la carta para descargar
    window.currentSharedLetter = letterData;
}

// Animación de abrir sobre
function openEnvelopeAnimation(letterData) {
    const envelopeAnimation = document.getElementById('envelopeAnimation');
    const letterDisplay = document.getElementById('letterDisplay');
    const envelopeFlap = document.getElementById('envelopeFlap');
    
    // Animar apertura del sobre
    envelopeFlap.style.animation = 'openEnvelopeLarge 1.5s ease-in-out forwards';
    
    // Mostrar la carta después de un delay
    setTimeout(() => {
        envelopeAnimation.style.animation = 'fadeOut 0.5s ease-in-out forwards';
        
        setTimeout(() => {
            envelopeAnimation.classList.add('hidden');
            letterDisplay.classList.remove('hidden');
            letterDisplay.style.animation = 'letterEmerge 1s ease-in-out forwards';
            
            // Mostrar notificación
            if (typeof showToast === 'function') {
                showToast('💌 Carta abierta', `Una carta de ${letterData.sender} para ${letterData.recipient}`, 'success');
            }
        }, 500);
    }, 1500);
}

// Descargar carta compartida como imagen
function downloadSharedLetterAsImage() {
    const letterData = window.currentSharedLetter;
    if (letterData) {
        createLetterImageCanvas(letterData.content, letterData.sender, letterData.recipient, letterData.date);
    }
}

// Ir a la aplicación principal
function goToMainApp() {
    // Limpiar URL
    window.history.replaceState({}, document.title, window.location.pathname);
    
    // Recargar la página para mostrar la app normal
    window.location.reload();
}
