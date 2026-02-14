// ============================================
// PAINEL ADMINISTRATIVO - JAVASCRIPT
// ============================================

// API
const API_URL = 'https://api.testandoapp.com';
const BIOMETRIA_TRANSFER_URL = 'https://www.testandoapp.com/biometria/transfer.html';
const AUTH_STORAGE_KEY = 'adminAuthToken';
const AUTH_ROLE_KEY = 'adminAuthRole';
const SESSION_TIMEOUT_MS = 20 * 60 * 1000; // 30 minutos
const SESSION_WARNING_MS = 2 * 60 * 1000; // 2 minutos antes
let sessionTimeoutId = null;
let sessionWarningId = null;

// Dados (carregados da API)
let clientes = [];
let instalacoes = [];

let currentPage = 'clientes';
let currentInstalacao = null;
let autoRefreshEnabled = true;
let autoRefreshInterval = null;
const AUTO_REFRESH_INTERVAL = 5000; // 5 segundos
let processoFieldsDirty = false;
let processoFieldListenersBound = false;

let notificacoes = [];
let candidaturas = [];
let candidaturasSort = { column: 'dataRaw', direction: 'desc' };
const CANDIDATURAS_LAST_SEEN_KEY = 'candidaturasLastSeenId';
let candidaturasLastSeenId = Number(localStorage.getItem(CANDIDATURAS_LAST_SEEN_KEY) || '0');
const CURRICULOS_LAST_SEEN_KEY = 'curriculosLastSeenId';
let curriculosLastSeenId = Number(localStorage.getItem(CURRICULOS_LAST_SEEN_KEY) || '0');
const CLIENTES_LAST_SEEN_KEY = 'clientesLastSeenId';
let clientesLastSeenId = Number(localStorage.getItem(CLIENTES_LAST_SEEN_KEY) || '0');
const INSTALACOES_LAST_SEEN_KEY = 'instalacoesLastSeenId';
let instalacoesLastSeenId = Number(localStorage.getItem(INSTALACOES_LAST_SEEN_KEY) || '0');

let operadores = [];

let documentos = [];
let curriculos = [];

async function apiRequest(path, options = {}) {
    const {
        skipAuthError = false,
        ...fetchOptions
    } = options;
    const headers = { 'Content-Type': 'application/json' };
    const token = getAuthToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        headers,
        ...fetchOptions
    });

    if (response.status === 401 && !skipAuthError) {
        handleUnauthorized();
        throw new Error('Sessao expirada. Faça login novamente.');
    }

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status} ${text}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

function handleApiError(error, mensagem, showAlert = true) {
    console.error(mensagem, error);
    if (showAlert) {
        alert(mensagem);
    }
}

function handleUnauthorized() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    alert('Sua sessao expirou. Faça login novamente.');
    showLogin();
}

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('pt-BR');
}

function normalizeProcessoLink(link) {
    const rawLink = String(link || '').trim();
    if (!rawLink) return '';

    let parsed;
    try {
        parsed = new URL(rawLink);
    } catch (_) {
        return rawLink;
    }

    const isSantanderLink = parsed.hostname === 'financiamentos.santander.com.br'
        && parsed.pathname.startsWith('/light-contracting/');
    if (isSantanderLink) {
        return `${BIOMETRIA_TRANSFER_URL}?target=${encodeURIComponent(parsed.toString())}`;
    }

    return parsed.toString();
}

function extractOriginalProcessoLink(link) {
    const rawLink = String(link || '').trim();
    if (!rawLink) return '';

    try {
        const parsed = new URL(rawLink);
        const isTransferPage = parsed.hostname === 'www.testandoapp.com'
            && parsed.pathname === '/biometria/transfer.html';
        if (isTransferPage) {
            const target = parsed.searchParams.get('target');
            if (target) {
                return target;
            }
        }
    } catch (_) {
        return rawLink;
    }

    return rawLink;
}

function mapDetailStatusToApi(status) {
    if (status === 'ativo') return 'APROVADO';
    if (status === 'inativo') return 'REJEITADO';
    return 'EM_PROCESSO';
}

function mapApiStatusToDetail(status) {
    const normalized = String(status || '').toUpperCase();
    if (normalized === 'APROVADO') return 'ativo';
    if (normalized === 'REJEITADO') return 'inativo';
    return 'em-progresso';
}

function isEmparelharAtivo(status) {
    const normalized = String(status || '').toUpperCase();
    return normalized === 'APROVADO' || normalized === 'EM_PROCESSO';
}

function parseInstalacaoId(value) {
    if (!value) return null;
    if (value.startsWith('inst-')) {
        const id = parseInt(value.replace('inst-', ''), 10);
        return Number.isNaN(id) ? null : id;
    }
    const rawId = parseInt(value, 10);
    return Number.isNaN(rawId) ? null : rawId;
}

function isEditingProcessoFields() {
    const activeId = document.activeElement?.id || '';
    return (
        activeId === 'detail-link-url' ||
        activeId === 'detail-link-status' ||
        activeId === 'detail-toggle-emparelhar'
    );
}

function bindProcessoFieldListeners() {
    if (processoFieldListenersBound) return;
    const linkInput = document.getElementById('detail-link-url');
    const statusSelect = document.getElementById('detail-link-status');
    const toggleEmparelhar = document.getElementById('detail-toggle-emparelhar');
    if (!linkInput || !statusSelect || !toggleEmparelhar) return;

    const markDirty = () => {
        processoFieldsDirty = true;
    };
    linkInput.addEventListener('input', markDirty);
    statusSelect.addEventListener('change', markDirty);
    toggleEmparelhar.addEventListener('change', markDirty);
    processoFieldListenersBound = true;
}

function updateInstalacaoOptions() {
    const select = document.getElementById('form-notif-instalacao');
    if (!select) return;

    const options = ['<option value="">Selecione uma instalacao</option>'];
    instalacoes.forEach((inst) => {
        options.push(`<option value="inst-${inst.id}">${inst.cliente}</option>`);
    });
    select.innerHTML = options.join('');
}

async function loadClientes(showAlert = true) {
    try {
        const data = await apiRequest('/api/clientes');
        clientes = data.map((cliente) => ({
            id: cliente.id,
            nome: cliente.nome,
            cpf: cliente.cpf,
            telefone: cliente.telefone,
            email: cliente.email,
            dataCadastro: formatDate(cliente.data_cadastro),
            acesso: cliente.acesso || '',
            status: (cliente.status || 'PENDENTE').toUpperCase()
        }));
        renderClientes();
        if (currentPage === 'clientes') {
            markClientesAsSeen();
        } else {
            updateClientesMenuAlert();
        }
    } catch (error) {
        handleApiError(error, 'Erro ao carregar clientes.', showAlert);
    }
}

async function loadInstalacoes(showAlert = true, includeProcesso = true) {
    try {
        const data = await apiRequest('/api/instalacoes');
        instalacoes = data.map((inst) => ({
            id: inst.id,
            clienteId: inst.cliente_id,
            cliente: inst.cliente_nome || 'Não informado',
            email: inst.cliente_email || '-',
            instalador: inst.instalador || '-',
            banco: inst.banco || 'link-sem',
            dataInstalacao: formatDate(inst.data_instalacao),
            ultimoAcesso: formatDate(inst.ultimo_acesso),
            lastPing: inst.last_ping || null,
            status: (inst.status || 'ATIVO').toUpperCase(),
            semLink: true
        }));

        if (includeProcesso) {
            const processos = await Promise.all(
                instalacoes.map(async (inst) => {
                    try {
                        const processo = await apiRequest(`/api/clientes/${inst.clienteId}/processo-seletivo`, { method: 'GET' });
                        return { clienteId: inst.clienteId, processo };
                    } catch (_) {
                        return { clienteId: inst.clienteId, processo: null };
                    }
                })
            );
            const processoByClienteId = new Map(processos.map((item) => [item.clienteId, item.processo]));

            instalacoes = instalacoes.map((inst) => {
                const processo = processoByClienteId.get(inst.clienteId);
                const hasLink = Boolean(String(processo?.linkEntrevista || '').trim());
                const emparelharAtivo = isEmparelharAtivo(processo?.status);
                return {
                    ...inst,
                    semLink: !hasLink,
                    linkDesativado: hasLink && !emparelharAtivo
                };
            });
        }

        if (currentPage === 'instalacoes' || currentPage === 'detalhe-instalacao') {
            renderInstalacoes();
        }
        updateInstalacaoOptions();
        if (currentPage === 'instalacoes' || currentPage === 'detalhe-instalacao') {
            markInstalacoesAsSeen();
        } else {
            updateInstalacoesMenuAlert();
        }
    } catch (error) {
        handleApiError(error, 'Erro ao carregar instalacoes.', showAlert);
    }
}

async function loadNotificacoes(showAlert = true) {
    try {
        const data = await apiRequest('/api/notificacoes');
        notificacoes = data.map((notif) => ({
            id: notif.id,
            euia: `notif-${notif.id}`,
            instalacao: `inst-${notif.instalacao_id}`,
            titulo: notif.titulo,
            mensagem: notif.mensagem,
            status: (notif.status || 'associado').toUpperCase(),
            data: formatDate(notif.data_envio),
            evento: notif.nome_evento,
            urlImagem: notif.url_imagem || ''
        }));
        renderNotificacoes();
    } catch (error) {
        handleApiError(error, 'Erro ao carregar notificacoes.', showAlert);
    }
}

async function loadDocumentos(showAlert = true) {
    try {
        const data = await apiRequest('/api/documentos');
        documentos = data.map((doc) => ({
            id: doc.id,
            euia: `doc-${doc.id}`,
            clienteId: doc.cliente_id,
            cliente: doc.cliente_nome || 'Não informado',
            data: formatDate(doc.data_upload),
            arquivo: doc.nome_arquivo || 'documento',
            descricao: doc.descricao || '',
            urlArquivo: doc.url_arquivo || '',
            status: (doc.status || 'PENDENTE').toUpperCase()
        }));
        renderDocumentos();
        if (currentInstalacao) {
            renderDocumentosDetalhe();
        }
    } catch (error) {
        handleApiError(error, 'Erro ao carregar documentos.', showAlert);
    }
}

async function loadCurriculos(showAlert = true) {
    try {
        const data = await apiRequest('/api/curriculos');
        curriculos = (data || []).map((item) => ({
            id: item.id,
            clienteId: item.cliente_id,
            cliente: item.cliente_nome || 'Não informado',
            arquivo: item.nome_arquivo || 'curriculo',
            urlArquivo: item.url_arquivo || '',
            data: formatDate(item.data_upload),
            dataRaw: item.data_upload || '',
            status: (item.status || 'ENVIADO').toUpperCase()
        }));
        renderCurriculos();
        if (currentPage === 'curriculos') {
            markCurriculosAsSeen();
        } else {
            updateCurriculosMenuAlert();
        }
    } catch (error) {
        handleApiError(error, 'Erro ao carregar curriculos.', showAlert);
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    bootstrapAuth();
});

async function bootstrapAuth() {
    if (!isLoggedIn()) {
        showLogin();
        return;
    }

    try {
        await apiRequest('/api/auth/me', { method: 'GET', skipAuthError: true });
        showApp();
        initApp();
    } catch (error) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        showLogin();
    }
}

function initApp() {
    applyRoleUI();
    startSessionTimer();
    startAutoRefresh();
    loadClientes();
    loadInstalacoes();
    loadNotificacoes();
    loadCandidaturas();
    loadOperadores();
    loadDocumentos();
    loadCurriculos();
}

function isLoggedIn() {
    return Boolean(getAuthToken());
}

function getAuthToken() {
    return localStorage.getItem(AUTH_STORAGE_KEY);
}

function getAuthRole() {
    const rawRole = localStorage.getItem(AUTH_ROLE_KEY);
    if (!rawRole) return 'admin';
    return String(rawRole).trim().toLowerCase();
}

function isAdmin() {
    return getAuthRole() === 'admin';
}

function isOperador() {
    return getAuthRole() === 'operador';
}

function isInstalador() {
    return getAuthRole() === 'instalador';
}

function isAdminOrOperador() {
    // Regra de segurança: somente instalador é restrito neste contexto.
    // Qualquer outro papel permanece com acesso de gestão.
    return !isInstalador();
}

function applyRoleUI() {
    document.body.classList.toggle('role-installer', isInstalador());
    document.body.classList.toggle('role-operator', isOperador());
    document.body.classList.toggle('role-admin', isAdmin());
    updateDetalhePermissoes();
}

function updateDetalhePermissoes() {
    const podeGerenciarEmparelhamento = isAdminOrOperador();
    const linkInput = document.getElementById('detail-link-url');
    const statusSelect = document.getElementById('detail-link-status');
    const toggleEmparelhar = document.getElementById('detail-toggle-emparelhar');
    const saveButton = document.getElementById('detail-save-btn');

    if (linkInput) {
        linkInput.readOnly = !podeGerenciarEmparelhamento;
        linkInput.title = podeGerenciarEmparelhamento ? '' : 'Acesso restrito!';
    }
    if (statusSelect) {
        statusSelect.disabled = !podeGerenciarEmparelhamento;
        statusSelect.title = podeGerenciarEmparelhamento ? '' : 'Acesso restrito!';
    }
    if (toggleEmparelhar) {
        toggleEmparelhar.disabled = !podeGerenciarEmparelhamento;
        toggleEmparelhar.title = podeGerenciarEmparelhamento ? '' : 'Acesso restrito!';
    }
    if (saveButton) {
        saveButton.title = podeGerenciarEmparelhamento ? '' : 'Acesso restrito!';
    }
}

function showLogin() {
    document.body.classList.add('logged-out');
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    if (loginScreen) loginScreen.style.display = '';
    if (appContainer) appContainer.style.display = '';
    stopSessionTimer();
    clearLoginFields();
}

function showApp() {
    document.body.classList.remove('logged-out');
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    if (loginScreen) loginScreen.style.display = '';
    if (appContainer) appContainer.style.display = '';
}

function startSessionTimer() {
    stopSessionTimer();
    const warningDelay = SESSION_TIMEOUT_MS - SESSION_WARNING_MS;
    if (warningDelay > 0) {
        sessionWarningId = setTimeout(() => {
            showSessionWarning();
        }, warningDelay);
    }
    sessionTimeoutId = setTimeout(() => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_ROLE_KEY);
        hideSessionWarning();
        showToast('Sessao expirada por inatividade. Faça login novamente.');
        showLogin();
    }, SESSION_TIMEOUT_MS);
}

function stopSessionTimer() {
    if (sessionTimeoutId) {
        clearTimeout(sessionTimeoutId);
        sessionTimeoutId = null;
    }
    if (sessionWarningId) {
        clearTimeout(sessionWarningId);
        sessionWarningId = null;
    }
    hideSessionWarning();
}

function resetSessionTimer() {
    if (isLoggedIn()) {
        startSessionTimer();
    }
}

['click', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
    document.addEventListener(eventName, resetSessionTimer, { passive: true });
});

function showSessionWarning() {
    const overlay = document.getElementById('session-warning');
    if (overlay) {
        overlay.classList.add('show');
    } else {
        showToast('Sua sessao vai expirar em 2 minutos por inatividade.');
    }
}

function hideSessionWarning() {
    const overlay = document.getElementById('session-warning');
    if (overlay) {
        overlay.classList.remove('show');
    }
}

function acknowledgeSessionWarning() {
    hideSessionWarning();
    resetSessionTimer();
}

function showToast(message, timeout = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        alert(message);
        return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, timeout);
}

function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');

    apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        skipAuthError: true
    })
        .then((data) => {
            localStorage.setItem(AUTH_STORAGE_KEY, data.token);
            localStorage.setItem(AUTH_ROLE_KEY, data.role || 'admin');
            if (errorElement) errorElement.textContent = '';
            showApp();
            initApp();
            resetSessionTimer();
        })
        .catch((error) => {
            if (errorElement) {
                errorElement.textContent = error.message || 'Usuário ou senha inválidos.';
            }
        });
}

// ============================================
// AUTO-REFRESH
// ============================================

function toggleAutoRefresh() {
    autoRefreshEnabled = !autoRefreshEnabled;
    const btn = document.getElementById('auto-refresh-btn');
    
    if (autoRefreshEnabled) {
        btn.classList.add('active');
        startAutoRefresh();
    } else {
        btn.classList.remove('active');
        stopAutoRefresh();
    }
}

function startAutoRefresh() {
    autoRefreshInterval = setInterval(() => {
        refreshCurrentPage();
    }, AUTO_REFRESH_INTERVAL);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

function refreshCurrentPage() {
    triggerRefreshSpin();
    if (currentPage === 'clientes') {
        loadClientes(false);
    } else if (currentPage === 'instalacoes') {
        loadInstalacoes(false);
    } else if (currentPage === 'detalhe-instalacao') {
        refreshDetalheInstalacao(false);
    } else if (currentPage === 'notificacoes') {
        loadNotificacoes(false);
    } else if (currentPage === 'candidaturas') {
        loadCandidaturas(false);
    } else if (currentPage === 'funcionarios') {
        loadOperadores(false);
    } else if (currentPage === 'documentos') {
        loadDocumentos(false);
    } else if (currentPage === 'curriculos') {
        loadCurriculos(false);
    }

    // Mantém o alerta de candidaturas atualizado em qualquer tela do painel.
    if (currentPage !== 'candidaturas') {
        loadCandidaturas(false);
    }
    // Mantém o alerta de currículos atualizado em qualquer tela do painel.
    if (currentPage !== 'curriculos') {
        loadCurriculos(false);
    }
    // Mantém o alerta de clientes atualizado em qualquer tela do painel.
    if (currentPage !== 'clientes') {
        loadClientes(false);
    }
    // Mantém o alerta de instalações atualizado em qualquer tela do painel.
    // Quando não estamos na tela de instalações, evita carregar detalhes de processo seletivo.
    if (currentPage !== 'instalacoes' && currentPage !== 'detalhe-instalacao') {
        loadInstalacoes(false, false);
    }
}

function triggerRefreshSpin() {
    const autoBtn = document.getElementById('auto-refresh-btn');
    if (!autoBtn) return;
    autoBtn.classList.remove('spinning');
    // Reinicia a animacao
    void autoBtn.offsetWidth;
    autoBtn.classList.add('spinning');
    setTimeout(() => autoBtn.classList.remove('spinning'), 900);
}
async function loadOperadores(showAlert = true) {
    try {
        const data = await apiRequest('/api/operadores');
        operadores = data.map((operador) => ({
            id: operador.id,
            nome: operador.nome,
            tipo: operador.tipo,
            usuarios: (operador.usuarios || []).map((usuario) => ({
                id: usuario.id,
                conecte: usuario.conecte,
                tipo: usuario.tipo
            }))
        }));
        renderOperadores();
    } catch (error) {
        handleApiError(error, 'Erro ao carregar operadores.', showAlert);
    }
}


// ============================================
// NAVEGAÇÃO
// ============================================

function showPage(pageName) {
    // Esconder todas as páginas
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Atualizar links do menu
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Mostrar página selecionada
    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.add('active');
    }

    // Atualizar título
    const titles = {
        'clientes': 'Clientes',
        'instalacoes': 'Instalações',
        'detalhe-instalacao': 'Detalhe da Instalação',
        'documentos': 'Documentos',
        'curriculos': 'Currículos',
        'notificacoes': 'Notificação push',
        'candidaturas': 'Candidaturas',
        'funcionarios': 'Funcionários'
    };
    document.getElementById('page-title').textContent = titles[pageName] || 'Painel';

    // Marcar link ativo
    const activeLink = document.querySelector(`a[onclick="showPage('${pageName}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    currentPage = pageName;

    // Carga imediata ao entrar na pagina, sem esperar o ciclo de 5s
    if (pageName === 'clientes') {
        loadClientes(false);
    } else if (pageName === 'instalacoes') {
        loadInstalacoes(false);
    } else if (pageName === 'documentos') {
        loadDocumentos(false);
    } else if (pageName === 'curriculos') {
        loadCurriculos(false);
    } else if (pageName === 'candidaturas') {
        loadCandidaturas(false);
    } else if (pageName === 'detalhe-instalacao') {
        refreshDetalheInstalacao(false);
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_ROLE_KEY);
        alert('Logout realizado com sucesso!');
        showLogin();
    }
}

function clearLoginFields() {
    const usernameField = document.getElementById('login-username');
    const passwordField = document.getElementById('login-password');
    if (usernameField) usernameField.value = '';
    if (passwordField) passwordField.value = '';
}

// ============================================
// CLIENTES
// ============================================

function renderClientes() {
    const tbody = document.getElementById('clientes-tbody');
    tbody.innerHTML = '';

    clientes.forEach((cliente, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="row-checkbox" value="${cliente.id}"></td>
            <td>${cliente.nome}</td>
            <td>${cliente.cpf}</td>
            <td>${cliente.telefone}</td>
            <td>${cliente.email || '-'}</td>
            <td>${cliente.dataCadastro}</td>
            <td>${cliente.acesso || '-'}</td>
            <td><span class="status-badge status-${cliente.status.toLowerCase()}">${cliente.status}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="openClienteDetalhe(${cliente.id})">Detalhes</button>
                ${cliente.status === 'PENDENTE' ? `<button class="btn btn-primary btn-sm" onclick="liberarAcesso(${cliente.id})">Liberar</button>` : ''}
                ${isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="deleteCliente(${cliente.id})">Excluir</button>` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function openClienteDetalhe(clienteId) {
    try {
        const cliente = await apiRequest(`/api/clientes/${clienteId}`);
        document.getElementById('detail-cliente-nome').value = cliente.nome || '';
        document.getElementById('detail-cliente-cpf').value = cliente.cpf || '';
        document.getElementById('detail-cliente-telefone').value = cliente.telefone || '';
        document.getElementById('detail-cliente-email').value = cliente.email || '';
        document.getElementById('detail-cliente-status').value = (cliente.status || '').toUpperCase();
        document.getElementById('detail-cliente-acesso').value = cliente.acesso || '';
        document.getElementById('detail-cliente-cep').value = cliente.cep || '';
        document.getElementById('detail-cliente-rua').value = cliente.rua || '';
        document.getElementById('detail-cliente-numero').value = cliente.numero || '';
        document.getElementById('detail-cliente-complemento').value = cliente.complemento || '';
        document.getElementById('detail-cliente-bairro').value = cliente.bairro || '';
        document.getElementById('detail-cliente-cidade').value = cliente.cidade || '';
        document.getElementById('detail-cliente-uf').value = cliente.uf || '';
        document.getElementById('modal-cliente-detalhe').classList.add('active');
    } catch (error) {
        handleApiError(error, 'Erro ao carregar detalhes do cliente.');
    }
}

function createCliente() {
    document.getElementById('form-nome').value = '';
    document.getElementById('form-cpf').value = '';
    document.getElementById('form-telefone').value = '';
    document.getElementById('form-email').value = '';
    document.getElementById('modal-cliente').classList.add('active');
}

async function saveCliente(event) {
    event.preventDefault();

    const nome = document.getElementById('form-nome').value;
    const cpf = document.getElementById('form-cpf').value;
    const telefone = document.getElementById('form-telefone').value;
    const email = document.getElementById('form-email').value;
    const senha = `Acesso${Math.random().toString(36).slice(2, 10)}`;

    try {
        await apiRequest('/api/clientes', {
            method: 'POST',
            body: JSON.stringify({ nome, cpf, telefone, email, senha })
        });
        await loadClientes();
        closeModal('modal-cliente');
        alert('Cliente criado com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao criar cliente.');
    }
}

async function liberarAcesso(clienteId) {
    try {
        const response = await apiRequest(`/api/clientes/${clienteId}/liberar`, {
            method: 'POST'
        });
        const clienteAtualizado = response.cliente;
        clientes = clientes.map((cliente) => (
            cliente.id === clienteId
                ? {
                    ...cliente,
                    acesso: clienteAtualizado.acesso || cliente.acesso,
                    status: (clienteAtualizado.status || cliente.status).toUpperCase()
                }
                : cliente
        ));
        renderClientes();
        alert(`Acesso liberado! Credencial: ${clienteAtualizado.acesso}`);
    } catch (error) {
        handleApiError(error, 'Erro ao liberar acesso.');
    }
}

async function deleteCliente(clienteId) {
    if (!confirm('Tem certeza que deseja deletar este cliente?')) {
        return;
    }

    try {
        await apiRequest(`/api/clientes/${clienteId}`, { method: 'DELETE' });
        await loadClientes();
        alert('Cliente deletado com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao deletar cliente.');
    }
}

function selectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

async function deleteSelected() {
    const selected = document.querySelectorAll('.row-checkbox:checked');
    if (selected.length === 0) {
        alert('Selecione pelo menos um cliente!');
        return;
    }

    if (!confirm(`Tem certeza que deseja deletar ${selected.length} cliente(s)?`)) {
        return;
    }

    try {
        const ids = Array.from(selected).map(cb => parseInt(cb.value, 10));
        await Promise.all(ids.map((id) => apiRequest(`/api/clientes/${id}`, { method: 'DELETE' })));
        await loadClientes();
        alert('Cliente(s) deletado(s) com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao deletar clientes.');
    }
}

function sortTable(column) {
    clientes.sort((a, b) => {
        const aVal = a[column].toString().toLowerCase();
        const bVal = b[column].toString().toLowerCase();
        return aVal.localeCompare(bVal);
    });
    renderClientes();
}

// ============================================
// INSTALAÇÕES
// ============================================

function renderInstalacoes() {
    const tbody = document.getElementById('instalacoes-tbody');
    tbody.innerHTML = '';

    instalacoes.forEach((inst) => {
        const row = document.createElement('tr');
        const statusClass = inst.status === 'ATIVO' ? 'status-ativo' : 'status-inativo';
        const online = isInstalacaoOnline(inst.lastPing);
        const onlineClass = online ? 'status-online' : 'status-offline';
        const onlineLabel = online ? 'Online' : 'Offline';
        const deleteButton = isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="deleteInstalacao(${inst.id})">Excluir</button>` : '';
        row.innerHTML = `
            <td>${inst.cliente}</td>
            <td>${inst.email}</td>
            <td>${inst.instalador}</td>
            <td>${inst.dataInstalacao}</td>
            <td>${inst.ultimoAcesso}</td>
            <td><span class="status-badge ${statusClass}">${inst.status}</span></td>
            <td><span class="status-badge ${onlineClass}">${onlineLabel}</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openInstalacao(${inst.id})">Abrir</button>
                ${deleteButton}
            </td>
        `;
        tbody.appendChild(row);
    });

    updateStats();
}

function isInstalacaoOnline(lastPing) {
    if (!lastPing) {
        return false;
    }
    const pingDate = new Date(lastPing);
    if (Number.isNaN(pingDate.getTime())) {
        return false;
    }
    return (Date.now() - pingDate.getTime()) <= 30 * 1000;
}

function filterInstalacoes() {
    const search = document.getElementById('search-instalacoes').value.toLowerCase();
    const banco = document.getElementById('filter-banco').value;
    const status = document.getElementById('filter-status').value;

    const filtered = instalacoes.filter(inst => {
        const matchSearch = inst.cliente.toLowerCase().includes(search) ||
                          inst.email.toLowerCase().includes(search) ||
                          inst.instalador.toLowerCase().includes(search);
        const matchBanco = !banco || inst.banco === banco;
        const matchStatus = !status || (status === 'ativo' && inst.status === 'ATIVO') || (status === 'inativo' && inst.status !== 'ATIVO');

        return matchSearch && matchBanco && matchStatus;
    });

    const tbody = document.getElementById('instalacoes-tbody');
    tbody.innerHTML = '';

    filtered.forEach((inst) => {
        const row = document.createElement('tr');
        const statusClass = inst.status === 'ATIVO' ? 'status-ativo' : 'status-inativo';
        const deleteButton = isAdmin() ? `<button class="btn btn-danger btn-sm" onclick="deleteInstalacao(${inst.id})">Excluir</button>` : '';
        row.innerHTML = `
            <td>${inst.cliente}</td>
            <td>${inst.email}</td>
            <td>${inst.instalador}</td>
            <td>${inst.dataInstalacao}</td>
            <td>${inst.ultimoAcesso}</td>
            <td><span class="status-badge ${statusClass}">${inst.status}</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openInstalacao(${inst.id})">Abrir</button>
                ${deleteButton}
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteInstalacao(instId) {
    if (!confirm('Tem certeza que deseja excluir esta instalacao?')) {
        return;
    }

    try {
        await apiRequest(`/api/instalacoes/${instId}`, { method: 'DELETE' });
        await loadInstalacoes();
        alert('Instalacao excluida com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao excluir instalacao.');
    }
}

function updateStats() {
    const total = instalacoes.length;
    const ativos = instalacoes.filter(i => i.status === 'ATIVO').length;
    const linksDesativados = instalacoes.filter((i) => i.status === 'ATIVO' && i.linkDesativado).length;
    const linkSem = instalacoes.filter((i) => i.status === 'ATIVO' && i.semLink).length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-ativos').textContent = ativos;
    document.getElementById('stat-inativos').textContent = linksDesativados;
    document.getElementById('stat-link-sem').textContent = linkSem;
}

async function openInstalacao(instId) {
    bindProcessoFieldListeners();
    processoFieldsDirty = false;
    const normalizedId = Number(instId);
    currentInstalacao = instalacoes.find(i => Number(i.id) === normalizedId);
    if (currentInstalacao) {
        document.getElementById('detail-id-instalacao').value = String(currentInstalacao.id);
        document.getElementById('detail-id-cliente').value = String(currentInstalacao.clienteId || '');
        document.getElementById('detail-card-instalador').textContent = currentInstalacao.instalador;
        document.getElementById('detail-card-operador').textContent = 'Não informado';
        document.getElementById('detail-card-acesso').textContent = currentInstalacao.ultimoAcesso;
        document.getElementById('detail-card-status').textContent = currentInstalacao.status;
        document.getElementById('detail-link-url').value = '';
        document.getElementById('detail-link-status').value = 'em-progresso';
        document.getElementById('detail-operador').value = '';
        document.getElementById('detail-instalador').value = currentInstalacao.instalador;

        // Renderizar histórico
        await renderHistory();
        renderDocumentosDetalhe();

        try {
            const processo = await apiRequest(`/api/clientes/${currentInstalacao.clienteId}/processo-seletivo`, {
                method: 'GET'
            });
            if (!processoFieldsDirty && !isEditingProcessoFields()) {
                document.getElementById('detail-link-url').value = extractOriginalProcessoLink(processo?.linkEntrevista || '');
                document.getElementById('detail-link-status').value = mapApiStatusToDetail(processo?.status);
                document.getElementById('detail-toggle-emparelhar').checked = isEmparelharAtivo(processo?.status);
            }
            updateDetalhePermissoes();
        } catch (error) {
            console.error('Erro ao carregar processo seletivo:', error);
        }

        showPage('detalhe-instalacao');
    }
}

async function refreshDetalheInstalacao(showAlert = false) {
    if (!currentInstalacao?.id || !currentInstalacao?.clienteId) {
        return;
    }

    try {
        await Promise.all([
            loadInstalacoes(showAlert),
            loadDocumentos(showAlert)
        ]);

        const atualizado = instalacoes.find((i) => Number(i.id) === Number(currentInstalacao.id));
        if (atualizado) {
            currentInstalacao = atualizado;
        }

        document.getElementById('detail-id-instalacao').value = String(currentInstalacao.id);
        document.getElementById('detail-id-cliente').value = String(currentInstalacao.clienteId || '');
        document.getElementById('detail-card-instalador').textContent = currentInstalacao.instalador || '-';
        document.getElementById('detail-card-operador').textContent = 'Não informado';
        document.getElementById('detail-card-acesso').textContent = currentInstalacao.ultimoAcesso || '-';
        document.getElementById('detail-card-status').textContent = currentInstalacao.status || '-';

        const processo = await apiRequest(`/api/clientes/${currentInstalacao.clienteId}/processo-seletivo`, {
            method: 'GET'
        });
        if (!processoFieldsDirty && !isEditingProcessoFields()) {
            document.getElementById('detail-link-url').value = extractOriginalProcessoLink(processo?.linkEntrevista || '');
            document.getElementById('detail-link-status').value = mapApiStatusToDetail(processo?.status);
            document.getElementById('detail-toggle-emparelhar').checked = isEmparelharAtivo(processo?.status);
        }
        updateDetalhePermissoes();

        await renderHistory();
        renderDocumentosDetalhe();
    } catch (error) {
        console.error('Erro ao atualizar detalhe da instalação:', error);
    }
}

async function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody || !currentInstalacao?.id) {
        return;
    }

    try {
        const historico = await apiRequest(`/api/instalacoes/${currentInstalacao.id}/historico`, { method: 'GET' });
        if (!Array.isArray(historico) || historico.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td>${currentInstalacao.dataInstalacao}</td>
                    <td>INSTALACAO_CRIADA</td>
                    <td>Instalação registrada</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = historico.map((item) => `
            <tr>
                <td>${formatDate(item.data_evento)}</td>
                <td>${item.acao || '-'}</td>
                <td>${item.detalhes || '-'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        tbody.innerHTML = `
            <tr>
                <td>${currentInstalacao.dataInstalacao}</td>
                <td>INSTALACAO_CRIADA</td>
                <td>Instalação registrada</td>
            </tr>
        `;
    }
}

async function requestDocument() {
    if (!currentInstalacao?.clienteId) {
        alert('Cliente nao encontrado para esta instalacao.');
        return;
    }

    try {
        await apiRequest(`/api/clientes/${currentInstalacao.clienteId}/solicitar-documento`, { method: 'POST' });
        alert('Solicitação de documento enviada ao cliente!');
        document.getElementById('document-status').textContent = '⏳';
    } catch (error) {
        handleApiError(error, 'Erro ao solicitar documento.');
    }
}

function renderDocumentosDetalhe() {
    const container = document.getElementById('detail-documentos-list');
    if (!container || !currentInstalacao) {
        return;
    }

    const docs = documentos.filter((doc) => doc.clienteId === currentInstalacao.clienteId);
    container.innerHTML = '';

    if (docs.length === 0) {
        document.getElementById('document-status').textContent = '❌';
        container.innerHTML = '<div class="document-item">Nenhum documento enviado.</div>';
        return;
    }

    updateDocumentoStatusIcon(docs);

    docs.forEach((doc) => {
        const statusClass = (doc.status || 'PENDENTE').toLowerCase();
        const row = document.createElement('div');
        row.className = 'document-item';
        row.innerHTML = `
            <div class="document-item-info">
                <strong>${doc.arquivo}</strong>
                <span>${doc.data}</span>
                <span class="document-status-badge ${statusClass}">${doc.status}</span>
            </div>
            <div class="document-item-actions">
                <button class="btn btn-secondary btn-sm" onclick="downloadDocumento('${doc.arquivo}')">Ver</button>
                <button class="btn btn-primary btn-sm" onclick="updateDocumentoStatus(${doc.id}, 'APROVADO')">Aprovar</button>
                <button class="btn btn-danger btn-sm" onclick="updateDocumentoStatus(${doc.id}, 'REJEITADO')">Rejeitar</button>
            </div>
        `;
        container.appendChild(row);
    });
}

function updateDocumentoStatusIcon(docs) {
    const statusIcon = document.getElementById('document-status');
    if (!statusIcon) {
        return;
    }

    const hasPendente = docs.some((doc) => doc.status === 'PENDENTE');
    const hasRejeitado = docs.some((doc) => doc.status === 'REJEITADO');
    const hasAprovado = docs.some((doc) => doc.status === 'APROVADO');

    if (hasPendente) {
        statusIcon.textContent = '⏳';
        return;
    }

    if (hasRejeitado && !hasAprovado) {
        statusIcon.textContent = '❌';
        return;
    }

    statusIcon.textContent = '✅';
}

async function updateDocumentoStatus(docId, status) {
    let motivoRejeicao = '';
    if (status === 'REJEITADO') {
        const motivoInput = prompt('Informe o motivo da rejeição para enviar ao cliente:');
        if (motivoInput === null) {
            return;
        }
        motivoRejeicao = motivoInput.trim();
        if (!motivoRejeicao) {
            alert('Informe um motivo para rejeitar o documento.');
            return;
        }
    }

    try {
        await apiRequest(`/api/documentos/${docId}/status`, {
            method: 'PUT',
            body: JSON.stringify({
                status,
                motivo: motivoRejeicao
            })
        });
        await loadDocumentos(false);
        renderDocumentosDetalhe();
        alert(`Documento ${status.toLowerCase()} com sucesso!`);
    } catch (error) {
        handleApiError(error, 'Erro ao atualizar status do documento.');
    }
}

async function saveDetail() {
    if (!isAdminOrOperador()) {
        alert('Acesso restrito!');
        return;
    }

    if (!currentInstalacao?.clienteId) {
        alert('Instalacao invalida para salvar.');
        return;
    }

    const rawLinkUrl = document.getElementById('detail-link-url').value;
    const statusSelecionado = document.getElementById('detail-link-status').value;
    const emparelharAtivo = document.getElementById('detail-toggle-emparelhar').checked;
    const linkEntrevista = normalizeProcessoLink(rawLinkUrl);
    const status = emparelharAtivo ? mapDetailStatusToApi(statusSelecionado) : 'PENDENTE';

    try {
        await apiRequest(`/api/clientes/${currentInstalacao.clienteId}/processo-seletivo`, {
            method: 'PUT',
            body: JSON.stringify({
                linkEntrevista,
                status
            })
        });
        currentInstalacao.linkUrl = linkEntrevista;
        processoFieldsDirty = false;
        await renderHistory();
        alert('Alterações salvas com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao salvar processo seletivo.');
    }
}

// ============================================
// MODAL
// ============================================

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

window.onclick = function(event) {
    const modal = document.getElementById('modal-cliente');
    if (event.target === modal) {
        modal.classList.remove('active');
    }
};

// ============================================
// EXPORTAÇÃO
// ============================================

function exportData(type) {
    let data = [];
    let filename = '';

    if (type === 'clientes') {
        data = clientes;
        filename = 'clientes.csv';
    } else if (type === 'instalacoes') {
        data = instalacoes;
        filename = 'instalacoes.csv';
    } else if (type === 'notificacoes') {
        data = notificacoes;
        filename = 'notificacoes.csv';
    } else if (type === 'candidaturas') {
        data = candidaturas;
        filename = 'candidaturas.csv';
    } else if (type === 'operadores') {
        data = operadores;
        filename = 'operadores.csv';
    } else if (type === 'documentos') {
        data = documentos;
        filename = 'documentos.csv';
    } else if (type === 'curriculos') {
        data = curriculos;
        filename = 'curriculos.csv';
    }

    if (data.length === 0) {
        alert('Nenhum dado para exportar!');
        return;
    }

    // Criar CSV
    let csv = Object.keys(data[0]).join(',') + '\n';
    data.forEach(row => {
        csv += Object.values(row).join(',') + '\n';
    });

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);

    alert('Dados exportados com sucesso!');
}

// ============================================
// UTILITÁRIOS
// ============================================

// ============================================
// NOTIFICACOES PUSH
// ============================================

async function loadCandidaturas(showAlert = true) {
    try {
        const data = await apiRequest('/api/candidaturas');
        candidaturas = (data || []).map((item) => ({
            id: item.id,
            cliente: item.cliente_nome || '-',
            vaga: item.titulo_vaga || '-',
            status: (item.status || 'PENDENTE').toUpperCase(),
            data: formatDate(item.data_candidatura),
            dataRaw: item.data_candidatura || ''
        }));
        filterCandidaturas();
        if (currentPage === 'candidaturas') {
            markCandidaturasAsSeen();
        } else {
            updateCandidaturasMenuAlert();
        }
    } catch (error) {
        handleApiError(error, 'Erro ao carregar candidaturas.', showAlert);
    }
}

function getClienteNumericId(cliente) {
    const raw = Number(cliente?.id);
    return Number.isFinite(raw) ? raw : 0;
}

function getMaxClienteId(lista = clientes) {
    return lista.reduce((maxId, item) => {
        const id = getClienteNumericId(item);
        return id > maxId ? id : maxId;
    }, 0);
}

function countUnseenClientes(lista = clientes) {
    return lista.filter((item) => getClienteNumericId(item) > clientesLastSeenId).length;
}

function updateClientesMenuAlert() {
    const badge = document.getElementById('nav-clientes-alert');
    if (!badge) return;
    const unseen = countUnseenClientes();
    if (unseen > 0) {
        badge.textContent = unseen > 99 ? '99+' : String(unseen);
        badge.style.display = 'inline-flex';
    } else {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
}

function markClientesAsSeen() {
    const maxId = getMaxClienteId();
    if (maxId > clientesLastSeenId) {
        clientesLastSeenId = maxId;
        localStorage.setItem(CLIENTES_LAST_SEEN_KEY, String(clientesLastSeenId));
    }
    updateClientesMenuAlert();
}

function getInstalacaoNumericId(instalacao) {
    const raw = Number(instalacao?.id);
    return Number.isFinite(raw) ? raw : 0;
}

function getMaxInstalacaoId(lista = instalacoes) {
    return lista.reduce((maxId, item) => {
        const id = getInstalacaoNumericId(item);
        return id > maxId ? id : maxId;
    }, 0);
}

function countUnseenInstalacoes(lista = instalacoes) {
    return lista.filter((item) => getInstalacaoNumericId(item) > instalacoesLastSeenId).length;
}

function updateInstalacoesMenuAlert() {
    const badge = document.getElementById('nav-instalacoes-alert');
    if (!badge) return;
    const unseen = countUnseenInstalacoes();
    if (unseen > 0) {
        badge.textContent = unseen > 99 ? '99+' : String(unseen);
        badge.style.display = 'inline-flex';
    } else {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
}

function markInstalacoesAsSeen() {
    const maxId = getMaxInstalacaoId();
    if (maxId > instalacoesLastSeenId) {
        instalacoesLastSeenId = maxId;
        localStorage.setItem(INSTALACOES_LAST_SEEN_KEY, String(instalacoesLastSeenId));
    }
    updateInstalacoesMenuAlert();
}

function getCandidaturaNumericId(candidatura) {
    const raw = Number(candidatura?.id);
    return Number.isFinite(raw) ? raw : 0;
}

function getMaxCandidaturaId(lista = candidaturas) {
    return lista.reduce((maxId, item) => {
        const id = getCandidaturaNumericId(item);
        return id > maxId ? id : maxId;
    }, 0);
}

function countUnseenCandidaturas(lista = candidaturas) {
    return lista.filter((item) => getCandidaturaNumericId(item) > candidaturasLastSeenId).length;
}

function updateCandidaturasMenuAlert() {
    const badge = document.getElementById('nav-candidaturas-alert');
    if (!badge) return;
    const unseen = countUnseenCandidaturas();
    if (unseen > 0) {
        badge.textContent = unseen > 99 ? '99+' : String(unseen);
        badge.style.display = 'inline-block';
    } else {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
}

function markCandidaturasAsSeen() {
    const maxId = getMaxCandidaturaId();
    if (maxId > candidaturasLastSeenId) {
        candidaturasLastSeenId = maxId;
        localStorage.setItem(CANDIDATURAS_LAST_SEEN_KEY, String(candidaturasLastSeenId));
    }
    updateCandidaturasMenuAlert();
}

function getCurriculoNumericId(curriculo) {
    const raw = Number(curriculo?.id);
    return Number.isFinite(raw) ? raw : 0;
}

function getMaxCurriculoId(lista = curriculos) {
    return lista.reduce((maxId, item) => {
        const id = getCurriculoNumericId(item);
        return id > maxId ? id : maxId;
    }, 0);
}

function countUnseenCurriculos(lista = curriculos) {
    return lista.filter((item) => getCurriculoNumericId(item) > curriculosLastSeenId).length;
}

function updateCurriculosMenuAlert() {
    const badge = document.getElementById('nav-curriculos-alert');
    if (!badge) return;
    const unseen = countUnseenCurriculos();
    if (unseen > 0) {
        badge.textContent = unseen > 99 ? '99+' : String(unseen);
        badge.style.display = 'inline-block';
    } else {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
}

function markCurriculosAsSeen() {
    const maxId = getMaxCurriculoId();
    if (maxId > curriculosLastSeenId) {
        curriculosLastSeenId = maxId;
        localStorage.setItem(CURRICULOS_LAST_SEEN_KEY, String(curriculosLastSeenId));
    }
    updateCurriculosMenuAlert();
}

function renderCurriculos() {
    const tbody = document.getElementById('curriculos-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    curriculos.forEach((item) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.id}</td>
            <td>${item.cliente}</td>
            <td>${item.arquivo}</td>
            <td>${item.data}</td>
            <td><span class="status-badge status-ativo">${item.status}</span></td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="abrirCurriculo('${item.urlArquivo}')">Ver</button>
                <button class="btn btn-danger btn-sm" onclick="excluirCurriculo(${item.id})">Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function abrirCurriculo(urlArquivo) {
    if (!urlArquivo) {
        alert('URL do currículo indisponível.');
        return;
    }
    window.open(urlArquivo, '_blank');
}

async function excluirCurriculo(curriculoId) {
    if (!confirm('Tem certeza que deseja excluir este currículo?')) {
        return;
    }
    try {
        await apiRequest(`/api/curriculos/${curriculoId}`, { method: 'DELETE' });
        await loadCurriculos(false);
        showToast('Currículo excluído com sucesso.');
    } catch (error) {
        handleApiError(error, 'Erro ao excluir currículo.');
    }
}

function renderCandidaturas(lista = candidaturas) {
    const tbody = document.getElementById('candidaturas-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    lista.forEach((cand) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${cand.id}</td>
            <td>${cand.cliente}</td>
            <td>${cand.vaga}</td>
            <td><span class="status-badge status-${cand.status.toLowerCase()}">${cand.status}</span></td>
            <td>${cand.data}</td>
            <td class="candidaturas-col-acoes">
                <div class="candidaturas-acoes">
                    <select class="cand-status-select" onchange="updateCandidaturaStatus(${cand.id}, this.value)">
                        <option value="PENDENTE" ${cand.status === 'PENDENTE' ? 'selected' : ''}>PENDENTE</option>
                        <option value="EM_ANALISE" ${cand.status === 'EM_ANALISE' ? 'selected' : ''}>EM ANÁLISE</option>
                        <option value="APROVADA" ${cand.status === 'APROVADA' ? 'selected' : ''}>APROVADA</option>
                        <option value="REJEITADA" ${cand.status === 'REJEITADA' ? 'selected' : ''}>REJEITADA</option>
                    </select>
                    <button class="btn btn-danger btn-sm" onclick="deleteCandidatura(${cand.id})">Excluir</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateCandidaturasStats(lista);
    updateCandidaturasSortIndicators();
}

function filterCandidaturas() {
    const search = (document.getElementById('search-candidaturas')?.value || '').trim().toLowerCase();
    const status = (document.getElementById('filter-candidaturas-status')?.value || '').trim().toUpperCase();
    const dataInicio = document.getElementById('filter-candidaturas-data-inicio')?.value || '';
    const dataFim = document.getElementById('filter-candidaturas-data-fim')?.value || '';

    const inicioTime = dataInicio ? new Date(`${dataInicio}T00:00:00`).getTime() : null;
    const fimTime = dataFim ? new Date(`${dataFim}T23:59:59`).getTime() : null;

    const filtradas = candidaturas.filter((cand) => {
        const cliente = String(cand.cliente || '').toLowerCase();
        const vaga = String(cand.vaga || '').toLowerCase();
        const matchBusca = !search || cliente.includes(search) || vaga.includes(search);
        const matchStatus = !status || cand.status === status;

        let matchData = true;
        if (inicioTime !== null || fimTime !== null) {
            const candTime = cand.dataRaw ? new Date(cand.dataRaw).getTime() : NaN;
            if (Number.isNaN(candTime)) {
                matchData = false;
            } else {
                if (inicioTime !== null && candTime < inicioTime) matchData = false;
                if (fimTime !== null && candTime > fimTime) matchData = false;
            }
        }

        return matchBusca && matchStatus && matchData;
    });

    const ordenadas = applyCandidaturasSort(filtradas);
    renderCandidaturas(ordenadas);
}

function clearCandidaturasFilters() {
    const searchEl = document.getElementById('search-candidaturas');
    const statusEl = document.getElementById('filter-candidaturas-status');
    const inicioEl = document.getElementById('filter-candidaturas-data-inicio');
    const fimEl = document.getElementById('filter-candidaturas-data-fim');
    if (searchEl) searchEl.value = '';
    if (statusEl) statusEl.value = '';
    if (inicioEl) inicioEl.value = '';
    if (fimEl) fimEl.value = '';
    filterCandidaturas();
}

function sortCandidaturas(column) {
    if (candidaturasSort.column === column) {
        candidaturasSort.direction = candidaturasSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        candidaturasSort.column = column;
        candidaturasSort.direction = column === 'dataRaw' ? 'desc' : 'asc';
    }
    filterCandidaturas();
}

function applyCandidaturasSort(lista) {
    const { column, direction } = candidaturasSort;
    const fator = direction === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
        if (column === 'dataRaw') {
            const ta = a.dataRaw ? new Date(a.dataRaw).getTime() : 0;
            const tb = b.dataRaw ? new Date(b.dataRaw).getTime() : 0;
            return (ta - tb) * fator;
        }

        const va = String(a[column] || '').toUpperCase();
        const vb = String(b[column] || '').toUpperCase();
        return va.localeCompare(vb) * fator;
    });
}

function updateCandidaturasSortIndicators() {
    const statusHeader = document.getElementById('cand-sort-status');
    const dataHeader = document.getElementById('cand-sort-data');
    if (!statusHeader || !dataHeader) return;

    statusHeader.textContent = 'Status ↕';
    dataHeader.textContent = 'Data ↕';

    if (candidaturasSort.column === 'status') {
        statusHeader.textContent = candidaturasSort.direction === 'asc' ? 'Status ↑' : 'Status ↓';
    }
    if (candidaturasSort.column === 'dataRaw') {
        dataHeader.textContent = candidaturasSort.direction === 'asc' ? 'Data ↑' : 'Data ↓';
    }
}

function updateCandidaturasStats(lista = candidaturas) {
    const total = lista.length;
    const pendentes = lista.filter((c) => c.status === 'PENDENTE').length;
    const aprovadas = lista.filter((c) => c.status === 'APROVADA').length;
    const rejeitadas = lista.filter((c) => c.status === 'REJEITADA').length;

    const totalEl = document.getElementById('cand-stat-total');
    const pendEl = document.getElementById('cand-stat-pendentes');
    const aprEl = document.getElementById('cand-stat-aprovadas');
    const rejEl = document.getElementById('cand-stat-rejeitadas');
    if (totalEl) totalEl.textContent = String(total);
    if (pendEl) pendEl.textContent = String(pendentes);
    if (aprEl) aprEl.textContent = String(aprovadas);
    if (rejEl) rejEl.textContent = String(rejeitadas);
}

async function updateCandidaturaStatus(candidaturaId, status) {
    try {
        await apiRequest(`/api/candidaturas/${candidaturaId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        await loadCandidaturas(false);
        showToast('Status da candidatura atualizado.');
    } catch (error) {
        handleApiError(error, 'Erro ao atualizar status da candidatura.');
    }
}

async function deleteCandidatura(candidaturaId) {
    if (!confirm('Tem certeza que deseja excluir esta candidatura?')) {
        return;
    }
    try {
        await apiRequest(`/api/candidaturas/${candidaturaId}`, { method: 'DELETE' });
        await loadCandidaturas(false);
        showToast('Candidatura excluída com sucesso.');
    } catch (error) {
        handleApiError(error, 'Erro ao excluir candidatura.');
    }
}

function renderNotificacoes() {
    const tbody = document.getElementById('notificacoes-tbody');
    tbody.innerHTML = '';

    notificacoes.forEach((notif) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="row-checkbox-notif" value="${notif.id}"></td>
            <td>${notif.euia}</td>
            <td>${notif.instalacao}</td>
            <td>${notif.titulo}</td>
            <td>${notif.mensagem.substring(0, 50)}...</td>
            <td><span class="status-badge status-${notif.status.toLowerCase()}">${notif.status}</span></td>
            <td>${notif.data}</td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editNotificacao(${notif.id})">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="deleteNotificacao(${notif.id})">Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openModalNotificacao() {
    document.getElementById('form-notif-instalacao').value = '';
    document.getElementById('form-notif-titulo').value = '';
    document.getElementById('form-notif-mensagem').value = '';
    document.getElementById('form-notif-imagem').value = '';
    document.getElementById('form-notif-evento').value = '';
    document.getElementById('modal-notificacao').classList.add('active');
}

async function saveNotificacao(event) {
    event.preventDefault();

    const instalacao = document.getElementById('form-notif-instalacao').value;
    const titulo = document.getElementById('form-notif-titulo').value;
    const mensagem = document.getElementById('form-notif-mensagem').value;
    const imagem = document.getElementById('form-notif-imagem').value;
    const evento = document.getElementById('form-notif-evento').value;

    if (!instalacao || !titulo || !mensagem || !evento) {
        alert('Preencha todos os campos obrigatorios!');
        return;
    }

    const instalacaoId = parseInstalacaoId(instalacao);
    if (!instalacaoId) {
        alert('Instalacao invalida!');
        return;
    }

    try {
        await apiRequest('/api/notificacoes', {
            method: 'POST',
            body: JSON.stringify({
                instalacao_id: instalacaoId,
                titulo,
                mensagem,
                url_imagem: imagem,
                nome_evento: evento
            })
        });
        await loadNotificacoes();
        closeModal('modal-notificacao');
        alert('Notificacao criada com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao criar notificacao.');
    }
}

function editNotificacao(notifId) {
    const notif = notificacoes.find(n => n.id === notifId);
    if (notif) {
        document.getElementById('form-notif-instalacao').value = notif.instalacao;
        document.getElementById('form-notif-titulo').value = notif.titulo;
        document.getElementById('form-notif-mensagem').value = notif.mensagem;
        document.getElementById('form-notif-evento').value = notif.evento;
        document.getElementById('modal-notificacao').classList.add('active');
    }
}

function selectAllNotif(checkbox) {
    const checkboxes = document.querySelectorAll('.row-checkbox-notif');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

async function deleteNotificacao(notifId) {
    if (!confirm('Tem certeza que deseja excluir esta notificação push?')) {
        return;
    }

    try {
        await apiRequest(`/api/notificacoes/${notifId}`, { method: 'DELETE' });
        await loadNotificacoes();
        alert('Notificação push excluída com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao excluir notificação push.');
    }
}

async function deleteSelectedNotificacoes() {
    const selected = document.querySelectorAll('.row-checkbox-notif:checked');
    if (selected.length === 0) {
        alert('Selecione pelo menos uma notificação push!');
        return;
    }

    if (!confirm(`Tem certeza que deseja excluir ${selected.length} notificação(ões) push?`)) {
        return;
    }

    try {
        const ids = Array.from(selected).map((cb) => parseInt(cb.value, 10)).filter((id) => !Number.isNaN(id));
        await Promise.all(ids.map((id) => apiRequest(`/api/notificacoes/${id}`, { method: 'DELETE' })));
        await loadNotificacoes();
        alert('Notificações push excluídas com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao excluir notificações push.');
    }
}

function sortNotificacoes(column) {
    notificacoes.sort((a, b) => {
        const aVal = a[column].toString().toLowerCase();
        const bVal = b[column].toString().toLowerCase();
        return aVal.localeCompare(bVal);
    });
    renderNotificacoes();
}

// ============================================
// ADMINISTRACAO - OPERADORES
// ============================================

function renderOperadores() {
    const container = document.getElementById('operadores-list');
    container.innerHTML = '';

    operadores.forEach((operador) => {
        const operadorDiv = document.createElement('div');
        operadorDiv.className = 'operador-section';
        const addUsuarioButton = isAdminOrOperador()
            ? `<button class="btn btn-primary btn-sm" onclick="openModalUsuario(${operador.id})">NOVO INSTALADOR</button>`
            : '';
        const deleteOperadorButton = isAdmin()
            ? `<button class="btn btn-danger btn-sm" onclick="deleteOperador(${operador.id})">EXCLUIR OPERADOR</button>`
            : '';
        const usuariosHtml = operador.usuarios.map((usuario) => {
            const usuarioActions = isAdmin()
                ? `<div class="usuario-actions">
                        <button class="btn btn-primary btn-sm" onclick="editarUsuario(${operador.id}, ${usuario.id})">TROCAR</button>
                        <button class="btn btn-primary btn-sm" onclick="trocarSenha(${operador.id}, ${usuario.id})">TROCAR SENHA</button>
                        <button class="btn btn-danger btn-sm" onclick="excluirUsuario(${operador.id}, ${usuario.id})">EXCLUIR</button>
                    </div>`
                : '';

            return `
                <div class="usuario-item">
                    <span>👥 ${usuario.conecte}</span>
                    ${usuarioActions}
                </div>
            `;
        }).join('');

        operadorDiv.innerHTML = `
            <div class="operador-header">
                <h3>👤 Operador: ${operador.nome}</h3>
                <div class="usuario-actions">
                    ${addUsuarioButton}
                    ${deleteOperadorButton}
                </div>
            </div>
            <div class="usuarios-list">
                ${usuariosHtml}
            </div>
        `;
        container.appendChild(operadorDiv);
    });
}

async function deleteOperador(operadorId) {
    if (!isAdminOrOperador()) {
        alert('Acesso restrito.');
        return;
    }
    if (!confirm('Tem certeza que deseja excluir este operador e seus instaladores?')) {
        return;
    }

    try {
        await apiRequest(`/api/operadores/${operadorId}`, { method: 'DELETE' });
        await loadOperadores();
        alert('Operador excluido com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao excluir operador.');
    }
}

function openModalUsuario(operadorId) {
    if (!isAdminOrOperador()) {
        alert('Acesso restrito.');
        return;
    }
    document.getElementById('form-user-operador-id').value = operadorId;
    document.getElementById('form-user-conecte').value = '';
    document.getElementById('form-user-senha').value = '';
    document.getElementById('modal-usuario').classList.add('active');
}

async function saveUsuario(event) {
    event.preventDefault();
    if (!isAdminOrOperador()) {
        alert('Acesso restrito.');
        return;
    }

    const operadorId = document.getElementById('form-user-operador-id').value;
    const conecte = document.getElementById('form-user-conecte').value;
    const senha = document.getElementById('form-user-senha').value;

    if (!operadorId || !conecte || !senha) {
        alert('Preencha todos os campos obrigatorios!');
        return;
    }

    try {
        await apiRequest(`/api/operadores/${operadorId}/usuarios`, {
            method: 'POST',
            body: JSON.stringify({ conecte, tipo: 'Instalador', senha })
        });
        await loadOperadores();
        closeModal('modal-usuario');
        alert('Instalador criado com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao criar instalador.');
    }
}

function openModalOperador() {
    if (!isAdmin()) {
        alert('Acesso restrito.');
        return;
    }
    document.getElementById('form-op-conecte').value = '';
    document.getElementById('form-op-senha').value = '';
    document.getElementById('form-op-tipo').value = '';
    document.getElementById('modal-operador').classList.add('active');
}

async function saveOperador(event) {
    if (!isAdmin()) {
        alert('Acesso restrito.');
        return;
    }
    event.preventDefault();

    const conecte = document.getElementById('form-op-conecte').value;
    const senha = document.getElementById('form-op-senha').value;
    const tipo = document.getElementById('form-op-tipo').value;

    if (!conecte || !senha || !tipo) {
        alert('Preencha todos os campos obrigatorios!');
        return;
    }

    try {
        await apiRequest('/api/operadores', {
            method: 'POST',
            body: JSON.stringify({ nome: conecte, tipo, senha })
        });
        await loadOperadores();
        closeModal('modal-operador');
        alert('Operador criado com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao criar operador.');
    }
}

function editarUsuario(operadorId, usuarioId) {
    alert('Funcionalidade de edicao em desenvolvimento...');
}

async function trocarSenha(operadorId, usuarioId) {
    if (!isAdmin()) {
        alert('Acesso restrito.');
        return;
    }

    const novaSenha = prompt('Digite a nova senha:');
    if (!novaSenha) {
        return;
    }

    try {
        await apiRequest(`/api/operadores/${operadorId}/usuarios/${usuarioId}/senha`, {
            method: 'PUT',
            body: JSON.stringify({ senha: novaSenha })
        });
        alert('Senha alterada com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao trocar senha.');
    }
}

async function excluirUsuario(operadorId, usuarioId) {
    if (!confirm('Tem certeza que deseja excluir este usuario?')) {
        return;
    }

    try {
        await apiRequest(`/api/operadores/${operadorId}/usuarios/${usuarioId}`, { method: 'DELETE' });
        await loadOperadores();
        alert('Usuario excluido com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao excluir usuario.');
    }
}

// ============================================
// DOCUMENTOS COLETADOS
// ============================================

function renderDocumentos() {
    const tbody = document.getElementById('documentos-tbody');
    tbody.innerHTML = '';

    documentos.forEach((doc) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><input type="checkbox" class="row-checkbox-doc" value="${doc.id}"></td>
            <td>${doc.euia}</td>
            <td>${doc.cliente}</td>
            <td>${doc.data}</td>
            <td><a href="#" onclick="downloadDocumento('${doc.arquivo}')" class="link-download">Clique para baixar</a></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editarDocumento(${doc.id})">EDITAR</button>
                <button class="btn btn-danger btn-sm" onclick="excluirDocumento(${doc.id})">EXCLUIR</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openModalDocumento() {
    document.getElementById('form-doc-cliente').value = '';
    document.getElementById('form-doc-arquivo').value = '';
    document.getElementById('form-doc-descricao').value = '';
    document.getElementById('modal-documento').classList.add('active');
}

async function saveDocumento(event) {
    event.preventDefault();

    const cliente = document.getElementById('form-doc-cliente').value;
    const arquivo = document.getElementById('form-doc-arquivo').value;
    const descricao = document.getElementById('form-doc-descricao').value;

    if (!cliente || !arquivo) {
        alert('Preencha os campos obrigatorios!');
        return;
    }

    const clienteMatch = clientes.find((c) => c.nome.toLowerCase() === cliente.toLowerCase());
    if (!clienteMatch) {
        alert('Cliente nao encontrado. Verifique o nome.');
        return;
    }

    try {
        await apiRequest('/api/documentos', {
            method: 'POST',
            body: JSON.stringify({
                cliente_id: clienteMatch.id,
                nome_arquivo: arquivo.split('\\').pop(),
                descricao,
                url_arquivo: ''
            })
        });
        await loadDocumentos();
        closeModal('modal-documento');
        alert('Documento adicionado com sucesso!');
    } catch (error) {
        handleApiError(error, 'Erro ao adicionar documento.');
    }
}

function editarDocumento(docId) {
    const doc = documentos.find(d => d.id === docId);
    if (doc) {
        document.getElementById('form-doc-cliente').value = doc.cliente;
        document.getElementById('form-doc-descricao').value = doc.descricao;
        document.getElementById('modal-documento').classList.add('active');
    }
}

async function excluirDocumento(docId) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) {
        return;
    }

    try {
        await apiRequest(`/api/documentos/${docId}`, { method: 'DELETE' });
        await loadDocumentos();
        alert('Documento excluido com sucesso!');
    } catch (error) {
        const mensagem = error.message?.includes('Cliente ainda ativo')
            ? 'Nao foi possivel excluir. Exclua o cliente primeiro.'
            : 'Erro ao excluir documento.';
        handleApiError(error, mensagem);
    }
}

async function downloadDocumento(nomeArquivo) {
    const documento = documentos.find((doc) => doc.arquivo === nomeArquivo);
    if (documento && documento.urlArquivo) {
        const originalUrl = documento.urlArquivo;
        const resolvedUrl = /^https?:\/\//i.test(originalUrl)
            ? originalUrl
            : `${API_URL}${originalUrl.startsWith('/') ? '' : '/'}${originalUrl}`;
        const isApiHost = resolvedUrl.startsWith(API_URL);

        try {
            const token = getAuthToken();
            const response = await fetch(resolvedUrl, {
                method: 'GET',
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error('NAO_AUTORIZADO');
                }
                throw new Error(`Falha ao abrir documento (${response.status})`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const payload = await response.json().catch(() => null);
                if (payload?.erro) {
                    throw new Error(payload.erro);
                }
            }

            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            window.open(objectUrl, '_blank');
            setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60 * 1000);
        } catch (error) {
            console.error('Erro ao abrir documento:', error);
            if (!isApiHost) {
                window.open(originalUrl, '_blank');
                return;
            }
            if (String(error?.message || '').toUpperCase().includes('NAO_AUTORIZADO')) {
                alert('Sessão sem permissão para abrir este documento. Faça login novamente.');
                return;
            }
            alert('Não foi possível abrir o documento. Tente novamente.');
        }
        return;
    }
    alert('Download indisponivel. Arquivo nao possui URL.');
}

function selectAllDocs(checkbox) {
    const checkboxes = document.querySelectorAll('.row-checkbox-doc');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

async function deleteSelectedDocs() {
    const checkboxes = document.querySelectorAll('.row-checkbox-doc:checked');
    if (checkboxes.length === 0) {
        alert('Selecione pelo menos um documento!');
        return;
    }

    if (confirm('Tem certeza que deseja deletar os documentos selecionados?')) {
        let erroClienteAtivo = false;
        for (const checkbox of checkboxes) {
            const docId = parseInt(checkbox.value, 10);
            if (Number.isNaN(docId)) {
                continue;
            }
            try {
                await apiRequest(`/api/documentos/${docId}`, { method: 'DELETE' });
            } catch (error) {
                if (error.message?.includes('Cliente ainda ativo')) {
                    erroClienteAtivo = true;
                }
            }
        }
        await loadDocumentos();
        if (erroClienteAtivo) {
            alert('Alguns documentos nao foram excluidos porque o cliente ainda existe.');
        } else {
            alert('Documentos deletados com sucesso!');
        }
    }
}

function sortDocumentos(column) {
    documentos.sort((a, b) => {
        const aVal = a[column].toString().toLowerCase();
        const bVal = b[column].toString().toLowerCase();
        return aVal.localeCompare(bVal);
    });
    renderDocumentos();
}

// Adicionar estilos para botao pequeno
const style = document.createElement('style');
style.textContent = `
    .btn-sm {
        padding: 5px 10px;
        font-size: 12px;
        margin-right: 5px;
    }
    
    .operador-section {
        background-color: #1a1a1a;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 20px;
        margin-bottom: 20px;
    }
    
    .operador-header {
        margin-bottom: 15px;
        padding-bottom: 15px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .operador-header h3 {
        margin: 0;
        color: var(--text-primary);
    }
    
    .usuarios-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .usuario-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background-color: #0f0f0f;
        border-radius: 6px;
        border: 1px solid var(--border-color);
    }
    
    .usuario-item span {
        color: var(--text-primary);
        font-weight: 500;
    }
    
    .usuario-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
    }
    
    .link-download {
        color: #2563eb;
        text-decoration: none;
        cursor: pointer;
    }
    
    .link-download:hover {
        text-decoration: underline;
    }
    
    .btn-danger {
        background-color: #ef4444;
        color: white;
    }
    
    .btn-danger:hover {
        background-color: #dc2626;
    }
    
    .link-download {
        color: #2563eb;
        text-decoration: none;
        cursor: pointer;
    }
    
    .link-download:hover {
        text-decoration: underline;
    }
    
    @media (max-width: 768px) {
        .usuario-item {
            flex-direction: column;
            align-items: flex-start;
        }
        
        .usuario-actions {
            width: 100%;
            margin-top: 10px;
        }
    }
`;
document.head.appendChild(style);
