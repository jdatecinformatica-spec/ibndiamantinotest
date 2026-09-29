// ==============================================
// GERENCIAMENTO DE CONTAS — IBN Diamantino
// Modelo unificado: membros, células, ministérios,
// cargos, aprovação e recuperação de senha
// ==============================================

const CHAVE_MEMBROS = 'ibn_membros';
const CHAVE_SESSAO = 'ibn_sessao_atual';
const CHAVE_FOTOS = 'ibn_fotos';
const CHAVE_FOTOS_CELULAS = 'ibn_fotos_celulas';

// ---------- CATÁLOGOS FIXOS ----------
const LISTA_CELULAS = [
    { id: 'somos-igreja', nome: 'Célula Somos a Igreja', dia: 'terca' },
    { id: 'genesis', nome: 'Célula Gênesis', dia: 'terca' },
    { id: 'fonte-agua', nome: 'Célula Fonte de Água Viva', dia: 'terca' },
    { id: 'ebenezer', nome: 'Célula Ebenézer', dia: 'terca' },
    { id: 'shamah', nome: 'Célula Shamah', dia: 'terca' },
    { id: 'morada', nome: 'Célula Morada', dia: 'terca' },
    { id: 'atos2', nome: 'Célula Atos 2', dia: 'terca' },
    { id: 'primeiro-mandamento', nome: 'Célula Primeiro Mandamento', dia: 'terca' },
    { id: 'missao', nome: 'Célula Missão', dia: 'terca' },
    { id: 'adolescentes', nome: 'Célula de Adolescentes', dia: 'sabado' },
    { id: 'jovens', nome: 'Célula de Jovens', dia: 'sabado' }
];

const LISTA_MINISTERIOS = [
    'Atmosfera', 'Acolhimento', 'Mulheres', 'Homens', 'Intercessão',
    'Evangelismo', 'Dança', 'Empreendedorismo', 'Batismo', 'Zeladoria',
    'Projetos Sociais', 'Casais', 'Jovens', 'Adolescentes', 'Louvor',
    'Mídias Sociais', 'Infantil', 'Artes', 'Ensino', 'Cantina', 'Projeto Kids'
];

const LISTA_CARGOS = [
    'Membro',
    'Líder de Célula',
    'Líder de Ministério',
    'Diácono / Diaconisa',
    'Presbítero',
    'Pastor',
    'Missionário(a)',
    'Voluntário',
    'Outro'
];

const PERGUNTAS_SEGURANCA = [
    'Nome da mãe (primeiro nome)',
    'Cidade onde nasceu',
    'Nome do primeiro animal de estimação',
    'Escola onde estudou no ensino fundamental',
    'Cor favorita na infância'
];

const CONTAS_MESTRAS = [
    {
        id: 'gestor-master',
        nome: 'Gestor Master',
        email: 'gestor@ibndiamantino.com.br',
        usuario: 'gestor',
        telefone: '',
        // Aceita as senhas mestras já usadas no projeto
        senhas: ['IBN-Gestor-2026!', 'IbnDiamantino@2026'],
        nivel: 'gestor',
        status: 'aprovado',
        celulas: [],
        ministerios: [],
        cargo: 'Gestor',
        funcoes: ['master'],
        master: true
    },
    {
        id: 'admin-master',
        nome: 'Admin Master',
        email: 'admin@ibndiamantino.com.br',
        usuario: 'admin',
        telefone: '',
        senhas: ['IBN-Admin-2026!', 'IbnDiamantino@2026'],
        nivel: 'admin',
        status: 'aprovado',
        celulas: [],
        ministerios: [],
        cargo: 'Administrador',
        funcoes: ['master'],
        master: true
    }
];

function salvarMembros(lista) {
    localStorage.setItem(CHAVE_MEMBROS, JSON.stringify(lista));
}

function lerMembros() {
    try {
        const dados = localStorage.getItem(CHAVE_MEMBROS);
        return dados ? JSON.parse(dados) : [];
    } catch {
        return [];
    }
}

function validarCelulas(celulas) {
    if (!Array.isArray(celulas) || celulas.length === 0) {
        return { lista: [] };
    }
    if (celulas.length > 2) {
        return { erro: 'Você pode participar de no máximo 2 células (1 na terça e 1 no sábado).' };
    }
    const dias = celulas.map(c => c.dia || (LISTA_CELULAS.find(x => x.id === c.id) || {}).dia);
    const tercas = dias.filter(d => d === 'terca').length;
    const sabados = dias.filter(d => d === 'sabado').length;
    if (tercas > 1) return { erro: 'Só é permitido 1 célula de terça-feira.' };
    if (sabados > 1) return { erro: 'Só é permitido 1 célula de sábado.' };

    const lista = celulas.map(c => {
        const ref = LISTA_CELULAS.find(x => x.id === c.id) || c;
        return { id: ref.id, nome: ref.nome, dia: ref.dia };
    });
    return { lista };
}

function cadastrarMembro(dados) {
    const lista = lerMembros();
    const emailNorm = (dados.email || '').toLowerCase().trim();
    const telNorm = (dados.telefone || '').replace(/\D/g, '');

    if (lista.find(m => (m.email || '').toLowerCase() === emailNorm)) {
        return { sucesso: false, mensagem: 'Este e-mail já está cadastrado!' };
    }
    if (telNorm && lista.find(m => (m.telefone || '').replace(/\D/g, '') === telNorm)) {
        return { sucesso: false, mensagem: 'Este telefone já está cadastrado!' };
    }

    const celulas = validarCelulas(dados.celulas || []);
    if (celulas.erro) {
        return { sucesso: false, mensagem: celulas.erro };
    }

    const novo = {
        id: Date.now(),
        nome: (dados.nome || '').trim(),
        email: emailNorm,
        telefone: (dados.telefone || '').trim(),
        senha: dados.senha,
        sexo: dados.sexo || '',
        nascimento: dados.nascimento || '',
        estadoCivil: dados.estadoCivil || '',
        endereco: dados.endereco || '',
        origem: dados.origem || '',
        batismo: dados.batismo || '',
        dataBatismo: dados.dataBatismo || '',
        jaMembro: !!dados.jaMembro,
        celulas: celulas.lista,
        ministerios: Array.isArray(dados.ministerios) ? dados.ministerios : [],
        cargo: dados.cargo || 'Membro',
        funcaoEspecifica: (dados.funcaoEspecifica || '').trim(),
        perguntaSeguranca: dados.perguntaSeguranca || '',
        respostaSeguranca: (dados.respostaSeguranca || '').toLowerCase().trim(),
        status: dados.jaMembro ? 'pendente' : 'aprovado',
        nivel: 'membro',
        funcoes: [],
        deveTrocarSenha: false,
        dataCadastro: new Date().toISOString(),
        inscricoes: []
    };

    if (novo.cargo === 'Líder de Ministério' || novo.cargo === 'Líder de Célula') {
        novo.status = 'pendente';
    }

    lista.push(novo);
    salvarMembros(lista);
    iniciarSessao(novo);
    return { sucesso: true, mensagem: 'Cadastro realizado!', membro: novo };
}

function iniciarSessao(membro) {
    const { senha, senhas, respostaSeguranca, ...dadosPublicos } = membro;
    localStorage.setItem(CHAVE_SESSAO, JSON.stringify(dadosPublicos));
    // Compatível com adminpainel.html e páginas antigas
    localStorage.setItem('usuarioLogado', JSON.stringify(dadosPublicos));
}

function getUsuarioLogado() {
    try {
        const dados = localStorage.getItem(CHAVE_SESSAO);
        return dados ? JSON.parse(dados) : null;
    } catch {
        return null;
    }
}

function fazerLogin(identificador, senha) {
    const id = (identificador || '').trim().toLowerCase();
    const tel = id.replace(/\D/g, '');

    // Contas mestras (gestor / admin) — NÃO passam por recuperação de senha de membro
    const master = CONTAS_MESTRAS.find(c => {
        const idOk = c.email.toLowerCase() === id || (c.usuario && c.usuario.toLowerCase() === id);
        const senhas = Array.isArray(c.senhas) ? c.senhas : [c.senha];
        return idOk && senhas.includes(senha);
    });
    if (master) {
        iniciarSessao(master);
        return { sucesso: true, usuario: master };
    }

    const lista = lerMembros();
    const membro = lista.find(m => {
        const emailOk = (m.email || '').toLowerCase() === id;
        const telOk = tel && (m.telefone || '').replace(/\D/g, '') === tel;
        return (emailOk || telOk) && m.senha === senha;
    });

    if (!membro) {
        return { sucesso: false, mensagem: 'E-mail/telefone ou senha incorretos.' };
    }

    iniciarSessao(membro);
    return { sucesso: true, usuario: membro };
}

function exigirLogin() {
    if (!getUsuarioLogado()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

function sair() {
    localStorage.removeItem(CHAVE_SESSAO);
    localStorage.removeItem('usuarioLogado');
    sessionStorage.removeItem('gestorLogado');
    window.location.href = 'index.html';
}

function isGestor(u) {
    u = u || getUsuarioLogado();
    return u && u.nivel === 'gestor';
}

function isAdmin(u) {
    u = u || getUsuarioLogado();
    return u && (u.nivel === 'admin' || u.nivel === 'gestor');
}

function isLiderMinisterio(u, nomeMinisterio) {
    u = u || getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u)) return true;
    if (u.nivel === 'lider_ministerio' && Array.isArray(u.ministerios)) {
        if (!nomeMinisterio) return true;
        return u.ministerios.includes(nomeMinisterio);
    }
    return false;
}

function isLiderCelula(u, celulaId) {
    u = u || getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u)) return true;
    if (u.nivel === 'lider_celula' && Array.isArray(u.celulas)) {
        if (!celulaId) return true;
        return u.celulas.some(c => c.id === celulaId);
    }
    return false;
}

function podePostarFotoCelula(celulaId) {
    const u = getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u)) return true;
    return Array.isArray(u.celulas) && u.celulas.some(c => c.id === celulaId);
}

function podeGerenciarFotosMinisterio(nomeMinisterio) {
    return isLiderMinisterio(null, nomeMinisterio);
}

function atualizarPerfil(dadosNovos) {
    const usuario = getUsuarioLogado();
    if (!usuario) return { sucesso: false };

    const lista = lerMembros();
    const indice = lista.findIndex(m => m.id === usuario.id);
    if (indice === -1) return { sucesso: false };

    const { nivel, status, funcoes, ...seguros } = dadosNovos;

    if (seguros.celulas) {
        const v = validarCelulas(seguros.celulas);
        if (v.erro) return { sucesso: false, mensagem: v.erro };
        seguros.celulas = v.lista;
    }

    lista[indice] = { ...lista[indice], ...seguros };
    salvarMembros(lista);
    iniciarSessao(lista[indice]);
    return { sucesso: true };
}

function aprovarMembro(membroId, alocacao) {
    if (!isAdmin()) return { sucesso: false, mensagem: 'Sem permissão.' };

    const lista = lerMembros();
    const idx = lista.findIndex(m => m.id === membroId);
    if (idx === -1) return { sucesso: false, mensagem: 'Membro não encontrado.' };

    const m = lista[idx];
    m.status = 'aprovado';

    if (alocacao) {
        if (alocacao.celulas) {
            const v = validarCelulas(alocacao.celulas);
            if (v.erro) return { sucesso: false, mensagem: v.erro };
            m.celulas = v.lista;
        }
        if (alocacao.ministerios) m.ministerios = alocacao.ministerios;
        if (alocacao.cargo) m.cargo = alocacao.cargo;
        if (alocacao.funcaoEspecifica !== undefined) m.funcaoEspecifica = alocacao.funcaoEspecifica;
        if (alocacao.nivel) m.nivel = alocacao.nivel;
        if (alocacao.funcoes) m.funcoes = alocacao.funcoes;
    }

    if (!alocacao || !alocacao.nivel) {
        if (m.cargo === 'Líder de Ministério') m.nivel = 'lider_ministerio';
        else if (m.cargo === 'Líder de Célula') m.nivel = 'lider_celula';
        else if (!['admin', 'gestor'].includes(m.nivel)) m.nivel = 'membro';
    }

    lista[idx] = m;
    salvarMembros(lista);
    return { sucesso: true, membro: m };
}

function rejeitarMembro(membroId) {
    if (!isAdmin()) return { sucesso: false, mensagem: 'Sem permissão.' };
    const lista = lerMembros();
    const idx = lista.findIndex(m => m.id === membroId);
    if (idx === -1) return { sucesso: false, mensagem: 'Membro não encontrado.' };
    lista[idx].status = 'rejeitado';
    salvarMembros(lista);
    return { sucesso: true };
}

function buscarPorIdentificador(identificador) {
    const id = (identificador || '').trim().toLowerCase();
    const tel = id.replace(/\D/g, '');
    const lista = lerMembros();
    return lista.find(m => {
        const emailOk = (m.email || '').toLowerCase() === id;
        const telOk = tel && (m.telefone || '').replace(/\D/g, '') === tel;
        return emailOk || telOk;
    }) || null;
}

function verificarRespostaSeguranca(identificador, resposta) {
    const membro = buscarPorIdentificador(identificador);
    if (!membro) return { sucesso: false, mensagem: 'Cadastro não encontrado.' };
    if (!membro.perguntaSeguranca || !membro.respostaSeguranca) {
        return { sucesso: false, mensagem: 'Este cadastro não possui pergunta de segurança. Fale com a secretaria.' };
    }
    const resp = (resposta || '').toLowerCase().trim();
    if (resp !== membro.respostaSeguranca) {
        return { sucesso: false, mensagem: 'Resposta incorreta.' };
    }
    return { sucesso: true, pergunta: membro.perguntaSeguranca, membroId: membro.id };
}

function gerarSenhaTemporaria() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let s = 'IBN-';
    for (let i = 0; i < 6; i++) {
        s += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return s;
}

function resetarSenhaPorSeguranca(identificador, resposta) {
    const check = verificarRespostaSeguranca(identificador, resposta);
    if (!check.sucesso) return check;

    const lista = lerMembros();
    const idx = lista.findIndex(m => m.id === check.membroId);
    if (idx === -1) return { sucesso: false, mensagem: 'Erro interno.' };

    const temp = gerarSenhaTemporaria();
    lista[idx].senha = temp;
    lista[idx].deveTrocarSenha = true;
    salvarMembros(lista);

    return {
        sucesso: true,
        senhaTemporaria: temp,
        mensagem: 'Senha temporária gerada. Anote e troque no próximo acesso.'
    };
}

function resetarSenhaPorGestor(membroId) {
    if (!isAdmin()) return { sucesso: false, mensagem: 'Sem permissão.' };
    const lista = lerMembros();
    const idx = lista.findIndex(m => m.id === membroId);
    if (idx === -1) return { sucesso: false, mensagem: 'Membro não encontrado.' };

    const temp = gerarSenhaTemporaria();
    lista[idx].senha = temp;
    lista[idx].deveTrocarSenha = true;
    salvarMembros(lista);
    return { sucesso: true, senhaTemporaria: temp };
}

function trocarSenha(senhaAtual, senhaNova) {
    const usuario = getUsuarioLogado();
    if (!usuario) return { sucesso: false, mensagem: 'Não logado.' };

    if (String(usuario.id).includes('master')) {
        return { sucesso: false, mensagem: 'Contas mestras não alteram senha por aqui.' };
    }

    const lista = lerMembros();
    const idx = lista.findIndex(m => m.id === usuario.id);
    if (idx === -1) return { sucesso: false, mensagem: 'Membro não encontrado.' };

    if (lista[idx].senha !== senhaAtual && !lista[idx].deveTrocarSenha) {
        return { sucesso: false, mensagem: 'Senha atual incorreta.' };
    }
    if (!senhaNova || senhaNova.length < 4) {
        return { sucesso: false, mensagem: 'Nova senha precisa ter pelo menos 4 caracteres.' };
    }

    lista[idx].senha = senhaNova;
    lista[idx].deveTrocarSenha = false;
    salvarMembros(lista);
    iniciarSessao(lista[idx]);
    return { sucesso: true };
}

function lerFotosCelulas() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_FOTOS_CELULAS) || '[]');
    } catch {
        return [];
    }
}

function salvarFotosCelulas(lista) {
    localStorage.setItem(CHAVE_FOTOS_CELULAS, JSON.stringify(lista));
}

function adicionarFotoCelula(foto) {
    const u = getUsuarioLogado();
    if (!u) return { sucesso: false, mensagem: 'Faça login.' };
    if (!podePostarFotoCelula(foto.celulaId)) {
        return { sucesso: false, mensagem: 'Você só pode postar fotos das células em que participa.' };
    }
    const lista = lerFotosCelulas();
    lista.unshift({
        id: Date.now(),
        ...foto,
        autorId: u.id,
        autorNome: u.nome,
        data: new Date().toISOString()
    });
    salvarFotosCelulas(lista);
    return { sucesso: true };
}


/** Recuperação por nome + telefone + data de nascimento → senha ibn + 5 últimos dígitos */
function recuperarSenhaPorDados(nome, telefone, nascimento) {
    // Apenas membros — contas mestras não recuperam por aqui
    const nomeNorm = (nome || '').trim().toLowerCase();
    const telNorm = (telefone || '').replace(/\D/g, '');
    const nascNorm = (nascimento || '').trim();

    if (!nomeNorm || telNorm.length < 8 || !nascNorm) {
        return { sucesso: false, mensagem: 'Preencha nome, telefone e data de nascimento.' };
    }

    const lista = lerMembros();
    const membro = lista.find(m => {
        const nomeOk = (m.nome || '').trim().toLowerCase() === nomeNorm;
        const telOk = (m.telefone || '').replace(/\D/g, '') === telNorm
            || (m.telefone || '').replace(/\D/g, '').endsWith(telNorm.slice(-8));
        const nascOk = (m.nascimento || '').trim() === nascNorm;
        return nomeOk && telOk && nascOk;
    });

    if (!membro) {
        return { sucesso: false, mensagem: 'Dados não conferem com nenhum cadastro. Verifique ou fale com a secretaria.' };
    }

    const digitos = (membro.telefone || '').replace(/\D/g, '');
    if (digitos.length < 5) {
        return { sucesso: false, mensagem: 'Telefone do cadastro inválido. Fale com a secretaria.' };
    }

    const temp = 'ibn' + digitos.slice(-5);
    const idx = lista.findIndex(m => m.id === membro.id);
    lista[idx].senha = temp;
    lista[idx].deveTrocarSenha = true;
    salvarMembros(lista);

    return {
        sucesso: true,
        senhaTemporaria: temp,
        mensagem: 'Senha temporária gerada. Use no login e troque depois.'
    };
}

function ehContaMestra(identificador) {
    const id = (identificador || '').trim().toLowerCase();
    return CONTAS_MESTRAS.some(c =>
        c.email.toLowerCase() === id || (c.usuario && c.usuario.toLowerCase() === id)
    );
}

function obterPerguntaSeguranca(identificador) {
    if (ehContaMestra(identificador)) {
        return { sucesso: false, mensagem: 'Contas de gestor/admin não usam recuperação de membro.' };
    }
    const membro = buscarPorIdentificador(identificador);
    if (!membro) return { sucesso: false, mensagem: 'Cadastro não encontrado.' };
    if (!membro.perguntaSeguranca) {
        return { sucesso: false, mensagem: 'Sem pergunta de segurança. Fale com a secretaria.' };
    }
    return { sucesso: true, pergunta: membro.perguntaSeguranca };
}
