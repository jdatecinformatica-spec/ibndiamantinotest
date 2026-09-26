// ==============================================
// GERENCIAMENTO DE CONTAS — IBN Diamantino
// ==============================================

const CHAVE_MEMBROS = 'ibn_membros';
const CHAVE_SESSAO = 'ibn_sessao_atual';

// Salva todos os membros no armazenamento
function salvarMembros(lista) {
    localStorage.setItem(CHAVE_MEMBROS, JSON.stringify(lista));
}

// Lê todos os membros
function lerMembros() {
    const dados = localStorage.getItem(CHAVE_MEMBROS);
    return dados ? JSON.parse(dados) : [];
}

// Cadastra novo membro
function cadastrarMembro(dados) {
    const lista = lerMembros();
    
    // Verifica e-mail duplicado
    const existe = lista.find(m => m.email === dados.email);
    if (existe) {
        return { sucesso: false, mensagem: 'Este e-mail já está cadastrado!' };
    }

    // Adiciona data de cadastro e ID
    const novoMembro = {
        ...dados,
        id: Date.now(),
        dataCadastro: new Date().toISOString(),
        inscricoes: []
    };

    lista.push(novoMembro);
    salvarMembros(lista);
    
    // Loga automaticamente
    iniciarSessao(novoMembro);
    return { sucesso: true, mensagem: 'Cadastro realizado!' };
}

// Inicia sessão
function iniciarSessao(membro) {
    // Não guarda senha na sessão
    const { senha, ...dadosPublicos } = membro;
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(dadosPublicos));
}

// Faz login
function fazerLogin(email, senha) {
    const lista = lerMembros();
    const membro = lista.find(m => m.email === email && m.senha === senha);
    
    if (!membro) {
        return { sucesso: false, mensagem: 'E-mail ou senha incorretos.' };
    }

    iniciarSessao(membro);
    return { sucesso: true };
}

// Pega dados do usuário logado
function getUsuarioLogado() {
    const dados = localStorage.getItem(CHAVE_SESSAO);
    return dados ? JSON.parse(dados) : null;
}

// Verifica se está logado — redireciona se não
function exigirLogin() {
    if (!getUsuarioLogado()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

// Encerra sessão
function sair() {
    localStorage.removeItem(CHAVE_SESSAO);
    window.location.href = 'index.html';
}

// Atualiza dados do membro
function atualizarPerfil(dadosNovos) {
    const usuario = getUsuarioLogado();
    if (!usuario) return { sucesso: false };

    const lista = lerMembros();
    const indice = lista.findIndex(m => m.id === usuario.id);
    if (indice === -1) return { sucesso: false };

    // Mantém email e senha, atualiza resto
    lista[indice] = {
        ...lista[indice],
        ...dadosNovos
    };

    salvarMembros(lista);
    iniciarSessao(lista[indice]);
    return { sucesso: true };
}