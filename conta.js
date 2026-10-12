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
    'Membro(a)',
    'Líder de Célula',
    'Líder de Ministério',
    'Líder em treinamento',
    'Discipulador(a)',
    'Pastor(a)',
    'Missionário(a)',
    'Voluntário(a)',
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
    var limpa = (lista || []).filter(function (m) {
        if (!m) return false;
        try { if (isContaSistema(m)) return false; } catch (e) {}
        try { if (typeof membroFoiExcluido === 'function' && membroFoiExcluido(m)) return false; } catch (e) {}
        return true;
    });
    localStorage.setItem(CHAVE_MEMBROS, JSON.stringify(limpa));
    // Cópia na nuvem (se configurada) — não bloqueia o uso local
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.sincronizarMembros) {
            IBNNuvem.sincronizarMembros(limpa).then(function (r) {
                if (r && !r.sucesso) console.warn('Nuvem (membros):', r.mensagem || r);
            }).catch(function (e) { console.warn('Nuvem (membros):', e); });
        }
    } catch (e) { /* silencioso */ }
}

/** Garante um membro específico na nuvem (cadastro / edição) */
function enviarMembroParaNuvem(membro) {
    try {
        if (typeof IBNNuvem === 'undefined' || !IBNNuvem.sincronizarUmMembro || !membro) return;
        IBNNuvem.sincronizarUmMembro(membro).then(function (r) {
            if (r && !r.sucesso) console.warn('Nuvem (1 membro):', r.mensagem || r);
        }).catch(function (e) { console.warn('Nuvem (1 membro):', e); });
    } catch (e) {}
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
    // 1) marca exclusão local + nuvem (antes de qualquer sync de membros)
    registrarExclusaoMembro(m);
    const nova = lista.filter(x => String(x.id) !== String(membroId));
    salvarMembros(nova);
    try {
        if (typeof IBNNuvem !== 'undefined') {
            // apaga documento na nuvem
            if (IBNNuvem.removerMembroNuvem) {
                IBNNuvem.removerMembroNuvem(membroId).catch(function () {});
            }
            // reenvia lista de excluídos para a nuvem (evita "ressuscitar" em outro aparelho)
            if (IBNNuvem.sincronizarExcluidos) {
                IBNNuvem.sincronizarExcluidos(lerExcluidos()).catch(function () {});
            }
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
        let lista = dados ? JSON.parse(dados) : [];
        if (!Array.isArray(lista)) lista = [];
        // Contas de sistema nunca devem aparecer como membros da igreja
        const limpa = lista.filter(function (m) {
            try { return !isContaSistema(m); } catch (e) { return true; }
        });
        // Também remove quem já foi excluído de forma definitiva
        const semExcluidos = limpa.filter(function (m) {
            try { return typeof membroFoiExcluido !== 'function' || !membroFoiExcluido(m); } catch (e) { return true; }
        });
        if (semExcluidos.length !== lista.length) {
            try { localStorage.setItem(CHAVE_MEMBROS, JSON.stringify(semExcluidos)); } catch (e) {}
        }
        return semExcluidos;
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
        enviarMembroParaNuvem(novo);
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
    // Sincroniza dados e fotos deste membro com a nuvem (silencioso)
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.agendarSyncSessao) {
            IBNNuvem.agendarSyncSessao(membro, 800);
        }
    } catch (e) {}
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
    const indice = lista.findIndex(m => String(m.id) === String(usuario.id));
    if (indice === -1) return { sucesso: false };

    const { nivel, status, funcoes, cargo, funcoesAprovadas, ...seguros } = dadosNovos;
    // cargo / funções oficiais só mudam com aprovação da gestão
    delete seguros.cargo;
    delete seguros.funcoesAprovadas;

    if (seguros.celulas) {
        const v = validarCelulas(seguros.celulas);
        if (v.erro) return { sucesso: false, mensagem: v.erro };
        seguros.celulas = v.lista;
    }

    if (Array.isArray(dadosNovos.funcoesSolicitadas)) {
        const aprovadas = Array.isArray(lista[indice].funcoesAprovadas) && lista[indice].funcoesAprovadas.length
            ? lista[indice].funcoesAprovadas
            : (lista[indice].cargo ? [lista[indice].cargo] : ['Membro(a)']);
        // solicita só o que ainda não está aprovado
        const pedidas = dadosNovos.funcoesSolicitadas.filter(function (f) {
            return aprovadas.indexOf(f) === -1 && String(f).indexOf('Membro') !== 0;
        });
        seguros.funcoesSolicitadas = pedidas;
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
        if (m.cargo === 'Líder de Ministério' || m.cargo === 'Líder de Ministério') m.nivel = 'lider_ministerio';
        else if (m.cargo === 'Líder de Célula') m.nivel = 'lider_celula';
        else if (!['admin', 'gestor'].includes(m.nivel)) m.nivel = 'membro';
    }

    // Ao aprovar/alocar, limpa pedidos e grava funções oficiais
    m.funcoesSolicitadas = [];
    const aprovadas = [];
    if (m.cargo) aprovadas.push(m.cargo);
    if (Array.isArray(m.funcoes)) {
        if (m.funcoes.indexOf('lider_celula') !== -1 && aprovadas.indexOf('Líder de Célula') === -1) aprovadas.push('Líder de Célula');
        if (m.funcoes.indexOf('lider_ministerio') !== -1 && aprovadas.indexOf('Líder de Ministério') === -1) aprovadas.push('Líder de Ministério');
        if (m.funcoes.indexOf('lider_treino') !== -1 && aprovadas.indexOf('Líder em treinamento') === -1) aprovadas.push('Líder em treinamento');
        if (m.funcoes.indexOf('anfitriao') !== -1 && aprovadas.indexOf('Anfitrião') === -1) aprovadas.push('Anfitrião');
    }
    if (!aprovadas.length) aprovadas.push('Membro(a)');
    m.funcoesAprovadas = aprovadas;

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
        id: 'fc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
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


/** Contas mestras de sistema — não entram na lista de membros da igreja */
function isContaSistema(m) {
    if (!m) return false;
    var id = String(m.id || '').toLowerCase();
    var email = String(m.email || '').toLowerCase().trim();
    var nome = String(m.nome || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    var nivel = String(m.nivel || '').toLowerCase();
    var funcoes = Array.isArray(m.funcoes) ? m.funcoes.map(function (f) { return String(f).toLowerCase(); }) : [];
    // IDs fixos / legado
    if (id === 'gestor-master' || id === 'admin-master' || id.indexOf('legado-') === 0) return true;
    if (id === 'gestor' || id === 'admin') return true;
    // E-mails oficiais do sistema
    if (email === 'gestor@ibndiamantino.com.br' || email === 'admin@ibndiamantino.com.br') return true;
    // Nome típico das contas mestras (com ou sem nível)
    if (nome === 'gestor master' || nome === 'admin master' || nome === 'gestor máster' || nome === 'admin máster') return true;
    if (nome === 'gestor' && (nivel === 'gestor' || funcoes.indexOf('master') >= 0)) return true;
    if (nome === 'admin master' || (nome.indexOf('admin master') === 0)) return true;
    if (funcoes.indexOf('master') >= 0 && (nivel === 'gestor' || nivel === 'admin')) return true;
    if (typeof CONTAS_MESTRAS !== 'undefined' && Array.isArray(CONTAS_MESTRAS)) {
        for (var i = 0; i < CONTAS_MESTRAS.length; i++) {
            var c = CONTAS_MESTRAS[i];
            if (String(c.id).toLowerCase() === id) return true;
            if (c.email && String(c.email).toLowerCase().trim() === email) return true;
            if (c.nome && String(c.nome).toLowerCase().trim() === String(m.nome || '').toLowerCase().trim()) return true;
        }
    }
    return false;
}
function membrosReais() {
    return ((typeof lerMembros === 'function') ? lerMembros() : []).filter(function (m) {
        return !isContaSistema(m);
    });
}
function isLiderDoMinisterio(u, nomeMinisterio) {
    if (!u || !nomeMinisterio) return false;
    if (typeof isAdmin === 'function' && isAdmin(u)) return true;
    if (u.nivel === 'gestor' || u.nivel === 'admin') return true;
    // Somente se o cadastro diz que lidera ESTE ministério
    return lideraEsteMinisterio(u, nomeMinisterio);
}


// ========== MODELO DE FUNÇÕES POR MINISTÉRIO (formulário de escala) ==========
const CHAVE_MODELO_ESCALA = 'ibn_modelo_escala_ministerios';
/** Modelo padrão Atmosfera: função + quantidade sugerida */
const MODELO_ESCALA_PADRAO = {
    'Atmosfera': [
        { funcao: 'Balcão Inf.', qtd: 1 },
        { funcao: 'Estacionamento', qtd: 3 },
        { funcao: 'Saudação Festiva', qtd: 8 },
        { funcao: 'Saudação Recepção', qtd: 6 },
        { funcao: 'Recepção Casal', qtd: 2 },
        { funcao: 'Recepção Visitantes', qtd: 2 },
        { funcao: 'Altar', qtd: 2 },
        { funcao: 'Abertura', qtd: 1 },
        { funcao: 'Dízimo e Oferta', qtd: 1 },
        { funcao: 'Máquina Cartão', qtd: 1 },
        { funcao: 'Pregador', qtd: 1 },
        { funcao: 'Observação', qtd: 0 }
    ],
    'Acolhimento': [
        { funcao: 'Recepção porta', qtd: 2 },
        { funcao: 'Orientação visitantes', qtd: 2 },
        { funcao: 'Café / apoio', qtd: 2 }
    ],
    'Louvor': [
        { funcao: 'Vocal', qtd: 4 },
        { funcao: 'Violão', qtd: 1 },
        { funcao: 'Teclado', qtd: 1 },
        { funcao: 'Bateria', qtd: 1 },
        { funcao: 'Som', qtd: 1 }
    ],
    'Mídias Sociais': [
        { funcao: 'Câmera', qtd: 2 },
        { funcao: 'Transmissão', qtd: 1 },
        { funcao: 'Stories / posts', qtd: 1 }
    ],
    'Intercessão': [
        { funcao: 'Intercessor', qtd: 4 },
        { funcao: 'Coordenação', qtd: 1 }
    ]
};

function lerTodosModelosEscala() {
    try {
        var salvos = JSON.parse(localStorage.getItem(CHAVE_MODELO_ESCALA) || '{}');
        var base = JSON.parse(JSON.stringify(MODELO_ESCALA_PADRAO));
        Object.keys(salvos || {}).forEach(function (k) { base[k] = salvos[k]; });
        return base;
    } catch (e) {
        return JSON.parse(JSON.stringify(MODELO_ESCALA_PADRAO));
    }
}
function lerModeloFuncoesMinisterio(ministerio) {
    var all = lerTodosModelosEscala();
    if (all[ministerio] && all[ministerio].length) return all[ministerio];
    // genérico se não existir
    return [
        { funcao: 'Função 1', qtd: 1 },
        { funcao: 'Função 2', qtd: 2 },
        { funcao: 'Apoio', qtd: 2 }
    ];
}
function salvarModeloFuncoesMinisterio(ministerio, lista) {
    try {
        var salvos = JSON.parse(localStorage.getItem(CHAVE_MODELO_ESCALA) || '{}');
        salvos[ministerio] = lista || [];
        localStorage.setItem(CHAVE_MODELO_ESCALA, JSON.stringify(salvos));
    } catch (e) {}
}

/** Modelo de funções pendente de aprovação (líder solicita → admin/gestor aprova) */
const CHAVE_MODELO_ESCALA_PENDENTE = 'ibn_modelo_escala_pendente';

function lerModelosPendentes() {
    try { return JSON.parse(localStorage.getItem(CHAVE_MODELO_ESCALA_PENDENTE) || '{}'); }
    catch (e) { return {}; }
}
function salvarTodosModelosPendentes(obj) {
    try { localStorage.setItem(CHAVE_MODELO_ESCALA_PENDENTE, JSON.stringify(obj || {})); } catch (e) {}
}

/**
 * Líder solicita aprovação de um novo modelo de funções.
 * Não sobrescreve o modelo oficial até a secretaria/gestor aprovar.
 */
function solicitarAprovacaoModeloEscala(ministerio, lista, solicitadoPor) {
    if (!ministerio || !Array.isArray(lista) || !lista.length) {
        return { sucesso: false, mensagem: 'Informe o ministério e ao menos uma função.' };
    }
    var limpa = lista.filter(function (it) {
        return it && String(it.funcao || '').trim() && !/^observa/i.test(String(it.funcao));
    }).map(function (it) {
        return { funcao: String(it.funcao).trim(), qtd: Math.max(0, parseInt(it.qtd, 10) || 0) };
    });
    if (!limpa.length) return { sucesso: false, mensagem: 'Nenhuma função válida.' };
    var all = lerModelosPendentes();
    all[ministerio] = {
        lista: limpa,
        solicitadoPor: solicitadoPor || '',
        solicitadoEm: new Date().toISOString(),
        status: 'pendente'
    };
    salvarTodosModelosPendentes(all);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade(
                'modelo_escala_pendente',
                'Solicitou aprovação do formulário de escala: ' + ministerio + ' (' + limpa.length + ' funções)',
                typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null
            );
        }
    } catch (e) {}
    return { sucesso: true, mensagem: 'Modelo de ' + ministerio + ' enviado para aprovação da secretaria/gestor.' };
}

function listarModelosPendentes() {
    var all = lerModelosPendentes();
    var out = [];
    Object.keys(all || {}).forEach(function (min) {
        var p = all[min];
        if (p && p.status === 'pendente' && Array.isArray(p.lista) && p.lista.length) {
            out.push({
                ministerio: min,
                lista: p.lista,
                solicitadoPor: p.solicitadoPor || '',
                solicitadoEm: p.solicitadoEm || ''
            });
        }
    });
    return out;
}

function temModeloPendente(ministerio) {
    var all = lerModelosPendentes();
    var p = all[ministerio];
    return !!(p && p.status === 'pendente' && Array.isArray(p.lista) && p.lista.length);
}

function obterModeloPendente(ministerio) {
    var all = lerModelosPendentes();
    return all[ministerio] || null;
}

/** Admin/gestor aprova → grava no modelo oficial e remove o pendente */
function aprovarModeloPendente(ministerio) {
    if (!ministerio) return { sucesso: false, mensagem: 'Ministério inválido.' };
    var all = lerModelosPendentes();
    var p = all[ministerio];
    if (!p || !Array.isArray(p.lista) || !p.lista.length) {
        return { sucesso: false, mensagem: 'Não há modelo pendente para ' + ministerio + '.' };
    }
    salvarModeloFuncoesMinisterio(ministerio, p.lista);
    delete all[ministerio];
    salvarTodosModelosPendentes(all);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade(
                'modelo_escala_aprovado',
                'Aprovou formulário de escala: ' + ministerio,
                typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null
            );
        }
    } catch (e) {}
    return { sucesso: true, mensagem: 'Modelo de ' + ministerio + ' aprovado e publicado.' };
}

/** Admin/gestor recusa → remove o pendente sem alterar o oficial */
function recusarModeloPendente(ministerio) {
    if (!ministerio) return { sucesso: false, mensagem: 'Ministério inválido.' };
    var all = lerModelosPendentes();
    if (!all[ministerio]) return { sucesso: false, mensagem: 'Não há modelo pendente.' };
    delete all[ministerio];
    salvarTodosModelosPendentes(all);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade(
                'modelo_escala_recusado',
                'Recusou formulário de escala: ' + ministerio,
                typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null
            );
        }
    } catch (e) {}
    return { sucesso: true, mensagem: 'Solicitação de modelo de ' + ministerio + ' recusada.' };
}

/**
 * Monta uma linha de escala a partir do formulário e grava.
 * dados = { ministerio, dataLabel, dataIso, preenchimento: { 'Estacionamento': ['Juarez','Napoleão'], ... }, observacao }
 */
function salvarDiaEscalaFormulario(dados) {
    if (!dados || !dados.ministerio) return { sucesso: false, mensagem: 'Ministério obrigatório' };
    var min = dados.ministerio;
    var linhas = lerEscalaCultosMinisterio(min);
    var iso = dados.dataIso || '';
    if (!iso && dados.dataLabel) {
        var pd = parseDataEscalaLabel(dados.dataLabel);
        if (pd) iso = pd.iso;
    }
    // remove dia igual se já existir
    linhas = linhas.filter(function (l) {
        return String(l.dataIso || '') !== String(iso) && String(l.dataLabel || '') !== String(dados.dataLabel || '');
    });
    var funcoes = dados.preenchimento || {};
    linhas.push({
        dataLabel: dados.dataLabel || iso,
        dataIso: iso,
        funcoes: funcoes,
        observacao: dados.observacao || '',
        ministerio: min,
        status: dados.status || 'rascunho', // rascunho | finalizada
        atualizadoEm: new Date().toISOString()
    });
    linhas.sort(function (a, b) {
        return String(a.dataIso || a.dataLabel).localeCompare(String(b.dataIso || b.dataLabel));
    });
    salvarEscalaCultosMinisterio(min, linhas);
    return { sucesso: true, mensagem: 'Escala do dia salva para ' + min, linhas: linhas };
}

/** Gera CSV do ministério (mesmo formato Atmosfera). Inclui rascunhos e finalizadas. */
function exportarEscalaCSV(ministerio) {
    var linhas = lerEscalaCultosMinisterio(ministerio) || [];
    if (!linhas.length) {
        try { alert('Nenhuma escala salva para ' + (ministerio || '') + '.\nSalve um rascunho ou finalize um dia antes de baixar.'); } catch (e) {}
        return { sucesso: false, mensagem: 'Vazio' };
    }
    var modelo = lerModeloFuncoesMinisterio(ministerio);
    // Colunas a partir do modelo + qualquer função que já exista nas linhas salvas
    var colsSet = {};
    (modelo || []).forEach(function (m) {
        if (m && m.funcao && !/^observa/i.test(m.funcao)) colsSet[m.funcao] = true;
    });
    linhas.forEach(function (l) {
        Object.keys(l.funcoes || {}).forEach(function (fn) { colsSet[fn] = true; });
    });
    var cols = ['Data'].concat(Object.keys(colsSet));
    cols.push('Observação');
    var sep = ';';
    var out = [cols.join(sep)];
    // ordena por data
    linhas = linhas.slice().sort(function (a, b) {
        return String(a.dataIso || a.dataLabel || '').localeCompare(String(b.dataIso || b.dataLabel || ''));
    });
    linhas.forEach(function (l) {
        // Data: rótulo; se rascunho, indica no texto da data para o líder ver no Excel
        var dataCell = l.dataLabel || l.dataIso || '';
        if (l.status && l.status !== 'finalizada') {
            dataCell = dataCell + ' (rascunho)';
        }
        var row = [dataCell];
        cols.slice(1).forEach(function (c) {
            if (/^observa/i.test(c)) {
                var obs = l.observacao || '';
                if (l.status && l.status !== 'finalizada' && obs.indexOf('rascunho') === -1) {
                    obs = (obs ? obs + ' | ' : '') + 'status: rascunho';
                }
                row.push(obs);
                return;
            }
            var nomes = (l.funcoes && l.funcoes[c]) ? l.funcoes[c] : [];
            row.push(Array.isArray(nomes) ? nomes.join(', ') : String(nomes || ''));
        });
        out.push(row.join(sep));
    });
    var csv = '\uFEFF' + out.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    var d = new Date();
    var ds = String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
    a.download = 'escala_' + String(ministerio || 'ministerio').replace(/\s+/g, '_').toLowerCase() + '_' + ds + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} }, 500);
    return { sucesso: true, mensagem: linhas.length + ' dia(s) no CSV (inclui rascunhos)', quantidade: linhas.length };
}


// ========== ESCALA DE CULTOS / SERVIÇOS (modelo Atmosfera CSV) ==========
const CHAVE_ESCALA_CULTOS = 'ibn_escala_cultos';
/** Funções padrão Atmosfera (colunas do CSV) */
const ESCALA_FUNCOES_ATMOSFERA = [
    'Balcão Inf.', 'Estacionamento', 'Saudação Festiva', 'Saudação Recepção',
    'Recepção Casal', 'Recepção Visitantes', 'Altar', 'Abertura',
    'Dízimo e Oferta', 'Máquina Cartão', 'Pregador', 'Observação'
];

function lerTodasEscalasCultos() {
    try { return JSON.parse(localStorage.getItem(CHAVE_ESCALA_CULTOS) || '{}'); }
    catch (e) { return {}; }
}
function salvarTodasEscalasCultos(obj) {
    localStorage.setItem(CHAVE_ESCALA_CULTOS, JSON.stringify(obj || {}));
}
/** Escala de um ministério: array de { dataLabel, dataIso, funcoes: { nomeFuncao: [nomes...] }, observacao } */
function lerEscalaCultosMinisterio(ministerio) {
    var all = lerTodasEscalasCultos();
    var m = all[ministerio] || all['Atmosfera'];
    return Array.isArray(m) ? m : [];
}
function salvarEscalaCultosMinisterio(ministerio, linhas) {
    var all = lerTodasEscalasCultos();
    all[ministerio || 'Atmosfera'] = linhas || [];
    salvarTodasEscalasCultos(all);
}

/** Converte "DOM 13/09/26" ou "QUINTA 17/09/26" em Date / ISO */
function parseDataEscalaLabel(label) {
    var s = String(label || '').trim();
    var m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!m) return null;
    var dd = parseInt(m[1], 10);
    var mm = parseInt(m[2], 10) - 1;
    var aa = parseInt(m[3], 10);
    if (aa < 100) aa += 2000;
    var d = new Date(aa, mm, dd, 12, 0, 0);
    if (isNaN(d.getTime())) return null;
    var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return { date: d, iso: iso, label: s };
}

/** Parte nomes: "Juarez, Juscelio e Napoleão" → lista */
function parseNomesEscala(celula) {
    var s = String(celula || '').trim();
    if (!s) return [];
    s = s.replace(/\s+e\s+/gi, ',').replace(/\s+&\s+/g, ',');
    return s.split(/[,;/|]+/).map(function (x) { return x.trim(); }).filter(Boolean);
}

/**
 * Importa CSV no formato Atmosfera (separador ;).
 * Retorna { sucesso, quantidade, linhas, mensagem }
 */
function importarEscalaCSV(textoCSV, ministerio) {
    ministerio = ministerio || 'Atmosfera';
    if (!textoCSV || !String(textoCSV).trim()) {
        return { sucesso: false, mensagem: 'Arquivo vazio.' };
    }
    var texto = String(textoCSV).replace(/^\uFEFF/, '');
    var linhasBrutas = texto.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (linhasBrutas.length < 2) {
        return { sucesso: false, mensagem: 'CSV precisa de cabeçalho e pelo menos uma linha.' };
    }
    var sep = linhasBrutas[0].indexOf(';') >= 0 ? ';' : ',';
    var header = linhasBrutas[0].split(sep).map(function (h) { return h.trim(); });
    var idxData = 0;
    var funcoesCols = [];
    header.forEach(function (h, i) {
        if (i === 0 || /^data$/i.test(h)) { idxData = i; return; }
        if (/observa/i.test(h)) return;
        funcoesCols.push({ i: i, nome: h });
    });
    var idxObs = header.findIndex(function (h) { return /observa/i.test(h); });
    var linhas = [];
    for (var r = 1; r < linhasBrutas.length; r++) {
        var cols = linhasBrutas[r].split(sep);
        var dataLabel = (cols[idxData] || '').trim();
        if (!dataLabel) continue;
        var pd = parseDataEscalaLabel(dataLabel);
        var funcoes = {};
        funcoesCols.forEach(function (fc) {
            var nomes = parseNomesEscala(cols[fc.i] || '');
            if (nomes.length) funcoes[fc.nome] = nomes;
        });
        linhas.push({
            dataLabel: dataLabel,
            dataIso: pd ? pd.iso : '',
            funcoes: funcoes,
            observacao: idxObs >= 0 ? String(cols[idxObs] || '').trim() : '',
            ministerio: ministerio
        });
    }
    // ordena por data
    linhas.sort(function (a, b) {
        return String(a.dataIso || a.dataLabel).localeCompare(String(b.dataIso || b.dataLabel));
    });
    salvarEscalaCultosMinisterio(ministerio, linhas);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade('escala_csv', 'Importou escala ' + ministerio + ' (' + linhas.length + ' dias)', getUsuarioLogado());
        }
    } catch (e) {}
    return { sucesso: true, quantidade: linhas.length, linhas: linhas, mensagem: linhas.length + ' dia(s) importados para ' + ministerio };
}

/** Nome do membro parece estar na lista da escala? */
function nomeBateEscala(nomeCompleto, nomeNaEscala) {
    var full = String(nomeCompleto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    var part = String(nomeNaEscala || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (!full || !part) return false;
    if (full === part) return true;
    var partesFull = full.split(/\s+/);
    var partesE = part.split(/\s+/);
    // primeiro nome
    if (partesFull[0] && partesE[0] && partesFull[0] === partesE[0]) {
        // se escala tem só primeiro nome, ok; se tem sobrenome, exige coincidência parcial
        if (partesE.length === 1) return true;
        return partesE.every(function (pe) {
            return partesFull.some(function (pf) { return pf.indexOf(pe) === 0 || pe.indexOf(pf) === 0; });
        });
    }
    // contém
    if (full.indexOf(part) !== -1 || part.indexOf(partesFull[0]) !== -1) return true;
    return false;
}

/**
 * Próximos compromissos do membro na escala (hoje e amanhã prioridade).
 * Retorna [{ dataLabel, dataIso, diasAte, funcoes: [nomeFuncao], ministerio, observacao }]
 */
function escalaProximasDoMembro(membro, horizonteDias) {
    horizonteDias = horizonteDias == null ? 14 : horizonteDias;
    membro = membro || (typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null);
    if (!membro || !membro.nome) return [];
    var hoje = new Date();
    hoje.setHours(12, 0, 0, 0);
    var all = lerTodasEscalasCultos();
    var out = [];
    Object.keys(all).forEach(function (min) {
        (all[min] || []).forEach(function (linha) {
            if (!linha.dataIso) return;
            var d = new Date(linha.dataIso + 'T12:00:00');
            if (isNaN(d.getTime())) return;
            var diff = Math.round((d - hoje) / 86400000);
            if (diff < 0 || diff > horizonteDias) return;
            var funcoesHit = [];
            var funcoes = linha.funcoes || {};
            Object.keys(funcoes).forEach(function (fn) {
                (funcoes[fn] || []).forEach(function (nomeE) {
                    if (nomeBateEscala(membro.nome, nomeE)) funcoesHit.push(fn);
                });
            });
            if (!funcoesHit.length) return;
            // unique
            funcoesHit = funcoesHit.filter(function (v, i, a) { return a.indexOf(v) === i; });
            out.push({
                dataLabel: linha.dataLabel,
                dataIso: linha.dataIso,
                diasAte: diff,
                funcoes: funcoesHit,
                ministerio: min,
                observacao: linha.observacao || ''
            });
        });
    });
    out.sort(function (a, b) { return a.diasAte - b.diasAte; });
    return out;
}

/** Horário padrão do culto para lembretes (pode ajustar) */
var ESCALA_HORARIO_CULTO_PADRAO = '19:00';

function escalaDataHoraCulto(dataIso, horario) {
    horario = horario || ESCALA_HORARIO_CULTO_PADRAO;
    var hm = String(horario).split(':');
    var h = parseInt(hm[0], 10) || 19;
    var mi = parseInt(hm[1], 10) || 0;
    return new Date(dataIso + 'T' + String(h).padStart(2,'0') + ':' + String(mi).padStart(2,'0') + ':00');
}

/**
 * Avisos prioritários no site (logado):
 * - até 45 dias: lista completa disponível
 * - 36h antes e no dia: banner
 * - 4h antes: banner urgente
 */
function escalaAvisosUrgentes(membro) {
    membro = membro || (typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null);
    var lista = escalaProximasDoMembro(membro, 3);
    var agora = new Date();
    return lista.filter(function (x) {
        if (x.diasAte > 2) return false;
        var culto = escalaDataHoraCulto(x.dataIso);
        var horas = (culto - agora) / 3600000;
        // janela: 36h antes até o culto (e um pouco depois no mesmo dia)
        return horas <= 36 && horas >= -2;
    }).map(function (x) {
        var culto = escalaDataHoraCulto(x.dataIso);
        var horas = (culto - agora) / 3600000;
        x.horasAte = Math.round(horas * 10) / 10;
        x.urgente4h = horas <= 4 && horas >= 0;
        x.janela36h = horas <= 36 && horas > 4;
        return x;
    });
}

function textoLembreteEscala(membro, item) {
    var nome = (membro && membro.nome) ? String(membro.nome).split(' ')[0] : 'irmão(ã)';
    var funcoes = (item.funcoes || []).join(', ') || 'sua função';
    var min = item.ministerio || 'IBN';
    var quando = item.diasAte === 0 ? 'hoje' : (item.diasAte === 1 ? 'amanhã' : (item.dataLabel || item.dataIso));
    var obs = item.observacao ? ' (' + item.observacao + ')' : '';
    return 'Olá, ' + nome + '! Lembrete IBN Diamantino.\n\n' +
        'Você está na escala ' + quando + ' — ministério *' + min + '*.\n' +
        'Função: *' + funcoes + '*' + obs + '.\n\n' +
        'Por favor, esteja na igreja *30 minutos antes*.\n' +
        'Deus abençoe! 🙏';
}

function telefoneWhatsAppBR(tel) {
    var d = String(tel || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length <= 11 && d.charAt(0) !== '5') d = '55' + d;
    return d;
}

function linkWhatsAppEscala(telefone, texto) {
    var d = telefoneWhatsAppBR(telefone);
    if (!d) return '';
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(texto || '');
}

/** Monta lista de lembretes WhatsApp para um dia/ministério (secretaria envia) */
function montarLembretesWhatsAppEscala(ministerio, dataIso) {
    var linhas = lerEscalaCultosMinisterio(ministerio);
    var linha = (linhas || []).find(function (l) { return String(l.dataIso) === String(dataIso); });
    if (!linha) return [];
    var membros = (typeof membrosReais === 'function') ? membrosReais() : lerMembros();
    var out = [];
    var funcoes = linha.funcoes || {};
    Object.keys(funcoes).forEach(function (fn) {
        (funcoes[fn] || []).forEach(function (nomeE) {
            var m = (membros || []).find(function (p) { return nomeBateEscala(p.nome, nomeE); });
            var item = {
                dataLabel: linha.dataLabel,
                dataIso: linha.dataIso,
                diasAte: 0,
                funcoes: [fn],
                ministerio: ministerio,
                observacao: linha.observacao || ''
            };
            var texto = textoLembreteEscala(m || { nome: nomeE }, item);
            var tel = m ? m.telefone : '';
            out.push({
                nome: m ? m.nome : nomeE,
                telefone: tel,
                funcao: fn,
                texto: texto,
                link: linkWhatsAppEscala(tel, texto)
            });
        });
    });
    return out;
}

/** Escala completa do ministério nos próximos N dias (padrão 45) */
function escalaCompletaMinisterio(ministerio, horizonteDias) {
    horizonteDias = horizonteDias == null ? 120 : horizonteDias;
    var hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    var linhas = lerEscalaCultosMinisterio(ministerio) || [];
    return linhas.filter(function (l) {
        if (!l.dataIso) return true;
        var d = new Date(l.dataIso + 'T12:00:00');
        var diff = Math.round((d - hoje) / 86400000);
        return diff >= -1 && diff <= horizonteDias;
    }).sort(function (a, b) {
        return String(a.dataIso || '').localeCompare(String(b.dataIso || ''));
    });
}

function removerDiaEscala(ministerio, dataIso) {
    var linhas = lerEscalaCultosMinisterio(ministerio) || [];
    linhas = linhas.filter(function (l) { return String(l.dataIso) !== String(dataIso); });
    salvarEscalaCultosMinisterio(ministerio, linhas);
    return { sucesso: true };
}



// ========== CONFIRMAÇÃO DE ESCALA (membro confirma; líder acompanha) ==========
const CHAVE_CONFIRMA_ESCALA = 'ibn_escala_confirmacoes';

function lerConfirmacoesEscala() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CONFIRMA_ESCALA) || '{}'); }
    catch (e) { return {}; }
}
function salvarConfirmacoesEscala(obj) {
    localStorage.setItem(CHAVE_CONFIRMA_ESCALA, JSON.stringify(obj || {}));
}
/** chave única: ministerio|dataIso|membroId */
function chaveConfirmacaoEscala(ministerio, dataIso, membroId) {
    return String(ministerio || '') + '|' + String(dataIso || '') + '|' + String(membroId || '');
}

// ========== NOTIFICAÇÕES PUSH / LOCAIS (escala) ==========
function statusPermissaoNotificacao() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission; // granted | denied | default
}

/** Pede permissão e grava no cadastro do membro (granted/denied/default) */
async function pedirPermissaoNotificacoes(membro) {
    membro = membro || (typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null);
    if (!membro || !membro.id) return { sucesso: false, permissao: 'default' };
    if (typeof Notification === 'undefined') {
        gravarPermissaoNotifMembro(membro.id, 'unsupported');
        return { sucesso: false, permissao: 'unsupported' };
    }
    try {
        var perm = Notification.permission;
        if (perm === 'default') {
            perm = await Notification.requestPermission();
        }
        gravarPermissaoNotifMembro(membro.id, perm);
        // registra SW se ainda não
        try {
            if ('serviceWorker' in navigator) {
                await navigator.serviceWorker.register('sw.js');
            }
        } catch (e) {}
        return { sucesso: perm === 'granted', permissao: perm };
    } catch (e) {
        gravarPermissaoNotifMembro(membro.id, 'denied');
        return { sucesso: false, permissao: 'denied', mensagem: String(e) };
    }
}

function gravarPermissaoNotifMembro(membroId, permissao) {
    try {
        var lista = (typeof lerMembros === 'function') ? lerMembros() : [];
        var idx = lista.findIndex(function (m) { return String(m.id) === String(membroId); });
        if (idx === -1) return;
        lista[idx].notifPermission = permissao;
        lista[idx].notifAtualizadoEm = new Date().toISOString();
        if (typeof salvarMembros === 'function') salvarMembros(lista);
        else localStorage.setItem('ibn_membros', JSON.stringify(lista));
        // atualiza sessão
        try {
            var u = (typeof getUsuarioLogado === 'function') ? getUsuarioLogado() : null;
            if (u && String(u.id) === String(membroId) && typeof iniciarSessao === 'function') {
                u.notifPermission = permissao;
                iniciarSessao(u);
            }
        } catch (e) {}
        try {
            if (typeof IBNNuvem !== 'undefined' && IBNNuvem.sincronizarUmMembro) {
                IBNNuvem.sincronizarUmMembro(lista[idx]);
            }
        } catch (e) {}
    } catch (e) {}
}

/**
 * Mostra notificação local (aparelho).
 * Funciona se permission=granted; com site aberto ou via service worker.
 */
async function mostrarNotificacaoEscala(titulo, corpo, tag) {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission !== 'granted') return false;
    try {
        if ('serviceWorker' in navigator) {
            var reg = await navigator.serviceWorker.ready;
            if (reg && reg.active) {
                reg.active.postMessage({
                    type: 'MOSTRAR_NOTIFICACAO',
                    titulo: titulo || 'IBN Diamantino',
                    corpo: corpo || '',
                    tag: tag || 'ibn-escala',
                    url: './index.html',
                    requireInteraction: true
                });
                // fallback direto no registration
                await reg.showNotification(titulo || 'IBN Diamantino', {
                    body: corpo || '',
                    tag: tag || 'ibn-escala',
                    data: { url: './index.html' },
                    requireInteraction: true
                });
                return true;
            }
        }
        new Notification(titulo || 'IBN Diamantino', { body: corpo || '', tag: tag || 'ibn-escala' });
        return true;
    } catch (e) {
        try {
            new Notification(titulo || 'IBN Diamantino', { body: corpo || '' });
            return true;
        } catch (e2) { return false; }
    }
}

/** Ao abrir o site logado: pede permissão (1x) e dispara notif se escala em 36h */
async function processarNotificacoesEscalaAoAbrir() {
    var u = (typeof getUsuarioLogado === 'function') ? getUsuarioLogado() : null;
    if (!u || !u.id) return;
    // pede permissão só se ainda default
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        // não força na hora do login agressivo — só se já tem escala próxima
        var avisosPre = (typeof escalaAvisosUrgentes === 'function') ? escalaAvisosUrgentes(u) : [];
        if (avisosPre.length) {
            await pedirPermissaoNotificacoes(u);
        }
    } else if (typeof Notification !== 'undefined') {
        gravarPermissaoNotifMembro(u.id, Notification.permission);
    }
    var avisos = (typeof escalaAvisosUrgentes === 'function') ? escalaAvisosUrgentes(u) : [];
    if (!avisos.length) return;
    var a = avisos[0];
    var chave = 'ibn_push_escala_' + a.dataIso + '_' + u.id;
    try {
        if (sessionStorage.getItem(chave)) return; // já mostrou nesta sessão
        sessionStorage.setItem(chave, '1');
    } catch (e) {}
    var funcoes = (a.funcoes || []).join(', ');
    var corpo = 'Você está na escala ' + (a.diasAte === 0 ? 'HOJE' : 'em breve') +
        ' (' + (a.dataLabel || '') + '): ' + funcoes +
        (a.ministerio ? ' — ' + a.ministerio : '') +
        '. Esteja 30 minutos antes na igreja. Abra o site e confirme que recebeu.';
    await mostrarNotificacaoEscala('📋 Escala IBN Diamantino', corpo, 'escala-' + a.dataIso);
}


function confirmarRecebimentoEscala(ministerio, dataIso, membro) {
    membro = membro || (typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null);
    if (!membro || !membro.id) return { sucesso: false, mensagem: 'Faça login.' };
    var all = lerConfirmacoesEscala();
    var k = chaveConfirmacaoEscala(ministerio, dataIso, membro.id);
    all[k] = {
        membroId: membro.id,
        nome: membro.nome,
        ministerio: ministerio,
        dataIso: dataIso,
        confirmadoEm: new Date().toISOString(),
        aparelho: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.slice(0, 80) : ''
    };
    salvarConfirmacoesEscala(all);
    try {
        if (typeof IBNNuvem !== 'undefined' && IBNNuvem.registrarAtividade) {
            IBNNuvem.registrarAtividade('escala_confirmou', 'Confirmou escala ' + ministerio + ' ' + dataIso, membro);
        }
    } catch (e) {}
    return { sucesso: true, mensagem: 'Confirmação registrada. Obrigado!' };
}
function membroConfirmouEscala(ministerio, dataIso, membroId) {
    var all = lerConfirmacoesEscala();
    return !!all[chaveConfirmacaoEscala(ministerio, dataIso, membroId)];
}

/**
 * Lista de escalados para o líder nas próximas 36h (com telefone, WA, confirmação).
 * Retorna [{ nome, telefone, funcao, ministerio, dataIso, dataLabel, confirmou, linkWa, linkTel }]
 */
function listaEscaladosJanela36h(ministerioFiltro) {
    var agora = new Date();
    var all = lerTodasEscalasCultos();
    var membros = (typeof membrosReais === 'function') ? membrosReais() : (typeof lerMembros === 'function' ? lerMembros() : []);
    var out = [];
    Object.keys(all).forEach(function (min) {
        if (ministerioFiltro && String(min).toLowerCase() !== String(ministerioFiltro).toLowerCase()) return;
        (all[min] || []).forEach(function (linha) {
            if (!linha.dataIso) return;
            var culto = (typeof escalaDataHoraCulto === 'function')
                ? escalaDataHoraCulto(linha.dataIso)
                : new Date(linha.dataIso + 'T19:00:00');
            var horas = (culto - agora) / 3600000;
            if (horas > 36 || horas < -1) return;
            var funcoes = linha.funcoes || {};
            Object.keys(funcoes).forEach(function (fn) {
                (funcoes[fn] || []).forEach(function (nomeE) {
                    var m = (membros || []).find(function (p) {
                        return typeof nomeBateEscala === 'function' && nomeBateEscala(p.nome, nomeE);
                    });
                    var item = {
                        dataLabel: linha.dataLabel,
                        dataIso: linha.dataIso,
                        funcoes: [fn],
                        ministerio: min,
                        observacao: linha.observacao || ''
                    };
                    var texto = (typeof textoLembreteEscala === 'function')
                        ? textoLembreteEscala(m || { nome: nomeE }, item)
                        : ('Lembrete IBN Diamantino — escala ' + min);
                    var tel = m ? (m.telefone || '') : '';
                    var mid = m ? m.id : '';
                    var nPerm = m ? (m.notifPermission || 'default') : 'default';
                    out.push({
                        nome: m ? m.nome : nomeE,
                        membroId: mid,
                        telefone: tel,
                        funcao: fn,
                        ministerio: min,
                        dataIso: linha.dataIso,
                        dataLabel: linha.dataLabel,
                        horasAte: Math.round(horas * 10) / 10,
                        confirmou: mid ? membroConfirmouEscala(min, linha.dataIso, mid) : false,
                        notifPermission: nPerm,
                        notifLabel: nPerm === 'granted' ? '🔔 Notif. OK' : (nPerm === 'denied' ? '🔕 Bloqueou notif.' : '⏳ Sem permissão'),
                        linkWa: (typeof linkWhatsAppEscala === 'function') ? linkWhatsAppEscala(tel, texto) : '',
                        linkTel: tel ? ('tel:' + String(tel).replace(/\D/g, '')) : '',
                        texto: texto
                    });
                });
            });
        });
    });
    out.sort(function (a, b) {
        if (a.dataIso !== b.dataIso) return String(a.dataIso).localeCompare(String(b.dataIso));
        return String(a.nome).localeCompare(String(b.nome), 'pt-BR');
    });
    return out;
}


// Compat: escala simples antiga (lista manual)
function lerEscalaMinisterio(nomeMinisterio) {
    try {
        var all = JSON.parse(localStorage.getItem('ibn_escala_ministerios') || '{}');
        return Array.isArray(all[nomeMinisterio]) ? all[nomeMinisterio] : [];
    } catch (e) { return []; }
}
function salvarEscalaMinisterio(nomeMinisterio, itens) {
    try {
        var all = JSON.parse(localStorage.getItem('ibn_escala_ministerios') || '{}');
        all[nomeMinisterio] = itens || [];
        localStorage.setItem('ibn_escala_ministerios', JSON.stringify(all));
    } catch (e) {}
}
function escalaDoMembroNoMinisterio(membroId, nomeMinisterio) {
    return lerEscalaMinisterio(nomeMinisterio).filter(function (x) {
        return String(x.membroId) === String(membroId);
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


/** Lista normalizada dos ministérios que a pessoa LIDER (não só participa) */
function normalizarNomeMinisterio(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function nomesMinisterioIguais(a, b) {
    var x = normalizarNomeMinisterio(a);
    var y = normalizarNomeMinisterio(b);
    if (!x || !y) return false;
    if (x === y) return true;
    // abreviações comuns
    if (x.indexOf(y) !== -1 || y.indexOf(x) !== -1) return true;
    // "midias" ↔ "midias sociais"
    if (x.replace(/\s/g,'') === y.replace(/\s/g,'')) return true;
    return false;
}
function ministeriosQueLidera(m) {
    if (!m) return [];
    var out = [];
    function add(s) {
        s = String(s || '').trim();
        if (!s) return;
        // evita duplicar equivalentes
        if (out.some(function (x) { return nomesMinisterioIguais(x, s); })) return;
        out.push(s);
    }
    if (Array.isArray(m.lideraMinisterios)) {
        m.lideraMinisterios.forEach(add);
    }
    if (m.lideraMinisterio) {
        String(m.lideraMinisterio).split(/[,;/|]+/).forEach(add);
    }
    // Fallback: função específica tipo "Líder de Louvor" / "Líder da Mídia"
    var fe = String(m.funcaoEspecifica || '');
    if (/l[ií]der/i.test(fe) && typeof LISTA_MINISTERIOS !== 'undefined') {
        LISTA_MINISTERIOS.forEach(function (nome) {
            var n = normalizarNomeMinisterio(nome);
            var f = normalizarNomeMinisterio(fe);
            // "lider da midia" → Mídias Sociais
            if (f.indexOf(n) !== -1) add(nome);
            if (n.indexOf('midia') !== -1 && (f.indexOf('midia') !== -1 || f.indexOf('media') !== -1)) add(nome);
        });
    }
    return out;
}
/** True se lidera ESTE ministério específico (cadastro) */
function lideraEsteMinisterio(m, nomeMinisterio) {
    if (!m || !nomeMinisterio) return false;
    return ministeriosQueLidera(m).some(function (x) {
        return nomesMinisterioIguais(x, nomeMinisterio);
    });
}
/** True se participa (lista ministerios) deste ministério */
function participaDesteMinisterio(m, nomeMinisterio) {
    if (!m || !nomeMinisterio) return false;
    var mins = Array.isArray(m.ministerios) ? m.ministerios : [];
    if (!mins.length && m.ministerios) mins = String(m.ministerios).split(/[,;/|]+/);
    // quem lidera também "participa"
    if (lideraEsteMinisterio(m, nomeMinisterio)) return true;
    return mins.some(function (x) {
        return nomesMinisterioIguais(x, nomeMinisterio);
    });
}

function membrosDoMinisterio(nomeMinisterio) {
    const alvoNome = String(nomeMinisterio || '').trim();
    const alvo = alvoNome.toLowerCase();
    if (!alvo) return [];
    const lista = (typeof membrosReais === 'function' ? membrosReais() : lerMembros()).filter(function (m) {
        if (typeof isContaSistema === 'function' && isContaSistema(m)) return false;
        const st = (m.status || 'aprovado').toLowerCase();
        return st !== 'rejeitado' && st !== 'recusado' && st !== 'excluido';
    });
    // Entra se PARTICIPA ou se LIDERA este ministério (pelo cadastro de alocação)
    return lista.filter(function (m) {
        return participaDesteMinisterio(m, alvoNome) || lideraEsteMinisterio(m, alvoNome);
    }).map(function (m) {
        // Papel só pelo cadastro: lideraMinisterios / lideraMinisterio — NÃO pelo cargo genérico
        var papel = lideraEsteMinisterio(m, alvoNome) ? 'Líder' : 'Integrante';
        if (m.status === 'pendente' || m.status === 'aguardando') papel += ' (pendente)';
        return Object.assign({}, m, { papel: papel });
    }).sort(function (a, b) {
        if (String(a.papel).indexOf('Líder') === 0 && String(b.papel).indexOf('Líder') !== 0) return -1;
        if (String(b.papel).indexOf('Líder') === 0 && String(a.papel).indexOf('Líder') !== 0) return 1;
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });
}

/** Papéis na célula — respeita alocação (papeis / lideraCelulaId), não só cargo genérico */
function papeisNaCelula(m, celulaId) {
    if (!m || !celulaId) return [];
    var out = [];
    var celulas = Array.isArray(m.celulas) ? m.celulas : [];
    celulas.forEach(function (c) {
        var id = (typeof idCelulaDe === 'function') ? idCelulaDe(c) : (c && c.id);
        if (String(id) !== String(celulaId)) return;
        var pp = Array.isArray(c.papeis) ? c.papeis : String(c.papel || '').split(/[,;/]+/);
        pp.forEach(function (p) {
            p = String(p || '').trim().toLowerCase();
            if (p && out.indexOf(p) === -1) out.push(p);
        });
    });
    if (m.lideraCelulaId && String(m.lideraCelulaId) === String(celulaId)) {
        if (out.indexOf('lider') === -1) out.push('lider');
    }
    if (Array.isArray(m.funcoes)) {
        if (m.funcoes.indexOf('anfitriao') !== -1 && out.indexOf('anfitriao') === -1) {
            // só se estiver nesta célula
            var nesta = celulas.some(function (c) {
                var id = (typeof idCelulaDe === 'function') ? idCelulaDe(c) : (c && c.id);
                return String(id) === String(celulaId);
            });
            if (nesta) out.push('anfitriao');
        }
    }
    return out;
}
function equipeDaCelula(celulaId) {
    const membros = membrosDaCelula(celulaId);
    const todos = (typeof membrosReais === 'function' ? membrosReais() : lerMembros()).filter(function (m) {
        if (typeof isContaSistema === 'function' && isContaSistema(m)) return false;
        const st = (m.status || 'aprovado').toLowerCase();
        return st !== 'rejeitado' && st !== 'recusado';
    });
    function temPapel(m, papel) {
        var pp = papeisNaCelula(m, celulaId);
        if (pp.indexOf(papel) !== -1) return true;
        if (papel === 'lider' && m.lideraCelulaId && String(m.lideraCelulaId) === String(celulaId)) return true;
        return false;
    }
    // Líder: prioridade alocação nesta célula
    var lider = membros.find(function (m) { return temPapel(m, 'lider'); })
        || todos.find(function (m) { return temPapel(m, 'lider'); })
        || null;
    var anfitriao = membros.find(function (m) { return temPapel(m, 'anfitriao'); })
        || membros.find(function (m) {
            return (m.funcaoEspecifica || '').toLowerCase().indexOf('anfitri') !== -1
                && membros.some(function (x) { return x.id === m.id; });
        }) || null;
    var liderTreino = membros.find(function (m) { return temPapel(m, 'lider_treino'); })
        || membros.find(function (m) {
            return m.cargo === 'Líder em treinamento'
                || (m.funcaoEspecifica || '').toLowerCase().indexOf('treinament') !== -1;
        }) || null;
    return { lider: lider, anfitriao: anfitriao, liderTreino: liderTreino, membros: membros };
}


/** Adiciona membro já cadastrado a uma célula (líder/admin/gestor) */

/** Indicadores de conformidade — células e ministérios */
function _membroPendente(m) {
    if (!m) return false;
    return m.status === 'pendente' || m.status === 'aguardando' || m.statusAprovacao === 'pendente';
}
function statusPendenciasCelula(celulaId) {
    var eq = (typeof equipeDaCelula === 'function') ? equipeDaCelula(celulaId) : { lider: null, anfitriao: null, liderTreino: null, membros: [] };
    var nivel = 0; // 0 ok, 1 alerta (laranja), 2 critico (vermelho), azul relatório separado
    var motivos = [];
    if (!eq.lider) {
        nivel = Math.max(nivel, 2);
        motivos.push('Vermelho: sem membro cadastrado como líder de célula');
    } else if (_membroPendente(eq.lider)) {
        nivel = Math.max(nivel, 1);
        motivos.push('Líder aguardando aprovação');
    }
    // Anfitrião: se não tem e não é célula de sábado na igreja, sinaliza
    if (!eq.anfitriao) {
        // cargo vago — vermelho se também sem líder já é 2; senão vermelho para anfitrião
        nivel = Math.max(nivel, 2);
        motivos.push('Vermelho: sem membro cadastrado como anfitrião');
    } else if (_membroPendente(eq.anfitriao)) {
        nivel = Math.max(nivel, 1);
        motivos.push('Anfitrião aguardando aprovação');
    }
    // Membros pendentes na célula
    var pend = (eq.membros || []).filter(_membroPendente);
    if (pend.length) {
        nivel = Math.max(nivel, 1);
        motivos.push(pend.length + ' membro(s) pendente(s)');
    }
    // Relatório da última reunião esperada
    var faltaRelatorio = false;
    try {
        var cel = (typeof LISTA_CELULAS !== 'undefined') ? LISTA_CELULAS.find(function(c){ return c.id === celulaId; }) : null;
        var diaSemana = cel && cel.dia === 'sabado' ? 6 : 2; // 2=terça, 6=sábado
        var hoje = new Date();
        // última data desse dia da semana (não futuro)
        var d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
        while (d.getDay() !== diaSemana) d.setDate(d.getDate() - 1);
        // se ainda é "hoje" e antes do horário típico da célula, usa semana anterior
        if (d.toDateString() === hoje.toDateString() && hoje.getHours() < 20) {
            d.setDate(d.getDate() - 7);
        }
        var iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        var br = String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
        var rels = (typeof lerRelatoriosCelula === 'function') ? lerRelatoriosCelula() : [];
        var tem = rels.some(function(r) {
            if (String(r.celulaId) !== String(celulaId)) return false;
            var rd = String(r.data || '');
            return rd.indexOf(iso) === 0 || rd.indexOf(br) === 0 || rd === iso || rd === br;
        });
        // também aceita relatório nos últimos 10 dias
        if (!tem) {
            var limite = new Date(hoje.getTime() - 10 * 24 * 60 * 60 * 1000);
            tem = rels.some(function(r) {
                if (String(r.celulaId) !== String(celulaId)) return false;
                var rd = String(r.data || '');
                var parsed = null;
                if (/^\d{4}-\d{2}-\d{2}/.test(rd)) parsed = new Date(rd.slice(0,10) + 'T12:00:00');
                else if (/^\d{2}\/\d{2}\/\d{4}/.test(rd)) {
                    var p = rd.slice(0,10).split('/');
                    parsed = new Date(p[2] + '-' + p[1] + '-' + p[0] + 'T12:00:00');
                }
                return parsed && !isNaN(parsed.getTime()) && parsed >= limite;
            });
        }
        if (!tem) {
            faltaRelatorio = true;
            motivos.push('Sem relatório recente');
        }
    } catch (e) {}

    var cor = null; // null = sem indicador
    if (nivel >= 2) cor = 'vermelho';
    else if (nivel >= 1) cor = 'laranja';
    if (faltaRelatorio && !cor) cor = 'azul';
    else if (faltaRelatorio && cor === 'laranja') { /* mantém laranja + motivo relatório */ }
    else if (faltaRelatorio && cor === 'vermelho') { /* mantém */ }

    return { cor: cor, motivos: motivos, faltaRelatorio: faltaRelatorio, nivel: nivel };
}

function statusPendenciasMinisterio(nomeMinisterio) {
    var nome = String(nomeMinisterio || '').trim();
    if (!nome) return { cor: null, motivos: [] };
    var lista = (typeof membrosReais === 'function') ? membrosReais() : ((typeof lerMembros === 'function') ? lerMembros() : []);
    lista = (lista || []).filter(function (m) {
        if (typeof isContaSistema === 'function' && isContaSistema(m)) return false;
        var st = (m.status || 'aprovado').toLowerCase();
        return st !== 'rejeitado' && st !== 'recusado' && st !== 'excluido';
    });
    function noMin(m) {
        return participaDesteMinisterio(m, nome);
    }
    function ehLiderMin(m) {
        return lideraEsteMinisterio(m, nome);
    }
    var lideres = lista.filter(ehLiderMin);
    var membrosMin = lista.filter(noMin);
    var motivos = [];
    var nivel = 0;
    if (!lideres.length) {
        nivel = 2;
        if (membrosMin.length) {
            motivos.push('Sem líder cadastrado (há ' + membrosMin.length + ' integrante(s) — marque em "Ministérios que lidera")');
        } else {
            motivos.push('Vermelho: sem membro cadastrado como líder deste ministério');
        }
    } else if (lideres.some(_membroPendente)) {
        nivel = Math.max(nivel, 1);
        motivos.push('Líder aguardando aprovação');
    }
    var pend = membrosMin.filter(_membroPendente);
    if (pend.length) {
        nivel = Math.max(nivel, 1);
        motivos.push(pend.length + ' membro(s) pendente(s)');
    }
    var cor = null;
    if (nivel >= 2) cor = 'vermelho';
    else if (nivel >= 1) cor = 'laranja';
    return { cor: cor, motivos: motivos, nivel: nivel, lideres: lideres.map(function(x){ return x.nome; }), qtdMembros: membrosMin.length };
}


/** Resumo para painel admin/gestor — indicadores gerais */
function resumoPendenciasGestao() {
    var celulas = [];
    var ministerios = [];
    var nVermelho = 0, nLaranja = 0, nAzul = 0;
    if (typeof LISTA_CELULAS !== 'undefined') {
        LISTA_CELULAS.forEach(function (c) {
            var st = statusPendenciasCelula(c.id);
            if (!st || !st.cor) return;
            celulas.push({ id: c.id, nome: c.nome, cor: st.cor, motivos: st.motivos || [] });
            if (st.cor === 'vermelho') nVermelho++;
            else if (st.cor === 'laranja') nLaranja++;
            else if (st.cor === 'azul') nAzul++;
        });
    }
    if (typeof LISTA_MINISTERIOS !== 'undefined') {
        LISTA_MINISTERIOS.forEach(function (nome) {
            var st = statusPendenciasMinisterio(nome);
            if (!st || !st.cor) return;
            ministerios.push({ nome: nome, cor: st.cor, motivos: st.motivos || [] });
            if (st.cor === 'vermelho') nVermelho++;
            else if (st.cor === 'laranja') nLaranja++;
        });
    }
    // Membros com status pendente (aprovação)
    var membrosPend = [];
    try {
        var lista = (typeof lerMembros === 'function') ? lerMembros() : [];
        membrosPend = lista.filter(function (m) {
            return m && (m.status === 'pendente' || m.status === 'aguardando');
        });
        if (membrosPend.length) nLaranja += membrosPend.length > 0 ? 1 : 0;
    } catch (e) {}
    var modelosPend = [];
    try {
        if (typeof listarModelosPendentes === 'function') {
            modelosPend = listarModelosPendentes() || [];
        }
    } catch (e) {}
    var nMod = modelosPend.length;
    if (nMod) nAzul += nMod; // modelos de escala = azul (aprovar formulário)
    return {
        celulas: celulas,
        ministerios: ministerios,
        membrosPendentes: membrosPend.length,
        modelosPendentes: modelosPend,
        nVermelho: nVermelho,
        nLaranja: nLaranja,
        nAzul: nAzul,
        total: nVermelho + nLaranja + nAzul + (membrosPend.length ? 1 : 0)
    };
}


/** Pendências na competência de quem está logado (menu Gestão vermelho) */
function pendenciasDoUsuarioLogado(u) {
    u = u || (typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null);
    if (!u) return { total: 0, motivos: [], href: 'index.html' };
    var motivos = [];
    var total = 0;
    var ehGestao = false;
    try {
        if (typeof isAdmin === 'function' && isAdmin(u)) ehGestao = true;
        if (u.nivel === 'admin' || u.nivel === 'gestor') ehGestao = true;
    } catch (e) {}

    if (ehGestao && typeof resumoPendenciasGestao === 'function') {
        var r = resumoPendenciasGestao();
        total = r.total || 0;
        if (r.nVermelho) motivos.push(r.nVermelho + ' cargo(s) vago(s)');
        if (r.nLaranja) motivos.push(r.nLaranja + ' aprovação(ões)');
        if (r.nAzul) motivos.push(r.nAzul + ' relatório(s)/modelo(s)');
        if (r.membrosPendentes) motivos.push(r.membrosPendentes + ' membro(s) pendente(s)');
        if (r.modelosPendentes && r.modelosPendentes.length) {
            motivos.push(r.modelosPendentes.length + ' formulário(s) de escala');
        }
        return {
            total: total,
            motivos: motivos,
            href: 'adminpainel.html',
            gestao: true,
            nVermelho: r.nVermelho || 0,
            nLaranja: r.nLaranja || 0,
            nAzul: r.nAzul || 0
        };
    }

    // Líder de célula: pendências das células que lidera
    var celulasLider = [];
    if (typeof LISTA_CELULAS !== 'undefined' && typeof isLiderCelula === 'function') {
        LISTA_CELULAS.forEach(function (c) {
            if (isLiderCelula(u, c.id) || (u.lideraCelulaId && String(u.lideraCelulaId) === String(c.id))) {
                celulasLider.push(c);
            }
        });
    }
    celulasLider.forEach(function (c) {
        if (typeof statusPendenciasCelula !== 'function') return;
        var st = statusPendenciasCelula(c.id);
        if (st && st.cor) {
            total++;
            motivos.push((c.nome || c.id) + ': ' + (st.motivos || []).join(', '));
        }
    });

    // Líder de ministério
    var mins = [];
    if (u.lideraMinisterio) mins.push(String(u.lideraMinisterio));
    if (Array.isArray(u.ministerios) && u.cargo && /l[ií]der/i.test(String(u.cargo))) {
        u.ministerios.forEach(function (m) { if (mins.indexOf(String(m)) < 0) mins.push(String(m)); });
    }
    mins.forEach(function (nome) {
        if (typeof statusPendenciasMinisterio !== 'function') return;
        if (typeof isLiderDoMinisterio === 'function' && !isLiderDoMinisterio(u, nome) && !ehGestao) {
            // se só está na lista de lideraMinisterio ok
            if (!u.lideraMinisterio || String(u.lideraMinisterio).toLowerCase().indexOf(String(nome).toLowerCase()) < 0) return;
        }
        var st = statusPendenciasMinisterio(nome);
        if (st && st.cor) {
            total++;
            motivos.push('Ministério ' + nome + ': ' + (st.motivos || []).join(', '));
        }
    });

    var href = 'index.html';
    if (celulasLider.length) href = 'celulas.html';
    else if (mins.length) href = 'ministerios.html';

    return {
        total: total,
        motivos: motivos,
        href: href,
        gestao: false,
        temAutoridade: celulasLider.length > 0 || mins.length > 0
    };
}

function htmlBolinhaStatus(st) {
    if (!st || !st.cor) return '';
    var corCls = st.cor === 'vermelho' ? 'bg-red-500' : (st.cor === 'azul' ? 'bg-blue-500' : 'bg-amber-500');
    var titulo = (st.motivos || []).join(' · ') || st.cor;
    return '<span class="inline-block w-3 h-3 rounded-full ' + corCls + ' flex-shrink-0" title="' + String(titulo).replace(/"/g, '&quot;') + '"></span>';
}

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
    var eraEdicao = idx >= 0;
    salvarRelatoriosCelula(lista);
    // Cópia na nuvem (se configurada) + log na movimentação do gestor
    try {
        if (typeof IBNNuvem !== 'undefined') {
            if (IBNNuvem.sincronizarRelatorio) IBNNuvem.sincronizarRelatorio(rel);
            if (IBNNuvem.registrarAtividade) {
                var nomeCel = rel.celulaId;
                try {
                    if (typeof LISTA_CELULAS !== 'undefined') {
                        var c = LISTA_CELULAS.find(function (x) { return x.id === rel.celulaId; });
                        if (c && c.nome) nomeCel = c.nome;
                    }
                } catch (e2) {}
                var acao = eraEdicao ? 'Editou relatório' : 'Registrou relatório';
                var det = acao + ' da célula ' + nomeCel +
                    ' em ' + rel.data +
                    ' · ' + (rel.qtdPresentes || 0) + ' presentes' +
                    ' · PIX R$ ' + (Number(rel.ofertaPix) || 0).toFixed(2).replace('.', ',') +
                    ' · Espécie R$ ' + (Number(rel.ofertaEspecie) || 0).toFixed(2).replace('.', ',') +
                    ' · Total R$ ' + (Number(rel.totalOfertas) || 0).toFixed(2).replace('.', ',');
                if (rel.observacoes) det += ' · Obs: ' + String(rel.observacoes).slice(0, 80);
                IBNNuvem.registrarAtividade(
                    eraEdicao ? 'relatorio_celula_editar' : 'relatorio_celula',
                    det,
                    u
                );
            }
        }
    } catch (e) { console.warn('log relatório célula', e); }
    return { sucesso: true, relatorio: rel };
}

function relatoriosDaCelula(celulaId) {
    return lerRelatoriosCelula()
        .filter(r => r.celulaId === celulaId)
        .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}


/** CSV no padrão Excel Brasil: ; como separador, UTF-8 com BOM, colunas fixas */
function csvEscapar(v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    s = s.replace(/\r?\n/g, ' ').replace(/"/g, '""');
    return '"' + s + '"';
}
function montarCSV(cabecalhos, linhas) {
    var sep = ';';
    var head = cabecalhos.map(csvEscapar).join(sep);
    var body = (linhas || []).map(function(row) {
        return row.map(csvEscapar).join(sep);
    }).join('\n');
    return '\uFEFF' + head + '\n' + body;
}
function dataArquivoBR(d) {
    var dt = d ? new Date(d) : new Date();
    if (isNaN(dt.getTime())) dt = new Date();
    var dd = String(dt.getDate()).padStart(2, '0');
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    var aa = dt.getFullYear();
    return dd + '-' + mm + '-' + aa;
}
function formatarDataCSV(d) {
    if (!d) return '';
    d = String(d).trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(d)) return d.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) {
        var p = d.slice(0, 10).split('-');
        return p[2] + '/' + p[1] + '/' + p[0];
    }
    return d;
}
function exportarMembrosCSVDefinido(lista) {
    lista = lista || (typeof lerMembros === 'function' ? lerMembros() : []);
    var cols = [
        'Nome', 'Email', 'Telefone', 'Batizado', 'Funções', 'Data de Cadastro',
        'Nascimento', 'Sexo', 'Estado Civil', 'Endereço', 'Município', 'UF',
        'Células', 'Ministérios', 'Status', 'Nível'
    ];
    var linhas = lista.map(function(m) {
        var funcoes = [];
        if (m.cargo) funcoes.push(m.cargo);
        if (Array.isArray(m.funcoesAprovadas)) {
            m.funcoesAprovadas.forEach(function(f) { if (funcoes.indexOf(f) === -1) funcoes.push(f); });
        }
        if (Array.isArray(m.funcoes)) {
            m.funcoes.forEach(function(f) {
                var map = { lider_celula: 'Líder de Célula', lider_ministerio: 'Líder de Ministério', lider_treino: 'Líder em treinamento', anfitriao: 'Anfitrião', admin: 'Administrador', gestor: 'Gestor' };
                var lab = map[f] || f;
                if (funcoes.indexOf(lab) === -1) funcoes.push(lab);
            });
        }
        if (!funcoes.length) funcoes.push('Membro');
        var celulas = Array.isArray(m.celulas) ? m.celulas.map(function(c) { return c.nome || c.id || c; }).join(' | ') : '';
        var mins = Array.isArray(m.ministerios) ? m.ministerios.join(' | ') : (m.ministerios || '');
        var bat = (m.batizado === true || m.batizado === 'sim' || m.batismo === 'sim') ? 'Sim' : (m.batizado === false || m.batizado === 'nao' || m.batismo === 'nao' ? 'Não' : (m.batizado || ''));
        return [
            m.nome || '',
            m.email || '',
            m.telefone || '',
            bat,
            funcoes.join(', '),
            formatarDataCSV(m.dataCadastro || m.criadoEm || m.dataInscricao || ''),
            formatarDataCSV(m.nascimento || ''),
            m.sexo || '',
            m.estadoCivil || '',
            m.endereco || '',
            m.municipio || '',
            m.uf || '',
            celulas,
            mins,
            m.status || '',
            m.nivel || ''
        ];
    });
    return montarCSV(cols, linhas);
}
function exportarVisitantesCSVDefinido(lista) {
    lista = lista || [];
    try {
        if (!lista.length) {
            var v = JSON.parse(localStorage.getItem('ibn_visitantes') || '[]');
            if (Array.isArray(v)) lista = v;
        }
    } catch (e) {}
    var cols = [
        'NomeCompleto', 'DataNascimento', 'Idade', 'DataVisita', 'Telefone', 'EstadoCivil',
        'Endereco', 'Bairro', 'Cidade', 'AceitouJesus', 'Batizado', 'DataBatismo',
        'Observacoes', 'Celula', 'AtividadeNaCelula'
    ];
    var linhas = lista.map(function(v) {
        return [
            v.nome || v.NomeCompleto || '',
            formatarDataCSV(v.nascimento || v.DataNascimento || ''),
            v.idade || v.Idade || '',
            formatarDataCSV(v.dataVisita || v.DataVisita || v.criadoEm || ''),
            v.telefone || v.Telefone || '',
            v.estadoCivil || v.EstadoCivil || '',
            v.endereco || v.Endereco || '',
            v.bairro || v.Bairro || '',
            v.municipio || v.cidade || v.Cidade || '',
            v.aceitouJesus || v.AceitouJesus || '',
            (v.batizado === true || v.batizado === 'sim') ? 'Sim' : (v.batizado === false || v.batizado === 'nao' ? 'Não' : (v.batizado || v.Batizado || '')),
            formatarDataCSV(v.dataBatismo || v.DataBatismo || ''),
            v.observacoes || v.Observacoes || '',
            v.celula || v.Celula || '',
            v.atividade || v.AtividadeNaCelula || ''
        ];
    });
    return montarCSV(cols, linhas);
}


// ========== ANIVERSARIANTES (somente membros) ==========
function _mdNascimento(m) {
    var iso = normalizarDataParaISO(m.nascimento || m.dataNascimento || '');
    if (!iso || iso.length < 10) return null;
    return { mes: parseInt(iso.slice(5, 7), 10), dia: parseInt(iso.slice(8, 10), 10), iso: iso };
}
function _idadeAniversario(isoNasc, refDate) {
    if (!isoNasc) return null;
    var n = new Date(isoNasc.slice(0, 10) + 'T12:00:00');
    if (isNaN(n.getTime())) return null;
    var r = refDate || new Date();
    var idade = r.getFullYear() - n.getFullYear();
    var m = r.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && r.getDate() < n.getDate())) idade--;
    return idade;
}
function listarAniversariantesNaData(refDate) {
    refDate = refDate || new Date();
    var mes = refDate.getMonth() + 1;
    var dia = refDate.getDate();
    var lista = (typeof lerMembros === 'function' ? lerMembros() : []).filter(function (m) {
        if (!m || m.status === 'rejeitado' || m.status === 'excluido') return false;
        if (m.tipo === 'visitante' || m.status === 'visitante') return false;
        var md = _mdNascimento(m);
        return md && md.mes === mes && md.dia === dia;
    });
    return lista.map(function (m) {
        var md = _mdNascimento(m);
        return {
            id: m.id,
            nome: m.nome || '',
            telefone: m.telefone || '',
            email: m.email || '',
            nascimento: md ? md.iso : '',
            idade: _idadeAniversario(md ? md.iso : null, refDate)
        };
    }).sort(function (a, b) { return String(a.nome).localeCompare(String(b.nome), 'pt-BR'); });
}
function listarAniversariantesHoje() {
    return listarAniversariantesNaData(new Date());
}
/** Próximos N dias (inclui hoje se houver). Retorna [{ dataIso, dataBR, aniversariantes: [] }] */
function listarProximosAniversariantes(dias) {
    dias = dias || 8;
    var out = [];
    var base = new Date();
    base.setHours(12, 0, 0, 0);
    for (var i = 0; i <= dias; i++) {
        var d = new Date(base.getTime());
        d.setDate(base.getDate() + i);
        var lista = listarAniversariantesNaData(d);
        if (!lista.length) continue;
        var iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var br = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
        out.push({ dataIso: iso, dataBR: br, diasAte: i, aniversariantes: lista });
    }
    return out;
}
function ehAniversarioHojeMembro(m) {
    if (!m) return false;
    var md = _mdNascimento(m);
    if (!md) return false;
    var hoje = new Date();
    return md.mes === (hoje.getMonth() + 1) && md.dia === hoje.getDate();
}
function mensagemAniversarioPadrao(nomeAniv, nomeRemetente) {
    var n = (nomeAniv || 'irmão(ã)').split(' ')[0];
    var de = (nomeRemetente || '').split(' ')[0];
    return '🎂 Feliz aniversário, ' + n + '!\n\nQue Deus continue abençoando sua vida com muita paz, saúde e alegria. A família IBN Diamantino celebra este dia com você!\n\nCom carinho' + (de ? ', ' + de : '') + ' 🙏';
}
function linkWhatsAppAniversario(telefone, texto) {
    var dig = String(telefone || '').replace(/\D/g, '');
    if (!dig) return null;
    if (dig.length <= 11) dig = '55' + dig;
    return 'https://wa.me/' + dig + '?text=' + encodeURIComponent(texto || '');
}
function registrarMensagemAniversarioLocal(deId, deNome, paraId, paraNome, texto) {
    try {
        var key = 'ibn_msgs_aniversario';
        var arr = JSON.parse(localStorage.getItem(key) || '[]');
        arr.push({
            id: 'msg-' + Date.now(),
            deId: deId, deNome: deNome,
            paraId: paraId, paraNome: paraNome,
            texto: texto,
            em: new Date().toISOString()
        });
        if (arr.length > 200) arr = arr.slice(-200);
        localStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {}
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

    const cols = ['Data', 'Célula', 'Qtd presentes', 'Oferta PIX', 'Oferta espécie', 'Total ofertas', 'Observações', 'Registrado por'];
    const linhas = lista.map(r => {
        const cel = (typeof LISTA_CELULAS !== 'undefined') ? LISTA_CELULAS.find(c => c.id === r.celulaId) : null;
        const nomeCel = cel ? cel.nome : r.celulaId;
        return [
            formatarDataCSV(r.data || ''),
            nomeCel || '',
            r.qtdPresentes || 0,
            (Number(r.ofertaPix || 0)).toFixed(2).replace('.', ','),
            (Number(r.ofertaEspecie || 0)).toFixed(2).replace('.', ','),
            (Number(r.totalOfertas || 0)).toFixed(2).replace('.', ','),
            r.observacoes || '',
            r.autorNome || ''
        ];
    });
    const csv = montarCSV(cols, linhas);
    const dataArq = dataArquivoBR();
    const nomeArquivo = celulaIdFiltro
        ? ('relatorio-celula-' + celulaIdFiltro + '_' + dataArq + '.csv')
        : ('relatorios-celulas-geral_' + dataArq + '.csv');
    return { sucesso: true, csv: csv, nomeArquivo: nomeArquivo };
}

function baixarCSV(conteudo, nomeArquivo) {
    // Garante BOM se ainda não tiver
    if (conteudo && conteudo.charCodeAt(0) !== 0xFEFF) conteudo = '﻿' + conteudo;
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

