// ============================================
// PAINEL ADMINISTRATIVO - JAVASCRIPT
// ============================================

// API
const API_URL = 'https://api.testandoapp.com';
const AUTH_STORAGE_KEY = 'adminAuthToken';

// Dados (carregados da API)
let clientes = [];
let instalacoes = [];

let currentPage = 'clientes';
let currentInstalacao = null;
let autoRefreshEnabled = false;
let autoRefreshInterval = null;
const AUTO_REFRESH_INTERVAL = 5000; // 5 segundos

let notificacoes = [];

let operadores = [
    { id: 1, nome: 'Wd520', tipo: 'Operador', usuarios: [
        { id: 1, conecte: 'JPacesso2026', tipo: 'Instalador' },
        { id: 2, conecte: 'Menorj', tipo: 'Instalador' }
    ]},
    { id: 2, nome: 'Vini.jr', tipo: 'Operador', usuarios: [
        { id: 3, conecte: 'Neguin', tipo: 'Instalador' }
    ]}
];

let documentos = [];

async function apiRequest(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getAuthToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
        headers,
        ...options
    });

    if (response.status === 401) {
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

function parseInstalacaoId(value) {
    if (!value) return null;
    if (value.startsWith('inst-')) {
        const id = parseInt(value.replace('inst-', ''), 10);
        return Number.isNaN(id) ? null : id;
    }
    const rawId = parseInt(value, 10);
    return Number.isNaN(rawId) ? null : rawId;
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
    } catch (error) {
        handleApiError(error, 'Erro ao carregar clientes.', showAlert);
    }
}

async function loadInstalacoes(showAlert = true) {
    try {
        const data = await apiRequest('/api/instalacoes');
        instalacoes = data.map((inst) => ({
            id: inst.id,
            cliente: inst.cliente_nome || 'Não informado',
            email: inst.email || '-',
            instalador: inst.instalador || '-',
            banco: inst.banco || 'link-sem',
            dataInstalacao: formatDate(inst.data_instalacao),
            ultimoAcesso: formatDate(inst.ultimo_acesso),
            status: (inst.status || 'ATIVO').toUpperCase()
        }));
        renderInstalacoes();
        updateInstalacaoOptions();
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
            cliente: doc.cliente_nome || 'Não informado',
            data: formatDate(doc.data_upload),
            arquivo: doc.nome_arquivo || 'documento',
            descricao: doc.descricao || '',
            urlArquivo: doc.url_arquivo || ''
        }));
        renderDocumentos();
    } catch (error) {
        handleApiError(error, 'Erro ao carregar documentos.', showAlert);
    }
}

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    if (isLoggedIn()) {
        showApp();
        initApp();
    } else {
        showLogin();
    }
});

function initApp() {
    loadClientes();
    loadInstalacoes();
    loadNotificacoes();
    renderOperadores();
    loadDocumentos();
}

function isLoggedIn() {
    return Boolean(getAuthToken());
}

function getAuthToken() {
    return localStorage.getItem(AUTH_STORAGE_KEY);
}

function showLogin() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    if (loginScreen) loginScreen.style.display = 'flex';
    if (appContainer) appContainer.style.display = 'none';
}

function showApp() {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    if (loginScreen) loginScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'flex';
}

function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');

    apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
    })
        .then((data) => {
            localStorage.setItem(AUTH_STORAGE_KEY, data.token);
            if (errorElement) errorElement.textContent = '';
            showApp();
            initApp();
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
    if (currentPage === 'clientes') {
        loadClientes(false);
    } else if (currentPage === 'instalacoes') {
        loadInstalacoes(false);
    } else if (currentPage === 'notificacoes') {
        loadNotificacoes(false);
    } else if (currentPage === 'funcionarios') {
        renderOperadores();
    } else if (currentPage === 'documentos') {
        loadDocumentos(false);
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
        'codigo-c6': 'Código C6',
        'documentos': 'Documentos',
        'notificacoes': 'Push Notifications',
        'funcionarios': 'Funcionários'
    };
    document.getElementById('page-title').textContent = titles[pageName] || 'Painel';

    // Marcar link ativo
    const activeLink = document.querySelector(`a[onclick="showPage('${pageName}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    currentPage = pageName;
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

function logout() {
    if (confirm('Tem certeza que deseja sair?')) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        alert('Logout realizado com sucesso!');
        showLogin();
    }
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
            <td>${cliente.dataCadastro}</td>
            <td>${cliente.acesso || '-'}</td>
            <td><span class="status-badge status-${cliente.status.toLowerCase()}">${cliente.status}</span></td>
            <td>
                ${cliente.status === 'PENDENTE' ? `<button class="btn btn-primary btn-sm" onclick="liberarAcesso(${cliente.id})">Liberar</button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="deleteCliente(${cliente.id})">Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });
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
        row.innerHTML = `
            <td>${inst.cliente}</td>
            <td>${inst.email}</td>
            <td>${inst.instalador}</td>
            <td>${inst.banco === 'link-sem' ? 'Link Sem' : 'Bradesco'}</td>
            <td>${inst.dataInstalacao}</td>
            <td>${inst.ultimoAcesso}</td>
            <td><span class="status-badge ${statusClass}">${inst.status}</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openInstalacao(${inst.id})">Abrir</button>
                <button class="btn btn-danger btn-sm" onclick="deleteInstalacao(${inst.id})">Excluir</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateStats();
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
        row.innerHTML = `
            <td>${inst.cliente}</td>
            <td>${inst.email}</td>
            <td>${inst.instalador}</td>
            <td>${inst.banco === 'link-sem' ? 'Link Sem' : 'Bradesco'}</td>
            <td>${inst.dataInstalacao}</td>
            <td>${inst.ultimoAcesso}</td>
            <td><span class="status-badge ${statusClass}">${inst.status}</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="openInstalacao(${inst.id})">Abrir</button>
                <button class="btn btn-danger btn-sm" onclick="deleteInstalacao(${inst.id})">Excluir</button>
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
    const inativos = instalacoes.filter(i => i.status !== 'ATIVO').length;
    const linkSem = instalacoes.filter(i => i.banco === 'link-sem').length;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-ativos').textContent = ativos;
    document.getElementById('stat-inativos').textContent = inativos;
    document.getElementById('stat-link-sem').textContent = linkSem;
}

function openInstalacao(instId) {
    currentInstalacao = instalacoes.find(i => i.id === instId);
    if (currentInstalacao) {
        document.getElementById('detail-id-instalacao').value = `inst-${instId}`;
        document.getElementById('detail-id-cliente').value = `cli-${instId}`;
        document.getElementById('detail-card-instalador').textContent = currentInstalacao.instalador;
        document.getElementById('detail-card-operador').textContent = 'Não informado';
        document.getElementById('detail-card-acesso').textContent = currentInstalacao.ultimoAcesso;
        document.getElementById('detail-card-status').textContent = currentInstalacao.status;
        document.getElementById('detail-link-url').value = '';
        document.getElementById('detail-link-status').value = 'em-progresso';
        document.getElementById('detail-operador').value = '';
        document.getElementById('detail-instalador').value = currentInstalacao.instalador;

        // Renderizar histórico
        renderHistory();

        showPage('detalhe-instalacao');
    }
}

function renderHistory() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = `
        <tr>
            <td>${currentInstalacao.dataInstalacao}</td>
            <td>INSTALACAO_CRIADA</td>
            <td>LINK_DESATIVADO</td>
        </tr>
        <tr>
            <td>${currentInstalacao.ultimoAcesso}</td>
            <td>ULTIMO_ACESSO</td>
            <td>CLIENTE_ACESSOU</td>
        </tr>
    `;
}

function requestDocument() {
    alert('Solicitação de documento enviada ao cliente!');
    document.getElementById('document-status').textContent = '⏳';
}

function approveDocument() {
    alert('Documento aprovado!');
    document.getElementById('document-status').textContent = '✅';
}

function rejectDocument() {
    alert('Documento rejeitado!');
    document.getElementById('document-status').textContent = '❌';
}

function saveDetail() {
    if (currentInstalacao) {
        const linkUrl = document.getElementById('detail-link-url').value;
        const operador = document.getElementById('detail-operador').value;

        if (linkUrl) {
            currentInstalacao.linkUrl = linkUrl;
        }

        alert('Alterações salvas com sucesso!');
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
    } else if (type === 'operadores') {
        data = operadores;
        filename = 'operadores.csv';
    } else if (type === 'documentos') {
        data = documentos;
        filename = 'documentos.csv';
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
        operadorDiv.innerHTML = `
            <div class="operador-header">
                <h3>👤 Operador: ${operador.nome}</h3>
            </div>
            <div class="usuarios-list">
                ${operador.usuarios.map(usuario => `
                    <div class="usuario-item">
                        <span>👥 ${usuario.conecte}</span>
                        <div class="usuario-actions">
                            <button class="btn btn-primary btn-sm" onclick="editarUsuario(${operador.id}, ${usuario.id})">TROCAR</button>
                            <button class="btn btn-primary btn-sm" onclick="trocarSenha(${operador.id}, ${usuario.id})">TROCAR SENHA</button>
                            <button class="btn btn-danger btn-sm" onclick="excluirUsuario(${operador.id}, ${usuario.id})">EXCLUIR</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        container.appendChild(operadorDiv);
    });
}

function openModalOperador() {
    document.getElementById('form-op-conecte').value = '';
    document.getElementById('form-op-senha').value = '';
    document.getElementById('form-op-tipo').value = '';
    document.getElementById('modal-operador').classList.add('active');
}

function saveOperador(event) {
    event.preventDefault();

    const conecte = document.getElementById('form-op-conecte').value;
    const senha = document.getElementById('form-op-senha').value;
    const tipo = document.getElementById('form-op-tipo').value;

    if (!conecte || !senha || !tipo) {
        alert('Preencha todos os campos obrigatorios!');
        return;
    }

    const novoOperador = {
        id: operadores.length + 1,
        nome: conecte,
        tipo: tipo,
        usuarios: []
    };

    operadores.push(novoOperador);
    renderOperadores();
    closeModal('modal-operador');
    alert('Operador criado com sucesso!');
}

function editarUsuario(operadorId, usuarioId) {
    alert('Funcionalidade de edicao em desenvolvimento...');
}

function trocarSenha(operadorId, usuarioId) {
    const novaSenha = prompt('Digite a nova senha:');
    if (novaSenha) {
        alert('Senha alterada com sucesso!');
    }
}

function excluirUsuario(operadorId, usuarioId) {
    if (confirm('Tem certeza que deseja excluir este usuario?')) {
        const operador = operadores.find(o => o.id === operadorId);
        if (operador) {
            operador.usuarios = operador.usuarios.filter(u => u.id !== usuarioId);
            renderOperadores();
            alert('Usuario excluido com sucesso!');
        }
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

function excluirDocumento(docId) {
    if (confirm('Tem certeza que deseja excluir este documento?')) {
        documentos = documentos.filter(d => d.id !== docId);
        renderDocumentos();
        alert('Documento excluido com sucesso!');
    }
}

function downloadDocumento(nomeArquivo) {
    const documento = documentos.find((doc) => doc.arquivo === nomeArquivo);
    if (documento && documento.urlArquivo) {
        window.open(documento.urlArquivo, '_blank');
        return;
    }
    alert('Download indisponivel. Arquivo nao possui URL.');
}

function selectAllDocs(checkbox) {
    const checkboxes = document.querySelectorAll('.row-checkbox-doc');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

function deleteSelectedDocs() {
    const checkboxes = document.querySelectorAll('.row-checkbox-doc:checked');
    if (checkboxes.length === 0) {
        alert('Selecione pelo menos um documento!');
        return;
    }

    if (confirm('Tem certeza que deseja deletar os documentos selecionados?')) {
        checkboxes.forEach(checkbox => {
            const docId = parseInt(checkbox.value);
            documentos = documentos.filter(d => d.id !== docId);
        });
        renderDocumentos();
        alert('Documentos deletados com sucesso!');
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
