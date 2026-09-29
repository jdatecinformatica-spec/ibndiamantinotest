// ==============================================
// GERENCIAMENTO DE CONTAS — IBN Diamantino
// Modelo unificado: membros, células, ministérios,
// cargos, aprovação e recuperação de senha
// ==============================================

const CHAVE_MEMBROS = 'ibn_membros';
const CHAVE_SESSAO = 'ibn_sessao_atual';
const CHAVE_FOTOS = 'ibn_fotos';
const CHAVE_FOTOS_CELULAS = 'ibn_fotos_celulas';

/** Converte dd/mm/aaaa ou ISO para aaaa-mm-dd (input type=date e exibição) */
function normalizarDataParaISO(str) {
    if (!str) return '';
    const s = String(str).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        return m[3] + '-' + mm + '-' + dd;
    }
    return s;
}

/** Exibe data em pt-BR a partir de ISO, dd/mm/aaaa ou Date */
function formatarDataBR(str) {
    if (!str) return 'Não informado';
    const iso = normalizarDataParaISO(str);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const p = iso.split('-');
        return p[2] + '/' + p[1] + '/' + p[0];
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    return String(str);
}

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
        telefone: '',
        senha: 'IBN-Gestor-2026!',
        nivel: 'gestor',
        status: 'aprovado',
        celulas: [],
        ministerios: [],
        cargo: 'Gestor',
        funcoes: ['master']
    },
    {
        id: 'admin-master',
        nome: 'Admin Master',
        email: 'admin@ibndiamantino.com.br',
        telefone: '',
        senha: 'IBN-Admin-2026!',
        nivel: 'admin',
        status: 'aprovado',
        celulas: [],
        ministerios: [],
        cargo: 'Administrador',
        funcoes: ['master']
    }
];

function salvarMembros(lista) {
    localStorage.setItem(CHAVE_MEMBROS, JSON.stringify(lista));
    // Cópia na nuvem (se configurada) — não bloqueia o uso local
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.sincronizarMembros) {
            IBNNuvem.sincronizarMembros(lista);
        }
    } catch (e) { /* silencioso */ }
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
        nascimento: normalizarDataParaISO(dados.nascimento || ''),
        estadoCivil: dados.estadoCivil || '',
        endereco: dados.endereco || '',
        municipio: (dados.municipio || '').trim(),
        uf: (dados.uf || 'MT').trim().toUpperCase(),
        origem: dados.origem || '',
        batismo: dados.batismo || dados.batizado || '',
        batizado: (dados.batizado === true || dados.batismo === 'sim' || dados.batizado === 'sim'),
        dataBatismo: normalizarDataParaISO(dados.dataBatismo || ''),
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
    // Não guarda senha/resposta de segurança na sessão
    const { senha, respostaSeguranca, ...dadosPublicos } = membro;
    const json = JSON.stringify(dadosPublicos);
    // Chave oficial + chave usada na versão "map" (compatibilidade total)
    localStorage.setItem(CHAVE_SESSAO, json);
    localStorage.setItem('usuarioLogado', json);
}

function getUsuarioLogado() {
    try {
        // Tenta chave oficial primeiro
        let dados = localStorage.getItem(CHAVE_SESSAO);
        if (dados) return JSON.parse(dados);
        // Fallback: chave da versão map (login antigo / outras páginas)
        dados = localStorage.getItem('usuarioLogado');
        if (dados) {
            const usuario = JSON.parse(dados);
            // Sincroniza para a chave oficial
            localStorage.setItem(CHAVE_SESSAO, dados);
            return usuario;
        }
        return null;
    } catch {
        return null;
    }
}

function fazerLogin(identificador, senha) {
    const id = (identificador || '').trim().toLowerCase();
    const tel = id.replace(/\D/g, '');

    const master = CONTAS_MESTRAS.find(c =>
        c.email.toLowerCase() === id && c.senha === senha
    );
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

function obterPerguntaSeguranca(identificador) {
    const membro = buscarPorIdentificador(identificador);
    if (!membro) return { sucesso: false, mensagem: 'Cadastro não encontrado.' };
    if (!membro.perguntaSeguranca) {
        return { sucesso: false, mensagem: 'Sem pergunta de segurança. Fale com a secretaria.' };
    }
    return { sucesso: true, pergunta: membro.perguntaSeguranca };
}

// ---------- RELATÓRIOS DE CÉLULA ----------
const CHAVE_RELATORIOS_CELULA = 'ibn_relatorios_celula';

function lerRelatoriosCelula() {
    try {
        return JSON.parse(localStorage.getItem(CHAVE_RELATORIOS_CELULA) || '[]');
    } catch {
        return [];
    }
}

function salvarRelatoriosCelula(lista) {
    localStorage.setItem(CHAVE_RELATORIOS_CELULA, JSON.stringify(lista));
}

/** Membros vinculados a uma célula (por id) */
function membrosDaCelula(celulaId) {
    const lista = lerMembros().filter(m => m.status === 'aprovado' || !m.status);
    return lista.filter(m => Array.isArray(m.celulas) && m.celulas.some(c => c.id === celulaId));
}

/** Papéis na célula a partir do cargo / funcaoEspecifica */
function equipeDaCelula(celulaId) {
    const membros = membrosDaCelula(celulaId);
    const lider = membros.find(m =>
        m.nivel === 'lider_celula' ||
        m.cargo === 'Líder de Célula' ||
        (m.funcaoEspecifica || '').toLowerCase().includes('líder de célula') ||
        (m.funcaoEspecifica || '').toLowerCase().includes('lider de celula')
    ) || null;
    const anfitriao = membros.find(m =>
        (m.funcaoEspecifica || '').toLowerCase().includes('anfitri')
    ) || null;
    const liderTreino = membros.find(m =>
        (m.funcaoEspecifica || '').toLowerCase().includes('treinament') ||
        (m.funcaoEspecifica || '').toLowerCase().includes('em treinamento')
    ) || null;
    return { lider, anfitriao, liderTreino, membros };
}

function podeEditarRelatorioCelula(celulaId) {
    const u = getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u) || isGestor(u)) return true;
    return isLiderCelula(u, celulaId);
}

function salvarRelatorioCelula(dados) {
    const u = getUsuarioLogado();
    if (!u) return { sucesso: false, mensagem: 'Faça login.' };
    if (!dados || !dados.celulaId) return { sucesso: false, mensagem: 'Célula inválida.' };
    if (!podeEditarRelatorioCelula(dados.celulaId)) {
        return { sucesso: false, mensagem: 'Sem permissão para esta célula.' };
    }

    const ofertaPix = parseFloat(dados.ofertaPix) || 0;
    const ofertaEspecie = parseFloat(dados.ofertaEspecie) || 0;
    const presentes = Array.isArray(dados.presentes) ? dados.presentes : [];

    const rel = {
        id: dados.id || ('rel-' + Date.now()),
        celulaId: dados.celulaId,
        data: dados.data || new Date().toISOString().slice(0, 10),
        presentes: presentes,
        qtdPresentes: presentes.length || parseInt(dados.qtdPresentes, 10) || 0,
        ofertaPix: ofertaPix,
        ofertaEspecie: ofertaEspecie,
        totalOfertas: ofertaPix + ofertaEspecie,
        observacoes: (dados.observacoes || '').trim(),
        autorId: u.id,
        autorNome: u.nome,
        criadoEm: dados.criadoEm || new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };

    const lista = lerRelatoriosCelula();
    const idx = lista.findIndex(r => r.id === rel.id);
    if (idx >= 0) lista[idx] = rel;
    else lista.push(rel);
    salvarRelatoriosCelula(lista);
    // Cópia na nuvem (se configurada)
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.sincronizarRelatorio) {
            IBNNuvem.sincronizarRelatorio(rel);
        }
    } catch (e) { /* silencioso */ }
    return { sucesso: true, relatorio: rel };
}

function relatoriosDaCelula(celulaId) {
    return lerRelatoriosCelula()
        .filter(r => r.celulaId === celulaId)
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

function exportarRelatoriosCSV(celulaIdFiltro) {
    const u = getUsuarioLogado();
    if (!u || !(isAdmin(u) || isGestor(u) || (celulaIdFiltro && isLiderCelula(u, celulaIdFiltro)))) {
        return { sucesso: false, mensagem: 'Sem permissão.' };
    }
    let lista = lerRelatoriosCelula();
    if (celulaIdFiltro) lista = lista.filter(r => r.celulaId === celulaIdFiltro);
    if (!lista.length) return { sucesso: false, mensagem: 'Nenhum relatório para exportar.' };

    const sep = ';';
    const header = ['Data', 'Célula', 'Qtd presentes', 'Oferta PIX', 'Oferta espécie', 'Total ofertas', 'Observações', 'Registrado por'].join(sep);
    const linhas = lista.map(r => {
        const cel = LISTA_CELULAS.find(c => c.id === r.celulaId);
        const nomeCel = cel ? cel.nome : r.celulaId;
        return [
            r.data || '',
            '"' + (nomeCel || '').replace(/"/g, '""') + '"',
            r.qtdPresentes || 0,
            (r.ofertaPix || 0).toFixed(2).replace('.', ','),
            (r.ofertaEspecie || 0).toFixed(2).replace('.', ','),
            (r.totalOfertas || 0).toFixed(2).replace('.', ','),
            '"' + (r.observacoes || '').replace(/"/g, '""') + '"',
            '"' + (r.autorNome || '').replace(/"/g, '""') + '"'
        ].join(sep);
    });
    const csv = '\uFEFF' + header + '\n' + linhas.join('\n');
    return { sucesso: true, csv: csv, nomeArquivo: celulaIdFiltro ? ('relatorio-' + celulaIdFiltro + '.csv') : 'relatorios-celulas-geral.csv' };
}

function baixarCSV(conteudo, nomeArquivo) {
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo || 'relatorio.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
