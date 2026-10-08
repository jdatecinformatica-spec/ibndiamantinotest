// ==============================================
// GERENCIAMENTO DE CONTAS — IBN Diamantino
// Modelo unificado: membros, células, ministérios,
// cargos, aprovação e recuperação de senha
// ==============================================

const CHAVE_MEMBROS = 'ibn_membros';
const CHAVE_SESSAO = 'ibn_sessao_atual';
const CHAVE_FOTOS = 'ibn_fotos';
const CHAVE_FOTOS_CELULAS = 'ibn_fotos_celulas';
const CHAVE_ORACOES = 'ibn_pedidos_oracao';
const CHAVE_BLOQUEIOS = 'ibn_bloqueios';
const CHAVE_EXCLUIDOS = 'ibn_membros_excluidos';
const CHAVE_VISITANTES = 'ibn_visitantes';

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


// ---------- IDENTIDADE DA PESSOA (regra tipo gestão de membros) ----------
// Mesma pessoa se: até 3 primeiros nomes iguais + data de nascimento igual.
// E-mail NÃO define identidade (pode casar e mudar sobrenome / ter outro e-mail).
const PARTICULAS_NOME = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1, del: 1, di: 1 };

function partesNomeSignificativas(nome) {
    const bruto = String(nome || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    const significativos = bruto.filter(function (p) { return !PARTICULAS_NOME[p]; });
    // Usa significativos; se poucos, completa com o bruto
    const base = significativos.length >= 2 ? significativos : bruto;
    return base.slice(0, 3);
}

/** Chave estável: "maria|alice|silva" + nascimento ISO */
function chaveIdentidadePessoa(nome, nascimento) {
    const partes = partesNomeSignificativas(nome);
    const nasc = normalizarDataParaISO(nascimento || '');
    if (partes.length < 2 || !nasc) return '';
    return partes.join('|') + '#' + nasc;
}

function mesmaPessoa(a, b) {
    if (!a || !b) return false;
    const ka = chaveIdentidadePessoa(a.nome, a.nascimento);
    const kb = chaveIdentidadePessoa(b.nome, b.nascimento);
    return !!(ka && kb && ka === kb);
}

/** Busca membro já cadastrado pela regra nome (3 primeiros) + aniversário */
function buscarMesmaPessoa(nome, nascimento, lista) {
    const chave = chaveIdentidadePessoa(nome, nascimento);
    if (!chave) return null;
    const arr = lista || lerMembros();
    return arr.find(function (m) {
        return chaveIdentidadePessoa(m.nome, m.nascimento) === chave;
    }) || null;
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
    'Líder em treinamento',
    'Discipulador',
    'Pastor',
    'Missionário(a)',
    'Voluntário',
    'Outro'
];

const CHAVE_ULTIMOS_LOGINS = 'ibn_ultimos_logins';

/** Guarda até 3 últimos identificadores de login neste aparelho */
function registrarUltimoLogin(identificador) {
    const id = String(identificador || '').trim();
    if (!id) return;
    let lista = [];
    try { lista = JSON.parse(localStorage.getItem(CHAVE_ULTIMOS_LOGINS) || '[]'); } catch (e) { lista = []; }
    lista = lista.filter(function (x) { return String(x).toLowerCase() !== id.toLowerCase(); });
    lista.unshift(id);
    lista = lista.slice(0, 3);
    localStorage.setItem(CHAVE_ULTIMOS_LOGINS, JSON.stringify(lista));
}

function lerUltimosLogins() {
    try { return JSON.parse(localStorage.getItem(CHAVE_ULTIMOS_LOGINS) || '[]'); }
    catch (e) { return []; }
}


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


function lerBloqueios() {
    try { return JSON.parse(localStorage.getItem(CHAVE_BLOQUEIOS) || '[]'); } catch (e) { return []; }
}
function salvarBloqueios(lista) {
    localStorage.setItem(CHAVE_BLOQUEIOS, JSON.stringify(lista || []));
}

/** Normaliza e-mail / telefone / nome para bloqueio */
function chaveBloqueioEmail(email) { return String(email || '').toLowerCase().trim(); }
function chaveBloqueioTel(tel) { return String(tel || '').replace(/\D/g, ''); }
function chaveBloqueioNome(nome) { return String(nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }

function estaBloqueadoCadastro(dados) {
    const lista = lerBloqueios();
    const em = chaveBloqueioEmail(dados.email);
    const tel = chaveBloqueioTel(dados.telefone);
    const nome = chaveBloqueioNome(dados.nome);
    for (let i = 0; i < lista.length; i++) {
        const b = lista[i];
        if (em && b.email && b.email === em) return { bloqueado: true, motivo: 'Este e-mail está bloqueado para novos cadastros.' };
        if (tel && b.telefone && b.telefone === tel) return { bloqueado: true, motivo: 'Este telefone está bloqueado para novos cadastros.' };
        if (nome && b.nome && b.nome === nome) return { bloqueado: true, motivo: 'Este nome está bloqueado para novos cadastros.' };
    }
    return { bloqueado: false };
}

/** Bloqueia nome e/ou e-mail e/ou telefone (gestor/admin) */
function bloquearCadastro(dados) {
    const u = getUsuarioLogado();
    if (!u || !(isGestor(u) || isAdmin(u))) {
        return { sucesso: false, mensagem: 'Somente gestor ou admin podem bloquear.' };
    }
    const item = {
        id: 'bloq-' + Date.now(),
        nome: chaveBloqueioNome(dados.nome),
        email: chaveBloqueioEmail(dados.email),
        telefone: chaveBloqueioTel(dados.telefone),
        motivo: (dados.motivo || '').trim(),
        porId: u.id,
        porNome: u.nome,
        em: new Date().toISOString()
    };
    if (!item.nome && !item.email && !item.telefone) {
        return { sucesso: false, mensagem: 'Informe ao menos nome, e-mail ou telefone para bloquear.' };
    }
    const lista = lerBloqueios();
    lista.push(item);
    salvarBloqueios(lista);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade('bloquear_cadastro', 'Bloqueou: ' + (item.nome || item.email || item.telefone), u);
        }
    } catch (e) {}
    return { sucesso: true, bloqueio: item };
}

function desbloquearCadastro(bloqueioId) {
    const u = getUsuarioLogado();
    if (!u || !(isGestor(u) || isAdmin(u))) return { sucesso: false, mensagem: 'Sem permissão.' };
    const lista = lerBloqueios().filter(b => String(b.id) !== String(bloqueioId));
    salvarBloqueios(lista);
    return { sucesso: true };
}

/**
 * Remove membro sem deixar vestígios locais (e tenta nuvem).
 * Permite novo cadastro com mesmo nome, e-mail ou telefone.
 */

/** Membros removidos de vez — não voltam da nuvem nem de outro aparelho */
function lerExcluidos() {
    try { return JSON.parse(localStorage.getItem(CHAVE_EXCLUIDOS) || '[]'); } catch (e) { return []; }
}
function salvarExcluidos(lista) {
    localStorage.setItem(CHAVE_EXCLUIDOS, JSON.stringify(lista || []));
}
function registrarExclusaoMembro(m) {
    if (!m) return;
    const lista = lerExcluidos();
    const item = {
        id: String(m.id),
        chave: chaveIdentidadePessoa(m.nome, m.nascimento || m.dataNascimento) || '',
        email: String(m.email || '').toLowerCase().trim(),
        telefone: String(m.telefone || '').replace(/\D/g, ''),
        nome: m.nome || '',
        em: new Date().toISOString()
    };
    // evita duplicar
    const nova = lista.filter(function (x) {
        return String(x.id) !== item.id &&
            !(item.chave && x.chave === item.chave) &&
            !(item.email && x.email === item.email);
    });
    nova.push(item);
    salvarExcluidos(nova);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.sincronizarExcluidos) {
            IBNNuvem.sincronizarExcluidos(nova);
        }
    } catch (e) {}
}
function membroFoiExcluido(m) {
    if (!m) return false;
    const lista = lerExcluidos();
    if (!lista.length) return false;
    const id = String(m.id);
    const email = String(m.email || '').toLowerCase().trim();
    const tel = String(m.telefone || '').replace(/\D/g, '');
    const chave = chaveIdentidadePessoa(m.nome, m.nascimento || m.dataNascimento) || '';
    return lista.some(function (x) {
        if (x.id && String(x.id) === id) return true;
        if (chave && x.chave && x.chave === chave) return true;
        if (email && x.email && x.email === email) return true;
        if (tel && x.telefone && (x.telefone === tel || x.telefone.endsWith(tel.slice(-8)) || tel.endsWith(String(x.telefone).slice(-8)))) return true;
        return false;
    });
}

function excluirMembroDefinitivo(membroId) {
    const u = getUsuarioLogado();
    // Somente gestor — admin (secretaria) não remove cadastro definitivo
    if (!u || !isGestor(u)) {
        return { sucesso: false, mensagem: 'Somente o gestor pode remover um membro definitivamente.' };
    }
    const lista = lerMembros();
    const m = lista.find(x => String(x.id) === String(membroId));
    if (!m) return { sucesso: false, mensagem: 'Membro não encontrado.' };
    registrarExclusaoMembro(m);
    const nova = lista.filter(x => String(x.id) !== String(membroId));
    salvarMembros(nova);
    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.removerMembroNuvem) IBNNuvem.removerMembroNuvem(membroId);
            if (IBNNuvem.registrarAtividade) {
                IBNNuvem.registrarAtividade('excluir_membro', 'Removeu definitivamente: ' + (m.nome || membroId), u);
            }
        }
    } catch (e) {}
    return { sucesso: true, removido: m };
}


/** Cadastro de visitantes (acolhimento) — separado de membros */
const ETAPAS_VISITANTE = [
    { id: 'aceitou_reconciliou', label: 'Aceitou ou reconciliou' },
    { id: 'cafe_acolhimento', label: 'Passou pelo café de acolhimento' },
    { id: 'passou_impacto', label: 'Passou pelo Impacto' },
    { id: 'batizado', label: 'Foi batizado' },
    { id: 'virou_membro', label: 'Virou membro da igreja' }
];

function lerVisitantes() {
    try { return JSON.parse(localStorage.getItem(CHAVE_VISITANTES) || '[]'); } catch (e) { return []; }
}
function salvarVisitantes(lista) {
    localStorage.setItem(CHAVE_VISITANTES, JSON.stringify(lista || []));
}

function podeGerenciarVisitantes(u) {
    u = u || getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u) || isGestor(u)) return true;
    // líder / participante do ministério Acolhimento
    const mins = Array.isArray(u.ministerios) ? u.ministerios : [];
    const lidera = Array.isArray(u.lideraMinisterios) ? u.lideraMinisterios : [];
    const all = mins.concat(lidera).concat([u.lideraMinisterio || '']);
    return all.some(function (m) {
        return String(m || '').toLowerCase().indexOf('acolh') !== -1;
    });
}

function salvarVisitante(dados) {
    if (!podeGerenciarVisitantes()) {
        return { sucesso: false, mensagem: 'Sem permissão. Apenas gestão ou ministério de Acolhimento.' };
    }
    const nome = String(dados.nome || '').trim();
    if (nome.length < 2) return { sucesso: false, mensagem: 'Informe o nome do visitante.' };
    const lista = lerVisitantes();
    let v;
    if (dados.id) {
        const idx = lista.findIndex(x => String(x.id) === String(dados.id));
        if (idx < 0) return { sucesso: false, mensagem: 'Visitante não encontrado.' };
        v = Object.assign({}, lista[idx], {
            nome: nome,
            telefone: String(dados.telefone || '').trim(),
            email: String(dados.email || '').trim().toLowerCase(),
            dataVisita: dados.dataVisita || lista[idx].dataVisita,
            eventos: Array.isArray(dados.eventos) ? dados.eventos : (lista[idx].eventos || []),
            etapas: dados.etapas && typeof dados.etapas === 'object' ? dados.etapas : (lista[idx].etapas || {}),
            observacoes: String(dados.observacoes || lista[idx].observacoes || '').trim(),
            atualizadoEm: new Date().toISOString()
        });
        lista[idx] = v;
    } else {
        v = {
            id: 'vis-' + Date.now(),
            nome: nome,
            telefone: String(dados.telefone || '').trim(),
            email: String(dados.email || '').trim().toLowerCase(),
            dataVisita: dados.dataVisita || new Date().toISOString().slice(0, 10),
            eventos: Array.isArray(dados.eventos) ? dados.eventos : [],
            etapas: dados.etapas && typeof dados.etapas === 'object' ? dados.etapas : {},
            observacoes: String(dados.observacoes || '').trim(),
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
            criadoPor: (getUsuarioLogado() || {}).nome || ''
        };
        lista.unshift(v);
    }
    salvarVisitantes(lista);
    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.sincronizarVisitante) IBNNuvem.sincronizarVisitante(v);
            if (IBNNuvem.registrarAtividade) IBNNuvem.registrarAtividade('visitante', (dados.id ? 'Atualizou' : 'Cadastrou') + ' visitante ' + nome, getUsuarioLogado());
        }
    } catch (e) {}
    return { sucesso: true, visitante: v };
}

function alternarEtapaVisitante(id, etapaId) {
    if (!podeGerenciarVisitantes()) return { sucesso: false, mensagem: 'Sem permissão.' };
    const lista = lerVisitantes();
    const idx = lista.findIndex(x => String(x.id) === String(id));
    if (idx < 0) return { sucesso: false, mensagem: 'Não encontrado.' };
    if (!lista[idx].etapas) lista[idx].etapas = {};
    lista[idx].etapas[etapaId] = !lista[idx].etapas[etapaId];
    lista[idx].atualizadoEm = new Date().toISOString();
    salvarVisitantes(lista);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.sincronizarVisitante) IBNNuvem.sincronizarVisitante(lista[idx]);
    } catch (e) {}
    return { sucesso: true, visitante: lista[idx] };
}

function removerVisitante(id) {
    if (!podeGerenciarVisitantes()) return { sucesso: false, mensagem: 'Sem permissão.' };
    const lista = lerVisitantes().filter(x => String(x.id) !== String(id));
    salvarVisitantes(lista);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.removerVisitanteNuvem) IBNNuvem.removerVisitanteNuvem(id);
    } catch (e) {}
    return { sucesso: true };
}

function progressoVisitante(v) {
    const etapas = (v && v.etapas) || {};
    let ok = 0;
    ETAPAS_VISITANTE.forEach(function (e) { if (etapas[e.id]) ok++; });
    return { feitos: ok, total: ETAPAS_VISITANTE.length };
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

    // Bloqueios feitos pelo gestor/admin
    const bloq = (typeof estaBloqueadoCadastro === 'function') ? estaBloqueadoCadastro(dados) : { bloqueado: false };
    if (bloq.bloqueado) {
        return { sucesso: false, mensagem: bloq.motivo || 'Cadastro bloqueado pela igreja.' };
    }

    // Mesma pessoa: 3 primeiros nomes + data de nascimento (e-mail não define identidade)
    // Bloqueia se foi removido definitivamente pela gestão
    const fantasma = { nome: dados.nome, nascimento: dados.nascimento, email: dados.email, telefone: dados.telefone, id: '' };
    if (membroFoiExcluido(fantasma)) {
        return {
            sucesso: false,
            mensagem: 'Este cadastro foi removido pela gestão. Fale com a secretaria para liberar de novo.'
        };
    }

    const jaPessoa = buscarMesmaPessoa(dados.nome, dados.nascimento, lista);
    if (jaPessoa) {
        const emailMasc = (jaPessoa.email || '').replace(/(.{2}).+(@.+)/, '$1***$2');
        return {
            sucesso: false,
            mensagem: 'Esta pessoa já possui cadastro (mesmo nome e data de nascimento)' +
                (emailMasc ? '. Tente login ou recuperar senha com o e-mail ' + emailMasc : '. Use login ou recuperar senha.') +
                ' Se casou e mudou o sobrenome, é o mesmo cadastro — não crie outro.'
        };
    }
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
        lideraCelulaId: dados.lideraCelulaId || '',
        lideraMinisterio: dados.lideraMinisterio || '',
        perguntaSeguranca: dados.perguntaSeguranca || '',
        respostaSeguranca: (dados.respostaSeguranca || '').toLowerCase().trim(),
        status: dados.jaMembro ? 'pendente' : 'aprovado',
        nivel: 'membro',
        funcoes: [],
        deveTrocarSenha: false,
        dataCadastro: new Date().toISOString(),
        inscricoes: []
    };

    if (novo.cargo === 'Líder de Ministério' || novo.cargo === 'Líder de Célula' ||
        novo.cargo === 'Líder em treinamento' || novo.cargo === 'Discipulador') {
        novo.status = 'pendente';
    }

    lista.push(novo);
    salvarMembros(lista);
    iniciarSessao(novo);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade('cadastro', 'Novo cadastro no site', novo);
        }
    } catch (e) {}
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

function normalizarTelefoneBR(tel) {
    let d = String(tel || '').replace(/\D/g, '');
    if (d.indexOf('55') === 0 && d.length >= 12) d = d.slice(2);
    // remove zero inicial de operadora antiga
    if (d.charAt(0) === '0') d = d.slice(1);
    return d;
}

/** Compara telefones com tolerância (DDI, 9º dígito, formatação) */
function telefonesIguais(a, b) {
    const x = normalizarTelefoneBR(a);
    const y = normalizarTelefoneBR(b);
    if (!x || !y) return false;
    if (x === y) return true;
    // últimos 8 dígitos (fix sem DDD) ou 10/11
    const x8 = x.slice(-8);
    const y8 = y.slice(-8);
    if (x8.length === 8 && x8 === y8) return true;
    // um tem 9º dígito a mais no meio (celular BR)
    if (x.length >= 10 && y.length >= 10) {
        const xd = x.slice(0, 2) + x.slice(-8);
        const yd = y.slice(0, 2) + y.slice(-8);
        if (xd === yd) return true;
    }
    return false;
}

function fazerLogin(identificador, senha) {
    const id = (identificador || '').trim().toLowerCase();
    const tel = id.replace(/\D/g, '');

    const master = CONTAS_MESTRAS.find(c =>
        c.email.toLowerCase() === id && c.senha === senha
    );
    if (master) {
        iniciarSessao(master);
        try { registrarUltimoLogin(identificador); } catch (e) {}
        return { sucesso: true, usuario: master };
    }

    const lista = lerMembros();
    const senhaTrim = String(senha || '').trim();
    // 1) tenta match completo (identificador + senha)
    let membro = lista.find(m => {
        const emailOk = (m.email || '').toLowerCase() === id;
        const telOk = tel && telefonesIguais(m.telefone, tel);
        return (emailOk || telOk) && String(m.senha || '').trim() === senhaTrim;
    });

    // 2) se senha confere mas telefone digitado diferente, avisa
    if (!membro && senhaTrim) {
        const porSenha = lista.filter(m => String(m.senha || '').trim() === senhaTrim);
        if (porSenha.length === 1 && tel) {
            // senha existe em um único cadastro — telefone que o usuário digitou não bate
            const m = porSenha[0];
            const telCad = normalizarTelefoneBR(m.telefone);
            return {
                sucesso: false,
                mensagem: 'Senha confere, mas o telefone não é o do cadastro. Use o telefone ' +
                    (telCad || 'cadastrado') + ' ou o e-mail: ' + (m.email || '—')
            };
        }
    }

    if (!membro) {
        return { sucesso: false, mensagem: 'E-mail/telefone ou senha incorretos.' };
    }

    iniciarSessao(membro);
    try { registrarUltimoLogin(identificador); } catch (e) {}
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade('login', 'Login no site', membro);
        }
    } catch (e) {}
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
    window.location.href = 'login.html';
}

/**
 * Hierarquia de governo do site (sem mudar o visual):
 * - gestor  = autoridade máxima (pastor/direção). Última palavra. Pode tudo, inclusive nomear/remover admin (secretaria).
 * - admin   = secretaria. Aprova membros, lideranças de célula/ministério, exporta relatórios (com o gestor).
 * - lider_* = só a própria célula/ministério.
 * - membro  = área do membro, fotos, etc.
 */
function isGestor(u) {
    u = u || getUsuarioLogado();
    return !!(u && u.nivel === 'gestor');
}

/** Secretaria OU gestor (quem “manda no escritório”) */
function isAdmin(u) {
    u = u || getUsuarioLogado();
    return !!(u && (u.nivel === 'admin' || u.nivel === 'gestor'));
}

/** Só secretaria (não inclui gestor) — raro; preferir isAdmin */
function isSecretaria(u) {
    u = u || getUsuarioLogado();
    return !!(u && u.nivel === 'admin');
}

/** Aprovar membro e definir liderança de célula/ministério */
function podeAprovarLiderancas(u) {
    return isAdmin(u);
}

/** Buscar/exportar relatórios de células (secretaria + gestor). Líder só a própria no export filtrado. */
function podeExportarRelatoriosGeral(u) {
    return isAdmin(u);
}

/** Nomear ou rebaixar administradores (secretaria) — só o gestor */
function podeNomearAdmin(u) {
    return isGestor(u);
}

/** Define nivel admin em um membro cadastrado (só gestor) */
function nomearComoAdmin(membroId) {
    if (!podeNomearAdmin()) return { sucesso: false, mensagem: 'Somente o gestor pode nomear a secretaria (admin).' };
    const lista = lerMembros();
    const idx = lista.findIndex(m => String(m.id) === String(membroId));
    if (idx === -1) return { sucesso: false, mensagem: 'Membro não encontrado.' };
    if (lista[idx].nivel === 'gestor') return { sucesso: false, mensagem: 'Não é possível alterar o gestor.' };
    lista[idx].nivel = 'admin';
    lista[idx].cargo = lista[idx].cargo || 'Secretaria';
    salvarMembros(lista);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade('nomear_admin', 'Nomeou admin/secretaria: ' + lista[idx].nome);
        }
    } catch (e) {}
    return { sucesso: true, membro: lista[idx] };
}

/** Remove nível admin (volta a membro) — só gestor */
function removerNivelAdmin(membroId) {
    if (!podeNomearAdmin()) return { sucesso: false, mensagem: 'Somente o gestor pode remover admin.' };
    const lista = lerMembros();
    const idx = lista.findIndex(m => String(m.id) === String(membroId));
    if (idx === -1) return { sucesso: false, mensagem: 'Membro não encontrado.' };
    if (lista[idx].nivel === 'gestor') return { sucesso: false, mensagem: 'Não é possível alterar o gestor.' };
    lista[idx].nivel = 'membro';
    salvarMembros(lista);
    return { sucesso: true };
}

function isLiderMinisterio(u, nomeMinisterio) {
    u = u || getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u) || isGestor(u)) return true;
    const alvo = nomeMinisterio ? normalizarNomeMinisterio(nomeMinisterio) : '';
    // Lista explícita de ministérios que lidera
    const lidera = Array.isArray(u.lideraMinisterios) ? u.lideraMinisterios : [];
    if (lidera.length) {
        if (!alvo) return true;
        if (lidera.some(function (m) { return normalizarNomeMinisterio(m) === alvo; })) return true;
    }
    if (u.lideraMinisterio && (!alvo || normalizarNomeMinisterio(u.lideraMinisterio) === alvo)) return true;
    if (u.nivel === 'lider_ministerio') {
        if (!alvo) return true;
        const mins = Array.isArray(u.ministerios) ? u.ministerios : [];
        return mins.some(function (m) { return normalizarNomeMinisterio(m) === alvo; });
    }
    // funcoes[] pode conter lider_ministerio
    if (Array.isArray(u.funcoes) && u.funcoes.indexOf('lider_ministerio') !== -1) {
        if (!alvo) return true;
        const mins2 = Array.isArray(u.ministerios) ? u.ministerios : [];
        return mins2.some(function (m) { return normalizarNomeMinisterio(m) === alvo; }) ||
            lidera.some(function (m) { return normalizarNomeMinisterio(m) === alvo; });
    }
    return false;
}

function isLiderCelula(u, celulaId) {
    u = u || getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u) || isGestor(u)) return true;
    if (u.lideraCelulaId && (!celulaId || String(u.lideraCelulaId) === String(celulaId))) return true;
    if (Array.isArray(u.celulas)) {
        const temPapelLider = u.celulas.some(function (c) {
            const id = typeof idCelulaDe === 'function' ? idCelulaDe(c) : (c && c.id);
            const papel = String(c.papel || c.funcao || '').toLowerCase();
            const papeisArr = Array.isArray(c.papeis) ? c.papeis.map(function(x){ return String(x).toLowerCase(); }) : [];
            const ehLider = papel === 'lider' || papel === 'líder' || papel.indexOf('lider') !== -1 ||
                papeisArr.indexOf('lider') !== -1 || papeisArr.indexOf('lider_treino') !== -1;
            if (!ehLider && u.nivel !== 'lider_celula' && !(Array.isArray(u.funcoes) && u.funcoes.indexOf('lider_celula') !== -1)) {
                return false;
            }
            if (!celulaId) return ehLider || u.nivel === 'lider_celula' || (Array.isArray(u.funcoes) && u.funcoes.indexOf('lider_celula') !== -1);
            return String(id) === String(celulaId) && (ehLider || u.nivel === 'lider_celula' || (Array.isArray(u.funcoes) && u.funcoes.indexOf('lider_celula') !== -1) || String(u.lideraCelulaId) === String(celulaId));
        });
        if (temPapelLider) return true;
    }
    if (u.nivel === 'lider_celula') {
        if (!celulaId) return true;
        return Array.isArray(u.celulas) && u.celulas.some(function (c) {
            return (typeof idCelulaDe === 'function' ? idCelulaDe(c) : c.id) === celulaId;
        });
    }
    return false;
}

function podePostarFotoCelula(celulaId) {
    const u = getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u)) return true;
    return Array.isArray(u.celulas) && u.celulas.some(c => c.id === celulaId);
}


/** Normaliza nome/slug de ministério para comparação */
function normalizarNomeMinisterio(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}

/**
 * Pode postar foto neste ministério?
 * - admin/gestor: qualquer
 * - ministério "geral" / "outros": qualquer membro logado
 * - demais: só se o membro participa daquele ministério no cadastro
 */
function podePostarFotoMinisterio(nomeOuSlug) {
    const u = getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u)) return true;
    const alvo = normalizarNomeMinisterio(nomeOuSlug);
    if (!alvo || alvo === 'geral' || alvo === 'geraloutros' || alvo === 'outros') return true;
    const mins = Array.isArray(u.ministerios) ? u.ministerios : [];
    if (!mins.length) return false;
    return mins.some(function (m) {
        const n = normalizarNomeMinisterio(m);
        return n === alvo || n.indexOf(alvo) !== -1 || alvo.indexOf(n) !== -1;
    });
}

/** Lista legível dos ministérios em que o membro pode postar (+ Geral) */
function ministeriosQuePodePostar() {
    const u = getUsuarioLogado();
    if (!u) return ['Geral / Outros'];
    if (isAdmin(u)) {
        return (typeof LISTA_MINISTERIOS !== 'undefined' ? LISTA_MINISTERIOS.slice() : []).concat(['Geral / Outros']);
    }
    const mins = Array.isArray(u.ministerios) ? u.ministerios.slice() : [];
    if (mins.indexOf('Geral / Outros') === -1 && mins.indexOf('Geral') === -1) {
        mins.push('Geral / Outros');
    }
    return mins.length ? mins : ['Geral / Outros'];
}


/** Pode remover esta foto? autor da foto, admin ou gestor */
function podeRemoverFoto(foto) {
    const u = getUsuarioLogado();
    if (!u || !foto) return false;
    if (isGestor(u) || isAdmin(u)) return true;
    if (u.nivel === 'gestor' || u.nivel === 'admin') return true;
    const uid = String(u.id || '');
    const aid = String(foto.autorId || '');
    if (uid && aid && uid === aid) return true;
    // fallback: mesmo nome do autor (cadastros antigos sem autorId)
    if (u.nome && foto.autor && String(u.nome).toLowerCase().trim() === String(foto.autor).toLowerCase().trim()) return true;
    if (u.nome && foto.autorNome && String(u.nome).toLowerCase().trim() === String(foto.autorNome).toLowerCase().trim()) return true;
    return false;
}

function removerFotoMinisterioLocal(id) {
    try {
        const lista = JSON.parse(localStorage.getItem(CHAVE_FOTOS) || '[]');
        const nova = lista.filter(function (f) { return String(f.id) !== String(id); });
        localStorage.setItem(CHAVE_FOTOS, JSON.stringify(nova));
        return { sucesso: true };
    } catch (e) {
        return { sucesso: false, mensagem: String(e) };
    }
}

function removerFotoCelulaLocal(id) {
    try {
        const lista = lerFotosCelulas();
        const nova = lista.filter(function (f) { return String(f.id) !== String(id); });
        salvarFotosCelulas(nova);
        return { sucesso: true };
    } catch (e) {
        return { sucesso: false, mensagem: String(e) };
    }
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
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade('editar_perfil', 'Atualizou dados cadastrais', lista[indice]);
        }
    } catch (e) {}
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
        if (alocacao.lideraCelulaId !== undefined) m.lideraCelulaId = alocacao.lideraCelulaId;
        if (alocacao.lideraMinisterio !== undefined) m.lideraMinisterio = alocacao.lideraMinisterio;
        if (alocacao.lideraMinisterios !== undefined) m.lideraMinisterios = alocacao.lideraMinisterios;
        if (alocacao.funcaoEspecifica !== undefined) m.funcaoEspecifica = alocacao.funcaoEspecifica;
        if (alocacao.nivel) m.nivel = alocacao.nivel;
        if (alocacao.funcoes) m.funcoes = alocacao.funcoes;
        // nível efetivo: gestor > admin > lider_* combinados
        if (Array.isArray(m.funcoes) && m.funcoes.indexOf('gestor') !== -1) m.nivel = 'gestor';
        else if (Array.isArray(m.funcoes) && m.funcoes.indexOf('admin') !== -1) m.nivel = 'admin';
        else if (Array.isArray(m.funcoes) && m.funcoes.indexOf('lider_celula') !== -1 && m.funcoes.indexOf('lider_ministerio') !== -1) {
            m.nivel = m.nivel === 'admin' || m.nivel === 'gestor' ? m.nivel : 'lider_celula';
        } else if (Array.isArray(m.funcoes) && m.funcoes.indexOf('lider_celula') !== -1) m.nivel = (m.nivel === 'admin' || m.nivel === 'gestor') ? m.nivel : 'lider_celula';
        else if (Array.isArray(m.funcoes) && m.funcoes.indexOf('lider_ministerio') !== -1) m.nivel = (m.nivel === 'admin' || m.nivel === 'gestor') ? m.nivel : 'lider_ministerio';
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
    const idx = lista.findIndex(m => String(m.id) === String(membroId));
    if (idx === -1) return { sucesso: false, mensagem: 'Membro não encontrado.' };

    const temp = gerarSenhaTemporaria();
    lista[idx].senha = temp;
    lista[idx].deveTrocarSenha = true;
    salvarMembros(lista);
    // Sobe senha nova para a nuvem (outros aparelhos)
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.sincronizarUmMembro) {
            IBNNuvem.sincronizarUmMembro(lista[idx]);
        }
    } catch (e) {}
    return {
        sucesso: true,
        senhaTemporaria: temp,
        membro: lista[idx],
        telefoneCadastro: lista[idx].telefone || '',
        emailCadastro: lista[idx].email || ''
    };
}

function trocarSenha(senhaAtual, senhaNova, senhaNova2) {
    const usuario = getUsuarioLogado();
    if (!usuario) return { sucesso: false, mensagem: 'Não logado.' };

    if (String(usuario.id).includes('master')) {
        return { sucesso: false, mensagem: 'Contas mestras não alteram senha por aqui.' };
    }

    const lista = lerMembros();
    const idx = lista.findIndex(m => String(m.id) === String(usuario.id));
    if (idx === -1) return { sucesso: false, mensagem: 'Membro não encontrado.' };

    const obrigatorio = !!lista[idx].deveTrocarSenha;
    const atual = String(senhaAtual || '').trim();
    const nova = String(senhaNova || '').trim();
    const nova2 = senhaNova2 !== undefined && senhaNova2 !== null ? String(senhaNova2).trim() : nova;

    if (!obrigatorio) {
        if (!atual || atual !== String(lista[idx].senha || '')) {
            return { sucesso: false, mensagem: 'Senha atual incorreta.' };
        }
    } else if (atual && atual !== String(lista[idx].senha || '')) {
        // se informou senha atual na troca obrigatória, precisa bater
        return { sucesso: false, mensagem: 'Senha temporária incorreta.' };
    }

    if (!nova || nova.length < 4) {
        return { sucesso: false, mensagem: 'Nova senha precisa ter pelo menos 4 caracteres.' };
    }
    if (nova !== nova2) {
        return { sucesso: false, mensagem: 'A confirmação da nova senha não confere.' };
    }
    if (nova === String(lista[idx].senha || '')) {
        return { sucesso: false, mensagem: 'A nova senha deve ser diferente da temporária.' };
    }

    lista[idx].senha = nova;
    lista[idx].deveTrocarSenha = false;
    salvarMembros(lista);
    iniciarSessao(lista[idx]);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.sincronizarUmMembro) {
            IBNNuvem.sincronizarUmMembro(lista[idx]);
        }
    } catch (e) {}
    return { sucesso: true, mensagem: 'Senha alterada com sucesso.' };
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
    const nova = lista[0];
    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.salvarFotoCelulaNuvem) IBNNuvem.salvarFotoCelulaNuvem(nova);
            if (IBNNuvem.registrarAtividade) {
                IBNNuvem.registrarAtividade('foto_celula', 'Foto na célula ' + (foto.celulaId || ''), u);
            }
        }
    } catch (e) {}
    return { sucesso: true };
}


/** Recuperação por nome + telefone + data de nascimento */
function recuperarSenhaPorDados(nome, telefone, nascimento) {
    const telNorm = String(telefone || '').replace(/\D/g, '');
    const nascIso = normalizarDataParaISO(nascimento || '');

    if (!(nome || '').trim() || telNorm.length < 8 || !nascIso) {
        return { sucesso: false, mensagem: 'Preencha nome, telefone e data de nascimento (dd/mm/aaaa).' };
    }

    const lista = lerMembros();
    // 1) Mesma pessoa (3 nomes + nascimento) + telefone flexível
    let membro = null;
    const mesma = buscarMesmaPessoa(nome, nascimento, lista);
    if (mesma) {
        const telCad = String(mesma.telefone || '').replace(/\D/g, '');
        const telOk = !telCad || telCad === telNorm || telCad.endsWith(telNorm.slice(-8)) || telNorm.endsWith(telCad.slice(-8))
            || (typeof telefonesIguais === 'function' && telefonesIguais(mesma.telefone, telNorm));
        if (telOk) membro = mesma;
    }
    // 2) Fallback: telefone + nascimento (nome pode ter variado)
    if (!membro) {
        membro = lista.find(function (m) {
            const nascM = normalizarDataParaISO(m.nascimento || m.dataNascimento || '');
            if (nascM !== nascIso) return false;
            const telCad = String(m.telefone || '').replace(/\D/g, '');
            return telCad && (telCad === telNorm || telCad.endsWith(telNorm.slice(-8)) || telNorm.endsWith(telCad.slice(-8))
                || (typeof telefonesIguais === 'function' && telefonesIguais(m.telefone, telNorm)));
        }) || null;
    }
    // 3) Só telefone se for único na lista
    if (!membro) {
        const porTel = lista.filter(function (m) {
            const telCad = String(m.telefone || '').replace(/\D/g, '');
            return telCad && (telCad === telNorm || telCad.endsWith(telNorm.slice(-8)) || telNorm.endsWith(telCad.slice(-8)));
        });
        if (porTel.length === 1) membro = porTel[0];
    }

    if (!membro) {
        return {
            sucesso: false,
            mensagem: 'Não encontramos seu cadastro neste aparelho. Tente de novo após sincronizar, ou peça senha temporária à secretaria (WhatsApp).',
            precisaSecretaria: true
        };
    }

    const temp = gerarSenhaTemporaria();
    const idx = lista.findIndex(function (m) { return String(m.id) === String(membro.id); });
    if (idx < 0) return { sucesso: false, mensagem: 'Erro interno ao atualizar senha.' };
    lista[idx].senha = temp;
    lista[idx].deveTrocarSenha = true;
    // grava telefone digitado se o cadastrado estava vazio/diferente só de formatação
    if (telNorm && !lista[idx].telefone) lista[idx].telefone = telNorm;
    salvarMembros(lista);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.sincronizarUmMembro) {
            IBNNuvem.sincronizarUmMembro(lista[idx]);
        }
    } catch (e) {}

    return {
        sucesso: true,
        senhaTemporaria: temp,
        emailCadastro: lista[idx].email || '',
        telefoneCadastro: lista[idx].telefone || '',
        mensagem: 'Senha temporária gerada. Vale até você entrar e trocar a senha.'
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
function idCelulaDe(c) {
    if (!c) return '';
    if (typeof c === 'string') return c;
    return c.id || '';
}

/** Membros da célula (aprovados e pendentes — já vinculados no cadastro) */
function membrosDaCelula(celulaId) {
    const lista = lerMembros().filter(function (m) {
        const st = (m.status || 'aprovado').toLowerCase();
        return st !== 'rejeitado' && st !== 'recusado';
    });
    return lista.filter(function (m) {
        if (!Array.isArray(m.celulas)) return false;
        return m.celulas.some(function (c) {
            return idCelulaDe(c) === celulaId;
        });
    });
}

/** Membros de um ministério (nome como no cadastro, ex.: Atmosfera) */


/** Remove duplicatas locais pela regra nome+nascimento (mantém o cadastro mais completo/recente) */
function deduplicarMembrosLocais() {
    const lista = lerMembros();
    const porChave = {};
    const semChave = [];
    lista.forEach(function (m) {
        const k = chaveIdentidadePessoa(m.nome, m.nascimento);
        if (!k) { semChave.push(m); return; }
        if (!porChave[k]) {
            porChave[k] = m;
            return;
        }
        // Mantém o que tem mais dados / id mais antigo como principal e mescla e-mails
        const atual = porChave[k];
        const prefer = (m.dataCadastro || '') > (atual.dataCadastro || '') ? m : atual;
        const outro = prefer === m ? atual : m;
        prefer.telefone = prefer.telefone || outro.telefone;
        prefer.email = prefer.email || outro.email;
        prefer.endereco = prefer.endereco || outro.endereco;
        prefer.municipio = prefer.municipio || outro.municipio;
        if ((!prefer.celulas || !prefer.celulas.length) && outro.celulas) prefer.celulas = outro.celulas;
        if ((!prefer.ministerios || !prefer.ministerios.length) && outro.ministerios) prefer.ministerios = outro.ministerios;
        porChave[k] = prefer;
    });
    const nova = semChave.concat(Object.keys(porChave).map(function (k) { return porChave[k]; }));
    salvarMembros(nova);
    return nova;
}

function membrosDoMinisterio(nomeMinisterio) {
    const alvo = String(nomeMinisterio || '').toLowerCase().trim();
    if (!alvo) return [];
    const lista = lerMembros().filter(function (m) {
        const st = (m.status || 'aprovado').toLowerCase();
        return st !== 'rejeitado' && st !== 'recusado';
    });
    return lista.filter(function (m) {
        const mins = Array.isArray(m.ministerios) ? m.ministerios : [];
        return mins.some(function (x) {
            const s = String(x).toLowerCase();
            return s === alvo || s.indexOf(alvo) !== -1 || alvo.indexOf(s) !== -1;
        });
    });
}

/** Papéis na célula a partir do cargo / funcaoEspecifica */
function equipeDaCelula(celulaId) {
    const membros = membrosDaCelula(celulaId);
    const todos = lerMembros().filter(function (m) {
        const st = (m.status || 'aprovado').toLowerCase();
        return st !== 'rejeitado' && st !== 'recusado';
    });
    const lider = membros.find(m =>
        m.nivel === 'lider_celula' ||
        m.cargo === 'Líder de Célula' ||
        (m.lideraCelulaId && m.lideraCelulaId === celulaId && m.cargo === 'Líder de Célula') ||
        (m.funcaoEspecifica || '').toLowerCase().includes('líder de célula') ||
        (m.funcaoEspecifica || '').toLowerCase().includes('lider de celula')
    ) || todos.find(m => m.lideraCelulaId === celulaId && (m.cargo === 'Líder de Célula' || m.nivel === 'lider_celula')) || null;
    const anfitriao = membros.find(m =>
        (m.funcaoEspecifica || '').toLowerCase().includes('anfitri')
    ) || null;
    const liderTreino = membros.find(m =>
        m.cargo === 'Líder em treinamento' ||
        (m.funcaoEspecifica || '').toLowerCase().includes('treinament') ||
        (m.funcaoEspecifica || '').toLowerCase().includes('em treinamento')
    ) || null;
    return { lider, anfitriao, liderTreino, membros };
}


/** Adiciona membro já cadastrado a uma célula (líder/admin/gestor) */
function adicionarMembroACelula(membroId, celulaId) {
    if (!podeGerenciarPessoasCelula(celulaId)) {
        return { sucesso: false, mensagem: 'Somente o líder ou o anfitrião desta célula podem adicionar pessoas.' };
    }
    const cel = (typeof LISTA_CELULAS !== 'undefined' ? LISTA_CELULAS : []).find(c => c.id === celulaId);
    if (!cel) return { sucesso: false, mensagem: 'Célula inválida.' };
    const lista = lerMembros();
    const idx = lista.findIndex(m => String(m.id) === String(membroId));
    if (idx < 0) return { sucesso: false, mensagem: 'Membro não encontrado.' };
    const m = lista[idx];
    if (!Array.isArray(m.celulas)) m.celulas = [];
    if (m.celulas.some(c => idCelulaDe(c) === celulaId)) {
        return { sucesso: false, mensagem: 'Esta pessoa já está nesta célula.' };
    }
    const v = validarCelulas(m.celulas.concat([{ id: cel.id, nome: cel.nome, dia: cel.dia }]));
    if (v.erro) return { sucesso: false, mensagem: v.erro };
    m.celulas = v.lista;
    lista[idx] = m;
    salvarMembros(lista);
    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.sincronizarUmMembro) IBNNuvem.sincronizarUmMembro(m);
            if (IBNNuvem.registrarAtividade) IBNNuvem.registrarAtividade('vincular_celula', 'Vinculou ' + (m.nome || '') + ' à célula ' + cel.nome, getUsuarioLogado());
        }
    } catch (e) {}
    return { sucesso: true, membro: m };
}

/** Cadastro rápido de visitante vinculado à célula */
function cadastrarVisitanteCelula(dados, celulaId) {
    if (!podeGerenciarPessoasCelula(celulaId)) {
        return { sucesso: false, mensagem: 'Somente o líder ou o anfitrião desta célula podem cadastrar visitante.' };
    }
    const cel = (typeof LISTA_CELULAS !== 'undefined' ? LISTA_CELULAS : []).find(c => c.id === celulaId);
    if (!cel) return { sucesso: false, mensagem: 'Célula inválida.' };
    const nome = String(dados.nome || '').trim();
    if (nome.length < 2) return { sucesso: false, mensagem: 'Informe o nome do visitante.' };
    const nasc = normalizarDataParaISO(dados.nascimento || '');
    // mesma pessoa?
    const lista = lerMembros();
    const existente = lista.find(function (m) {
        return typeof mesmaPessoa === 'function' && mesmaPessoa(m, { nome: nome, nascimento: nasc });
    });
    if (existente) {
        return adicionarMembroACelula(existente.id, celulaId);
    }
    const novo = {
        id: Date.now(),
        nome: nome,
        email: (dados.email || '').trim() || ('visitante_' + Date.now() + '@ibn.local'),
        telefone: (dados.telefone || '').trim(),
        nascimento: nasc,
        endereco: (dados.endereco || '').trim(),
        municipio: (dados.municipio || '').trim(),
        uf: (dados.uf || 'MT').trim() || 'MT',
        estadoCivil: (dados.estadoCivil || '').trim(),
        batizado: !!dados.batizado,
        dataBatismo: dados.batizado ? (normalizarDataParaISO(dados.dataBatismo || '') || '') : '',
        celulas: [{ id: cel.id, nome: cel.nome, dia: cel.dia }],
        ministerios: [],
        cargo: 'Visitante',
        nivel: 'membro',
        status: 'visitante',
        tipo: 'visitante',
        dataCadastro: new Date().toISOString().slice(0, 10),
        senha: '',
        origem: 'celula:' + celulaId
    };
    lista.push(novo);
    salvarMembros(lista);
    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.sincronizarUmMembro) IBNNuvem.sincronizarUmMembro(novo);
            if (IBNNuvem.registrarAtividade) IBNNuvem.registrarAtividade('visitante_celula', 'Cadastrou visitante ' + nome + ' na ' + cel.nome, getUsuarioLogado());
        }
    } catch (e) {}
    return { sucesso: true, membro: novo };
}

function buscarMembrosParaCelula(termo, celulaId) {
    termo = String(termo || '').toLowerCase().trim();
    if (termo.length < 2) return [];
    return lerMembros().filter(function (m) {
        const st = (m.status || '').toLowerCase();
        if (st === 'rejeitado' || st === 'recusado') return false;
        const ja = Array.isArray(m.celulas) && m.celulas.some(function (c) { return idCelulaDe(c) === celulaId; });
        if (ja) return false;
        const nome = String(m.nome || '').toLowerCase();
        const email = String(m.email || '').toLowerCase();
        const tel = String(m.telefone || '');
        return nome.indexOf(termo) !== -1 || email.indexOf(termo) !== -1 || tel.indexOf(termo) !== -1;
    }).slice(0, 12);
}

function isAnfitriaoCelula(u, celulaId) {
    u = u || getUsuarioLogado();
    if (!u || !celulaId) return false;
    if (Array.isArray(u.celulas)) {
        const porPapel = u.celulas.some(function (c) {
            const id = typeof idCelulaDe === 'function' ? idCelulaDe(c) : (c && c.id);
            const papel = String(c.papel || '').toLowerCase();
            const papeis = Array.isArray(c.papeis) ? c.papeis.join(' ') : '';
            return String(id) === String(celulaId) && (papel.indexOf('anfitri') !== -1 || String(papeis).toLowerCase().indexOf('anfitri') !== -1);
        });
        if (porPapel) return true;
    }
    if (Array.isArray(u.funcoes) && u.funcoes.indexOf('anfitriao') !== -1) {
        if (!Array.isArray(u.celulas)) return false;
        return u.celulas.some(function (c) {
            return (typeof idCelulaDe === 'function' ? idCelulaDe(c) : (c && c.id)) === celulaId;
        });
    }
    const eq = (typeof equipeDaCelula === 'function') ? equipeDaCelula(celulaId) : null;
    if (eq && eq.anfitriao && String(eq.anfitriao.id) === String(u.id)) return true;
    const fn = String(u.funcaoEspecifica || u.cargo || '').toLowerCase();
    if (fn.indexOf('anfitri') === -1) return false;
    if (!Array.isArray(u.celulas)) return false;
    return u.celulas.some(function (c) {
        return (typeof idCelulaDe === 'function' ? idCelulaDe(c) : (c && c.id)) === celulaId;
    });
}

/** Líder ou anfitrião da célula: adicionar membros/visitantes e chamada */
function podeGerenciarPessoasCelula(celulaId) {
    const u = getUsuarioLogado();
    if (!u || !celulaId) return false;
    if (isLiderCelula(u, celulaId)) return true;
    if (isAnfitriaoCelula(u, celulaId)) return true;
    return false;
}

/** Relatório com ofertas: só líder da célula (secretaria/gestor também veem/exportam) */

/** Remove vínculo do membro com a célula (continua membro da igreja) */
function removerMembroDaCelula(membroId, celulaId) {
    if (!podeGerenciarPessoasCelula(celulaId)) {
        return { sucesso: false, mensagem: 'Somente o líder ou o anfitrião podem remover desta célula.' };
    }
    const lista = lerMembros();
    const idx = lista.findIndex(m => String(m.id) === String(membroId));
    if (idx < 0) return { sucesso: false, mensagem: 'Membro não encontrado.' };
    const m = lista[idx];
    if (!Array.isArray(m.celulas)) m.celulas = [];
    m.celulas = m.celulas.filter(function (c) {
        return (typeof idCelulaDe === 'function' ? idCelulaDe(c) : (c && c.id)) !== celulaId;
    });
    // se era líder desta célula no cargo, não remove nível global automaticamente
    lista[idx] = m;
    salvarMembros(lista);
    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.sincronizarUmMembro) IBNNuvem.sincronizarUmMembro(m);
            if (IBNNuvem.registrarAtividade) {
                IBNNuvem.registrarAtividade('desvincular_celula', 'Removeu ' + (m.nome || '') + ' da célula ' + celulaId, getUsuarioLogado());
            }
        }
    } catch (e) {}
    return { sucesso: true, membro: m };
}

function podeGerenciarPessoasMinisterio(nomeMinisterio) {
    const u = getUsuarioLogado();
    if (!u || !nomeMinisterio) return false;
    if (isAdmin(u) || isGestor(u)) return true;
    return isLiderMinisterio(u, nomeMinisterio);
}

function adicionarMembroAoMinisterio(membroId, nomeMinisterio) {
    if (!podeGerenciarPessoasMinisterio(nomeMinisterio)) {
        return { sucesso: false, mensagem: 'Somente o líder deste ministério pode adicionar membros.' };
    }
    const nome = String(nomeMinisterio || '').trim();
    if (!nome) return { sucesso: false, mensagem: 'Ministério inválido.' };
    const lista = lerMembros();
    const idx = lista.findIndex(m => String(m.id) === String(membroId));
    if (idx < 0) return { sucesso: false, mensagem: 'Membro não encontrado.' };
    const m = lista[idx];
    if (!Array.isArray(m.ministerios)) m.ministerios = [];
    const ja = m.ministerios.some(function (x) {
        return normalizarNomeMinisterio(x) === normalizarNomeMinisterio(nome);
    });
    if (ja) return { sucesso: false, mensagem: 'Esta pessoa já está neste ministério.' };
    m.ministerios.push(nome);
    lista[idx] = m;
    salvarMembros(lista);
    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.sincronizarUmMembro) IBNNuvem.sincronizarUmMembro(m);
            if (IBNNuvem.registrarAtividade) {
                IBNNuvem.registrarAtividade('vincular_ministerio', 'Vinculou ' + (m.nome || '') + ' ao ministério ' + nome, getUsuarioLogado());
            }
        }
    } catch (e) {}
    return { sucesso: true, membro: m };
}

/** Remove só do ministério — continua membro da igreja (e de células/outros ministérios) */
function removerMembroDoMinisterio(membroId, nomeMinisterio) {
    if (!podeGerenciarPessoasMinisterio(nomeMinisterio)) {
        return { sucesso: false, mensagem: 'Somente o líder deste ministério pode remover membros.' };
    }
    const nome = String(nomeMinisterio || '').trim();
    const lista = lerMembros();
    const idx = lista.findIndex(m => String(m.id) === String(membroId));
    if (idx < 0) return { sucesso: false, mensagem: 'Membro não encontrado.' };
    const m = lista[idx];
    if (!Array.isArray(m.ministerios)) m.ministerios = [];
    m.ministerios = m.ministerios.filter(function (x) {
        return normalizarNomeMinisterio(x) !== normalizarNomeMinisterio(nome);
    });
    lista[idx] = m;
    salvarMembros(lista);
    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.sincronizarUmMembro) IBNNuvem.sincronizarUmMembro(m);
            if (IBNNuvem.registrarAtividade) {
                IBNNuvem.registrarAtividade('desvincular_ministerio', 'Removeu ' + (m.nome || '') + ' do ministério ' + nome, getUsuarioLogado());
            }
        }
    } catch (e) {}
    return { sucesso: true, membro: m };
}

function buscarMembrosParaMinisterio(termo, nomeMinisterio) {
    termo = String(termo || '').toLowerCase().trim();
    if (termo.length < 2) return [];
    const alvo = normalizarNomeMinisterio(nomeMinisterio);
    return lerMembros().filter(function (m) {
        const st = (m.status || '').toLowerCase();
        if (st === 'rejeitado' || st === 'recusado') return false;
        const mins = Array.isArray(m.ministerios) ? m.ministerios : [];
        const ja = mins.some(function (x) { return normalizarNomeMinisterio(x) === alvo; });
        if (ja) return false;
        const nome = String(m.nome || '').toLowerCase();
        const email = String(m.email || '').toLowerCase();
        const tel = String(m.telefone || '');
        return nome.indexOf(termo) !== -1 || email.indexOf(termo) !== -1 || tel.indexOf(termo) !== -1;
    }).slice(0, 12);
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
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.sincronizarRelatorio) IBNNuvem.sincronizarRelatorio(rel);
            if (IBNNuvem.registrarAtividade) {
                IBNNuvem.registrarAtividade('relatorio_celula', 'Relatório célula ' + rel.celulaId + ' em ' + rel.data, u);
            }
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
    if (!u) return { sucesso: false, mensagem: 'Faça login.' };
    // Relatório geral CSV: secretaria (admin) e gestor. Uma célula: também o líder dela.
    if (!celulaIdFiltro && !podeExportarRelatoriosGeral(u)) {
        return { sucesso: false, mensagem: 'Relatórios gerais: somente secretaria ou gestor.' };
    }
    if (celulaIdFiltro && !(isAdmin(u) || isLiderCelula(u, celulaIdFiltro))) {
        return { sucesso: false, mensagem: 'Sem permissão para exportar esta célula.' };
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


// ---------- PEDIDOS DE ORAÇÃO (Intercessão + gestor + secretaria) ----------
function lerPedidosOracao() {
    try { return JSON.parse(localStorage.getItem(CHAVE_ORACOES) || '[]'); }
    catch (e) { return []; }
}

function salvarPedidosOracao(lista) {
    localStorage.setItem(CHAVE_ORACOES, JSON.stringify(lista));
}

/** Quem vê a lista: gestor, secretaria (admin), líder do ministério Intercessão */
function podeVerPedidosOracao(u) {
    u = u || getUsuarioLogado();
    if (!u) return false;
    if (isAdmin(u)) return true; // gestor + secretaria
    if (u.nivel === 'lider_ministerio') {
        const mins = Array.isArray(u.ministerios) ? u.ministerios : [];
        return mins.some(function (m) {
            return String(m).toLowerCase().indexOf('intercess') !== -1;
        });
    }
    // Cargo/função mencionando intercessão
    const blob = ((u.cargo || '') + ' ' + (u.funcaoEspecifica || '')).toLowerCase();
    if (blob.indexOf('intercess') !== -1) return true;
    return false;
}

/** WhatsApp da igreja para avisar a intercessão (número em formato internacional, só dígitos) */
const WHATSAPP_INTERCESSAO = '5565996292021';

function montarLinkWhatsAppOracao(item) {
    const texto =
        '*Pedido de oração — IBN Diamantino*%0A%0A' +
        '*Nome:* ' + encodeURIComponent(item.nome || '') + '%0A' +
        (item.email ? ('*Contato:* ' + encodeURIComponent(item.email) + '%0A') : '') +
        (item.membroId ? '*Membro cadastrado:* sim%0A' : '*Visitante do site*%0A') +
        '%0A*Pedido:*%0A' + encodeURIComponent(item.pedido || '');
    return 'https://wa.me/' + WHATSAPP_INTERCESSAO + '?text=' + texto;
}

function registrarPedidoOracao(dados) {
    const nome = (dados.nome || '').trim();
    const email = (dados.email || '').trim().toLowerCase();
    const pedido = (dados.pedido || '').trim();
    if (!nome || nome.length < 2) {
        return { sucesso: false, mensagem: 'Informe pelo menos o primeiro nome ou um apelido — para orarmos por alguém de verdade.' };
    }
    if (!pedido || pedido.length < 5) {
        return { sucesso: false, mensagem: 'Escreva o pedido de oração.' };
    }

    const logado = (typeof getUsuarioLogado === 'function') ? getUsuarioLogado() : null;
    const item = {
        id: 'oracao-' + Date.now(),
        nome: nome,
        email: email || (logado && logado.email) || '',
        pedido: pedido,
        membroId: logado ? (logado.id || '') : '',
        membroLogado: !!logado,
        status: 'novo',
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };
    const lista = lerPedidosOracao();
    lista.unshift(item);
    salvarPedidosOracao(lista);

    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.salvarPedidoOracao) IBNNuvem.salvarPedidoOracao(item);
            if (IBNNuvem.registrarAtividade) {
                IBNNuvem.registrarAtividade('pedido_oracao', 'Novo pedido de oração', getUsuarioLogado() || { nome: nome });
            }
        }
    } catch (e) {}

    return {
        sucesso: true,
        pedido: item,
        whatsappUrl: montarLinkWhatsAppOracao(item)
    };
}

function atualizarStatusPedidoOracao(id, status) {
    if (!podeVerPedidosOracao()) return { sucesso: false, mensagem: 'Sem permissão.' };
    const lista = lerPedidosOracao();
    const idx = lista.findIndex(function (p) { return String(p.id) === String(id); });
    if (idx === -1) return { sucesso: false, mensagem: 'Pedido não encontrado.' };
    lista[idx].status = status;
    lista[idx].atualizadoEm = new Date().toISOString();
    salvarPedidosOracao(lista);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.salvarPedidoOracao) {
            IBNNuvem.salvarPedidoOracao(lista[idx]);
        }
    } catch (e) {}
    return { sucesso: true };
}

/**
 * Transfere a titularidade de gestor para outro membro cadastrado.
 * Só o gestor atual (ou conta master gestor) pode fazer.
 * O gestor atual vira admin (secretaria), salvo se for a conta master de bootstrap.
 */
function transferirTitularidadeGestor(novoGestorMembroId) {
    const atual = getUsuarioLogado();
    if (!isGestor(atual)) {
        return { sucesso: false, mensagem: 'Somente o gestor pode transferir a titularidade.' };
    }
    const lista = lerMembros();
    const idxNovo = lista.findIndex(function (m) { return String(m.id) === String(novoGestorMembroId); });
    if (idxNovo === -1) return { sucesso: false, mensagem: 'Membro não encontrado.' };
    if (lista[idxNovo].nivel === 'gestor') {
        return { sucesso: false, mensagem: 'Esta pessoa já é gestor.' };
    }

    // Rebaixa outros gestores "de membro" (não remove a conta master de login)
    lista.forEach(function (m, i) {
        if (m.nivel === 'gestor' && String(m.id) !== String(lista[idxNovo].id)) {
            lista[i].nivel = 'admin';
            lista[i].cargo = lista[i].cargo || 'Ex-gestor / Secretaria';
        }
    });

    lista[idxNovo].nivel = 'gestor';
    lista[idxNovo].cargo = 'Pastor / Gestor';
    lista[idxNovo].status = 'aprovado';
    salvarMembros(lista);

    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade(
                'transferir_gestor',
                'Titularidade de gestor transferida para ' + lista[idxNovo].nome,
                atual
            );
        }
    } catch (e) {}

    // Se o logado era um membro-gestor, atualiza sessão; master continua master
    if (atual && atual.id && String(atual.id) === String(lista.find(function(m){ return m.nivel==='admin' && m.email===atual.email; }) || {}).id) {
        const eu = lista.find(function (m) { return String(m.id) === String(atual.id); });
        if (eu) iniciarSessao(eu);
    }

    return {
        sucesso: true,
        mensagem: 'Titularidade transferida para ' + lista[idxNovo].nome + '. A conta master gestor@ continua como acesso de emergência/controle.',
        novoGestor: lista[idxNovo]
    };
}

