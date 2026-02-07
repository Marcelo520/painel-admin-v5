// ============================================
// PAINEL ADMINISTRATIVO - JAVASCRIPT
// ============================================

// Dados simulados
let clientes = [
    { id: 1, nome: 'Edmar alves taveira', cpf: '07080774802', telefone: '(35) 99833-0100', email: 'edmar@email.com', dataCadastro: '20/01/2026, 22:50:18', acesso: 'Neguin', status: 'LIBERADO' },
    { id: 2, nome: 'JACQUES Sebastião gonzaga', cpf: '88364313649', telefone: '(37) 99903-1497', email: 'jacques@email.com', dataCadastro: '20/01/2026, 21:43:09', acesso: 'Vini.jr', status: 'LIBERADO' },
    { id: 3, nome: 'Eduardo Luiz Pereira', cpf: '11272285871', telefone: '(55) 11992-0115', email: 'eduardo@email.com', dataCadastro: '20/01/2026, 20:07:08', acesso: '', status: 'PENDENTE' },
    { id: 4, nome: 'Sergio Pedrosa dos Santos', cpf: '07907236894', telefone: '(11) 94787-1758', email: 'sergio@email.com', dataCadastro: '20/01/2026, 19:44:06', acesso: 'JPacesso2026', status: 'LIBERADO' },
    { id: 5, nome: 'Ronildo Oliveira dos Santos', cpf: '33653526272', telefone: '(11) 97376-2245', email: 'ronildo@email.com', dataCadastro: '20/01/2026, 19:07:17', acesso: '', status: 'PENDENTE' },
];

let instalacoes = [
    { id: 1, cliente: 'Fernando Ferreira da Mota', email: 'fmofold@gmail.com', instalador: 'JPacesso2026', banco: 'link-sem', dataInstalacao: '20/01/2026, 15:14:30', ultimoAcesso: '20/01/2026, 15:14:30', status: 'LINK SEM' },
    { id: 2, cliente: 'João Silva', email: 'joao@email.com', instalador: 'Vini.jr', banco: 'bradesco', dataInstalacao: '19/01/2026, 10:30:00', ultimoAcesso: '20/01/2026, 09:15:00', status: 'ATIVO' },
    { id: 3, cliente: 'Maria Santos', email: 'maria@email.com', instalador: 'Neguin', banco: 'link-sem', dataInstalacao: '18/01/2026, 14:20:00', ultimoAcesso: '20/01/2026, 11:45:00', status: 'ATIVO' },
];

let currentPage = 'clientes';
let currentInstalacao = null;
let autoRefreshEnabled = false;
let autoRefreshInterval = null;
const AUTO_REFRESH_INTERVAL = 5000; // 5 segundos

let notificacoes = [
    { id: 1, euia: '40a08014-da20-4213-a367-2e08eeea07697', instalacao: 'inst-1', titulo: 'Atualizacao de endereco!', mensagem: 'Abra o app e faca sua atualizacao de endereco e garanta as melhores vagas perto de voce!', status: 'associado', data: '20/01/2026, 14:43:07', evento: 'atualizar_endereco' },
    { id: 2, euia: '50b18125-eb31-5324-b478-3f19ffb18808', instalacao: 'inst-2', titulo: 'Novas vagas disponiveis!', mensagem: 'Confira as novas oportunidades de emprego perto de voce!', status: 'enviado', data: '19/01/2026, 10:20:00', evento: 'nova_vaga' },
];

let operadores = [
    { id: 1, nome: 'Wd520', tipo: 'Operador', usuarios: [
        { id: 1, conecte: 'JPacesso2026', tipo: 'Instalador' },
        { id: 2, conecte: 'Menorj', tipo: 'Instalador' }
    ]},
    { id: 2, nome: 'Vini.jr', tipo: 'Operador', usuarios: [
        { id: 3, conecte: 'Neguin', tipo: 'Instalador' }
    ]}
];

let documentos = [
    { id: 1, euia: '08deef2-4d8e-404b-ab75-5771b0733a9b', cliente: 'Edmar alves taveira', data: '12/01/2026, 13:23:26', arquivo: 'documento_1.pdf', descricao: 'Documento de identidade' },
    { id: 2, euia: '19efff3-5e9f-515c-bc86-6882c1844ba0', cliente: 'JACQUES Sebastiao gonzaga', data: '11/01/2026, 14:15:30', arquivo: 'documento_2.pdf', descricao: 'Comprovante de endereco' },
    { id: 3, euia: '20fggg4-6fag-626d-cd97-7993d2955cb1', cliente: 'Eduardo Luiz Pereira', data: '10/01/2026, 10:45:00', arquivo: 'documento_3.pdf', descricao: 'Comprovante de renda' },
];

// ============================================
// INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    renderClientes();
    renderInstalacoes();
    renderNotificacoes();
    renderOperadores();
    renderDocumentos();
});

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
        renderClientes();
    } else if (currentPage === 'instalacoes') {
        renderInstalacoes();
    } else if (currentPage === 'notificacoes') {
        renderNotificacoes();
    } else if (currentPage === 'funcionarios') {
        renderOperadores();
    } else if (currentPage === 'documentos') {
        renderDocumentos();
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
        alert('Logout realizado com sucesso!');
        // Redirecionar para página de login
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

function saveCliente(event) {
    event.preventDefault();

    const nome = document.getElementById('form-nome').value;
    const cpf = document.getElementById('form-cpf').value;
    const telefone = document.getElementById('form-telefone').value;
    const email = document.getElementById('form-email').value;

    const novoCliente = {
        id: clientes.length + 1,
        nome,
        cpf,
        telefone,
        email,
        dataCadastro: new Date().toLocaleString('pt-BR'),
        acesso: '',
        status: 'PENDENTE'
    };

    clientes.push(novoCliente);
    renderClientes();
    closeModal('modal-cliente');
    alert('Cliente criado com sucesso!');
}

function liberarAcesso(clienteId) {
    const cliente = clientes.find(c => c.id === clienteId);
    if (cliente) {
        // Gerar credencial de acesso aleatória
        const credenciais = ['JPacesso2026', 'Vini.jr', 'Neguin', 'Acesso' + Math.random().toString(36).substr(2, 9)];
        cliente.acesso = credenciais[Math.floor(Math.random() * credenciais.length)];
        cliente.status = 'LIBERADO';
        renderClientes();
        alert(`Acesso liberado! Credencial: ${cliente.acesso}`);
    }
}

function deleteCliente(clienteId) {
    if (confirm('Tem certeza que deseja deletar este cliente?')) {
        clientes = clientes.filter(c => c.id !== clienteId);
        renderClientes();
        alert('Cliente deletado com sucesso!');
    }
}

function selectAll(checkbox) {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
}

function deleteSelected() {
    const selected = document.querySelectorAll('.row-checkbox:checked');
    if (selected.length === 0) {
        alert('Selecione pelo menos um cliente!');
        return;
    }

    if (confirm(`Tem certeza que deseja deletar ${selected.length} cliente(s)?`)) {
        const ids = Array.from(selected).map(cb => parseInt(cb.value));
        clientes = clientes.filter(c => !ids.includes(c.id));
        renderClientes();
        alert('Cliente(s) deletado(s) com sucesso!');
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
            </td>
        `;
        tbody.appendChild(row);
    });
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

function saveNotificacao(event) {
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

    const novaNotificacao = {
        id: notificacoes.length + 1,
        euia: 'notif-' + Math.random().toString(36).substr(2, 9),
        instalacao,
        titulo,
        mensagem,
        status: 'associado',
        data: new Date().toLocaleString('pt-BR'),
        evento
    };

    notificacoes.push(novaNotificacao);
    renderNotificacoes();
    closeModal('modal-notificacao');
    alert('Notificacao criada com sucesso!');
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

function saveDocumento(event) {
    event.preventDefault();

    const cliente = document.getElementById('form-doc-cliente').value;
    const arquivo = document.getElementById('form-doc-arquivo').value;
    const descricao = document.getElementById('form-doc-descricao').value;

    if (!cliente || !arquivo) {
        alert('Preencha os campos obrigatorios!');
        return;
    }

    const novoDocumento = {
        id: documentos.length + 1,
        euia: 'doc-' + Math.random().toString(36).substr(2, 9),
        cliente,
        data: new Date().toLocaleString('pt-BR'),
        arquivo: arquivo.split('\\').pop(),
        descricao
    };

    documentos.push(novoDocumento);
    renderDocumentos();
    closeModal('modal-documento');
    alert('Documento adicionado com sucesso!');
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
    alert('Download do arquivo: ' + nomeArquivo);
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
