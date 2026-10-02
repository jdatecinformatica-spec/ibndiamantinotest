// ==============================================
// SINCRONIZAÇÃO COM A NUVEM — IBN Diamantino
// Não substitui o funcionamento local: grava no
// aparelho E, se a nuvem estiver configurada,
// envia cópia para o Firebase (admin/gestor baixa CSV).
// ==============================================

const IBNNuvem = (function () {
    let db = null;
    let pronto = false;
    let ultimoErro = null;

    function configValida() {
        if (typeof FIREBASE_CONFIG === 'undefined' || typeof NUVEM_ATIVA === 'undefined') return false;
        if (!NUVEM_ATIVA) return false;
        const c = FIREBASE_CONFIG;
        if (!c || !c.apiKey || !c.projectId) return false;
        if (String(c.apiKey).indexOf('COLE_AQUI') !== -1) return false;
        if (String(c.projectId).indexOf('COLE_AQUI') !== -1) return false;
        return true;
    }

    function iniciar() {
        if (pronto) return true;
        if (!configValida()) {
            ultimoErro = 'Nuvem não configurada (firebase-config.js). Site segue só no aparelho.';
            return false;
        }
        if (typeof firebase === 'undefined') {
            ultimoErro = 'Biblioteca Firebase não carregou.';
            return false;
        }
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            db = firebase.firestore();
            pronto = true;
            ultimoErro = null;
            return true;
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            pronto = false;
            return false;
        }
    }

    function status() {
        return {
            configurada: configValida(),
            conectada: pronto,
            erro: ultimoErro
        };
    }

    // Remove senha e resposta de segurança antes de subir
    function membroPublico(m) {
        if (!m) return null;
        const copia = Object.assign({}, m);
        delete copia.senha;
        delete copia.respostaSeguranca;
        return copia;
    }

    async function sincronizarMembros(lista) {
        if (!iniciar() || !db) return { sucesso: false, mensagem: ultimoErro };
        try {
            const batch = db.batch();
            const col = db.collection('membros');
            (lista || []).forEach(function (m) {
                if (!m || m.id === undefined || m.id === null) return;
                const ref = col.doc(String(m.id));
                batch.set(ref, membroPublico(m), { merge: true });
            });
            await batch.commit();
            return { sucesso: true };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            console.warn('IBNNuvem.sincronizarMembros:', ultimoErro);
            return { sucesso: false, mensagem: ultimoErro };
        }
    }

    async function sincronizarUmMembro(m) {
        if (!iniciar() || !db || !m) return { sucesso: false };
        try {
            await db.collection('membros').doc(String(m.id)).set(membroPublico(m), { merge: true });
            return { sucesso: true };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, mensagem: ultimoErro };
        }
    }


    async function puxarMembrosParaLocal() {
        const r = await buscarMembros();
        if (!r.sucesso) return r;
        try {
            const local = (typeof lerMembros === 'function') ? lerMembros() : [];
            const porId = {};
            local.forEach(function (m) { if (m && m.id !== undefined) porId[String(m.id)] = m; });
            (r.lista || []).forEach(function (m) {
                const id = String(m.id);
                if (!porId[id]) porId[id] = m;
                else porId[id] = Object.assign({}, porId[id], m);
            });
            let mesclada = Object.keys(porId).map(function (k) { return porId[k]; });
            // Grava e deduplica por nome+nascimento
            localStorage.setItem('ibn_membros', JSON.stringify(mesclada));
            if (typeof deduplicarMembrosLocais === 'function') {
                mesclada = deduplicarMembrosLocais();
            }
            return { sucesso: true, lista: mesclada };
        } catch (e) {
            return { sucesso: false, mensagem: String(e) };
        }
    }

    async function buscarMembros() {
        if (!iniciar() || !db) return { sucesso: false, lista: [], mensagem: ultimoErro };
        try {
            const snap = await db.collection('membros').get();
            const lista = [];
            snap.forEach(function (doc) {
                lista.push(Object.assign({ id: doc.id }, doc.data()));
            });
            lista.sort(function (a, b) {
                return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
            });
            return { sucesso: true, lista: lista };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, lista: [], mensagem: ultimoErro };
        }
    }

    async function sincronizarRelatorio(rel) {
        if (!iniciar() || !db || !rel) return { sucesso: false };
        try {
            const id = rel.id || ('rel-' + Date.now());
            await db.collection('relatorios_celula').doc(String(id)).set(
                Object.assign({}, rel, { id: id }),
                { merge: true }
            );
            return { sucesso: true };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, mensagem: ultimoErro };
        }
    }

    async function buscarRelatorios(celulaId) {
        if (!iniciar() || !db) return { sucesso: false, lista: [], mensagem: ultimoErro };
        try {
            let snap;
            if (celulaId) {
                snap = await db.collection('relatorios_celula').where('celulaId', '==', celulaId).get();
            } else {
                snap = await db.collection('relatorios_celula').get();
            }
            const lista = [];
            snap.forEach(function (doc) {
                lista.push(Object.assign({ id: doc.id }, doc.data()));
            });
            lista.sort(function (a, b) {
                return String(b.data || '').localeCompare(String(a.data || ''));
            });
            return { sucesso: true, lista: lista };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, lista: [], mensagem: ultimoErro };
        }
    }

    /** CSV de membros — mesmo formato do painel admin */
    function csvMembros(lista) {
        const sep = ';';
        const header = [
            'Nome', 'Telefone', 'E-mail', 'Sexo', 'Nascimento', 'Estado Civil',
            'Endereço', 'Município', 'UF', 'Origem', 'Batizado', 'Data Batismo',
            'Cargo', 'Função específica', 'Lidera célula', 'Lidera ministério',
            'Nível', 'Status', 'Células', 'Ministérios', 'Observações', 'Data Cadastro'
        ].join(sep);
        const linhas = (lista || []).map(function (m) {
            const celulas = Array.isArray(m.celulas)
                ? m.celulas.map(function (c) { return c.nome || c.id || c; }).join(' | ')
                : '';
            const ministerios = Array.isArray(m.ministerios) ? m.ministerios.join(' | ') : (m.ministerios || '');
            const bat = (m.batizado === true || m.batizado === 'sim' || m.batizado === 'Sim') ? 'Sim'
                : (m.batizado === false || m.batizado === 'nao' || m.batizado === 'Não') ? 'Não'
                : (m.batizado || '');
            function q(v) {
                return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
            }
            var nomeCelLider = m.lideraCelulaId || '';
            if (m.lideraCelulaId && typeof LISTA_CELULAS !== 'undefined') {
                var celL = LISTA_CELULAS.find(function(c){ return c.id === m.lideraCelulaId; });
                if (celL) nomeCelLider = celL.nome;
            }
            return [
                q(m.nome), q(m.telefone), q(m.email), q(m.sexo), q(m.nascimento),
                q(m.estadoCivil), q(m.endereco), q(m.municipio), q(m.uf), q(m.origem),
                q(bat), q(m.dataBatismo),
                q(m.cargo), q(m.funcaoEspecifica), q(nomeCelLider), q(m.lideraMinisterio),
                q(m.nivel), q(m.status), q(celulas), q(ministerios),
                q(m.observacoes), q(m.dataCadastro)
            ].join(sep);
        });
        return '\uFEFF' + header + '\n' + linhas.join('\n');
    }

    /** CSV de relatórios de célula — mesmo formato de exportarRelatoriosCSV */
    function csvRelatorios(lista, listaCelulas) {
        const sep = ';';
        const header = ['Data', 'Célula', 'Qtd presentes', 'Oferta PIX', 'Oferta espécie', 'Total ofertas', 'Observações', 'Registrado por'].join(sep);
        const linhas = (lista || []).map(function (r) {
            let nomeCel = r.celulaId || '';
            if (listaCelulas && listaCelulas.length) {
                const cel = listaCelulas.find(function (c) { return c.id === r.celulaId; });
                if (cel) nomeCel = cel.nome;
            }
            function q(v) {
                return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
            }
            function money(n) {
                return (parseFloat(n) || 0).toFixed(2).replace('.', ',');
            }
            return [
                r.data || '',
                q(nomeCel),
                r.qtdPresentes || 0,
                money(r.ofertaPix),
                money(r.ofertaEspecie),
                money(r.totalOfertas),
                q(r.observacoes),
                q(r.autorNome)
            ].join(sep);
        });
        return '\uFEFF' + header + '\n' + linhas.join('\n');
    }

    function baixarArquivo(conteudo, nomeArquivo) {
        const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo || 'export.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function exportarMembrosCSV() {
        const r = await buscarMembros();
        if (!r.sucesso) return r;
        if (!r.lista.length) return { sucesso: false, mensagem: 'Nenhum membro na nuvem ainda.' };
        baixarArquivo(csvMembros(r.lista), 'membros-ibn-nuvem.csv');
        return { sucesso: true, quantidade: r.lista.length };
    }

    async function exportarRelatoriosCSV(celulaId) {
        const r = await buscarRelatorios(celulaId || null);
        if (!r.sucesso) return r;
        if (!r.lista.length) return { sucesso: false, mensagem: 'Nenhum relatório na nuvem ainda.' };
        const celulas = (typeof LISTA_CELULAS !== 'undefined') ? LISTA_CELULAS : [];
        const nome = celulaId ? ('relatorios-celula-' + celulaId + '-nuvem.csv') : 'relatorios-celulas-geral-nuvem.csv';
        baixarArquivo(csvRelatorios(r.lista, celulas), nome);
        return { sucesso: true, quantidade: r.lista.length };
    }

    // ---------- FOTOS (ministérios) ----------
    async function salvarFotoNuvem(foto) {
        if (!iniciar() || !db || !foto) return { sucesso: false, mensagem: ultimoErro };
        try {
            const id = String(foto.id || ('foto-' + Date.now()));
            let imagemUrl = foto.imagemUrl || foto.url || '';
            const imagem = foto.imagem || '';
            // Sobe imagem grande para Storage (evita limite do Firestore)
            if (imagem && String(imagem).indexOf('data:') === 0 && typeof firebase.storage === 'function') {
                try {
                    const ref = firebase.storage().ref('fotos/' + id);
                    await ref.putString(imagem, 'data_url');
                    imagemUrl = await ref.getDownloadURL();
                } catch (e) {
                    console.warn('Storage foto:', e);
                    // se Storage não estiver ativo, tenta gravar só metadados
                }
            }
            // Sem Storage (plano grátis): grava a foto comprimida direto no Firestore
            let imagemFinal = '';
            if (imagemUrl) {
                imagemFinal = '';
            } else if (imagem && String(imagem).length < 950000) {
                imagemFinal = imagem;
            } else if (imagem) {
                throw new Error('Foto ainda grande demais após compressão. Tente outra.');
            }
            const doc = {
                id: id,
                titulo: foto.titulo || '',
                ministerio: foto.ministerio || '',
                autor: foto.autor || '',
                autorId: foto.autorId || '',
                dataFormatada: foto.dataFormatada || '',
                mesAno: foto.mesAno || '',
                imagemUrl: imagemUrl || (imagem && String(imagem).indexOf('http') === 0 ? imagem : ''),
                imagem: imagemFinal || (imagemUrl ? '' : ''),
                criadoEm: foto.criadoEm || foto.dataEnvio || new Date().toISOString()
            };
            if (!doc.imagem && !doc.imagemUrl && imagem && String(imagem).indexOf('http') === 0) {
                doc.imagemUrl = imagem;
            }
            if (!doc.imagem && !doc.imagemUrl && imagemFinal) doc.imagem = imagemFinal;
            if (!doc.imagem && !doc.imagemUrl && imagem && String(imagem).length < 950000) {
                doc.imagem = imagem;
            }
            await db.collection('fotos').doc(id).set(doc, { merge: true });
            return { sucesso: true, foto: doc };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, mensagem: ultimoErro };
        }
    }

    async function buscarFotos() {
        if (!iniciar() || !db) return { sucesso: false, lista: [], mensagem: ultimoErro };
        try {
            const snap = await db.collection('fotos').get();
            const lista = [];
            snap.forEach(function (doc) {
                const d = doc.data();
                // normaliza campo imagem para a galeria local
                d.imagem = d.imagemUrl || d.imagem || d.url || '';
                lista.push(d);
            });
            lista.sort(function (a, b) {
                return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
            });
            return { sucesso: true, lista: lista };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, lista: [], mensagem: ultimoErro };
        }
    }

    // ---------- FOTOS DE CÉLULA ----------
    async function salvarFotoCelulaNuvem(foto) {
        if (!iniciar() || !db || !foto) return { sucesso: false };
        try {
            const id = String(foto.id || ('fc-' + Date.now()));
            let url = foto.url || foto.imagemUrl || '';
            if (foto.imagem && String(foto.imagem).indexOf('data:') === 0 && typeof firebase.storage === 'function') {
                try {
                    const ref = firebase.storage().ref('fotos-celulas/' + id);
                    await ref.putString(foto.imagem, 'data_url');
                    url = await ref.getDownloadURL();
                } catch (e) { console.warn(e); }
            }
            // Sem Storage: grava base64 comprimido no Firestore (plano grátis)
            let imagemB64 = '';
            if (!url && foto.imagem && String(foto.imagem).indexOf('data:') === 0 && String(foto.imagem).length < 950000) {
                imagemB64 = foto.imagem;
            }
            if (!url && foto.url && String(foto.url).indexOf('data:') === 0 && String(foto.url).length < 950000) {
                imagemB64 = foto.url;
                url = '';
            }
            const doc = {
                id: id,
                celulaId: foto.celulaId || '',
                titulo: foto.titulo || '',
                autorNome: foto.autorNome || foto.autor || '',
                autorId: foto.autorId || '',
                data: foto.data || foto.criadoEm || new Date().toISOString(),
                url: url || (imagemB64 ? '' : (foto.url || '')),
                imagemUrl: url || '',
                imagem: imagemB64 || ''
            };
            await db.collection('fotos_celulas').doc(id).set(doc, { merge: true });
            return { sucesso: true, foto: doc };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, mensagem: ultimoErro };
        }
    }

    async function buscarFotosCelulas() {
        if (!iniciar() || !db) return { sucesso: false, lista: [], mensagem: ultimoErro };
        try {
            const snap = await db.collection('fotos_celulas').get();
            const lista = [];
            snap.forEach(function (doc) {
                const d = Object.assign({ id: doc.id }, doc.data());
                d.url = d.url || d.imagemUrl || d.imagem || '';
                d.imagem = d.imagem || d.url || d.imagemUrl || '';
                lista.push(d);
            });
            lista.sort(function (a, b) {
                return String(b.data || '').localeCompare(String(a.data || ''));
            });
            return { sucesso: true, lista: lista };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, lista: [], mensagem: ultimoErro };
        }
    }

    // ---------- LOG DE ATIVIDADES (gestão) ----------
    async function registrarAtividade(tipo, detalhe, usuario) {
        if (!iniciar() || !db) return { sucesso: false };
        try {
            const u = usuario || (typeof getUsuarioLogado === 'function' ? getUsuarioLogado() : null) || {};
            const id = 'act-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
            const doc = {
                id: id,
                tipo: tipo || 'outro',
                detalhe: detalhe || '',
                usuarioId: u.id || '',
                usuarioNome: u.nome || '',
                quando: new Date().toISOString()
            };
            await db.collection('atividades').doc(id).set(doc);
            return { sucesso: true };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, mensagem: ultimoErro };
        }
    }

    async function buscarAtividades(limite) {
        if (!iniciar() || !db) return { sucesso: false, lista: [], mensagem: ultimoErro };
        try {
            const snap = await db.collection('atividades').get();
            const lista = [];
            snap.forEach(function (doc) { lista.push(doc.data()); });
            lista.sort(function (a, b) {
                return String(b.quando || '').localeCompare(String(a.quando || ''));
            });
            const n = limite || 200;
            return { sucesso: true, lista: lista.slice(0, n) };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, lista: [], mensagem: ultimoErro };
        }
    }

    /** Mescla lista da nuvem no localStorage (fotos ministérios) */
    async function puxarFotosParaLocal() {
        const r = await buscarFotos();
        if (!r.sucesso) return r;
        try {
            const local = JSON.parse(localStorage.getItem('ibn_fotos') || '[]');
            const porId = {};
            local.forEach(function (f) { if (f && f.id) porId[String(f.id)] = f; });
            r.lista.forEach(function (f) {
                const id = String(f.id);
                if (!porId[id]) {
                    porId[id] = f;
                } else {
                    porId[id] = Object.assign({}, porId[id], f);
                    if (f.imagem) porId[id].imagem = f.imagem;
                    if (f.imagemUrl) porId[id].imagemUrl = f.imagemUrl;
                }
            });
            const mesclada = Object.keys(porId).map(function (k) { return porId[k]; });
            mesclada.sort(function (a, b) {
                return String(b.criadoEm || b.id || '').localeCompare(String(a.criadoEm || a.id || ''));
            });
            localStorage.setItem('ibn_fotos', JSON.stringify(mesclada));
            return { sucesso: true, lista: mesclada };
        } catch (e) {
            return { sucesso: false, mensagem: String(e) };
        }
    }

    async function puxarFotosCelulasParaLocal() {
        const r = await buscarFotosCelulas();
        if (!r.sucesso) return r;
        try {
            const local = JSON.parse(localStorage.getItem('ibn_fotos_celulas') || '[]');
            const porId = {};
            local.forEach(function (f) { if (f && f.id) porId[String(f.id)] = f; });
            r.lista.forEach(function (f) {
                porId[String(f.id)] = Object.assign({}, porId[String(f.id)] || {}, f);
            });
            const mesclada = Object.keys(porId).map(function (k) { return porId[k]; });
            localStorage.setItem('ibn_fotos_celulas', JSON.stringify(mesclada));
            return { sucesso: true, lista: mesclada };
        } catch (e) {
            return { sucesso: false, mensagem: String(e) };
        }
    }

    /** Envia para a nuvem tudo que está no localStorage deste aparelho (uma vez) */
    async function enviarTudoDoAparelho() {
        if (!iniciar()) return { sucesso: false, mensagem: ultimoErro };
        const membros = (typeof lerMembros === 'function') ? lerMembros() : [];
        const rels = (typeof lerRelatoriosCelula === 'function') ? lerRelatoriosCelula() : [];
        const r1 = await sincronizarMembros(membros);
        let okRel = 0;
        for (let i = 0; i < rels.length; i++) {
            const rr = await sincronizarRelatorio(rels[i]);
            if (rr.sucesso) okRel++;
        }
        let okFoto = 0;
        try {
            const fotos = JSON.parse(localStorage.getItem('ibn_fotos') || '[]');
            for (let i = 0; i < fotos.length; i++) {
                const rf = await salvarFotoNuvem(fotos[i]);
                if (rf.sucesso) okFoto++;
            }
        } catch (e) {}
        let okFc = 0;
        try {
            const fcs = JSON.parse(localStorage.getItem('ibn_fotos_celulas') || '[]');
            for (let i = 0; i < fcs.length; i++) {
                const rf = await salvarFotoCelulaNuvem(fcs[i]);
                if (rf.sucesso) okFc++;
            }
        } catch (e) {}
        return {
            sucesso: r1.sucesso,
            mensagem: 'Membros: ' + membros.length + ' · Relatórios: ' + okRel + '/' + rels.length +
                ' · Fotos: ' + okFoto + ' · Fotos célula: ' + okFc,
            membros: membros.length,
            relatorios: okRel
        };
    }


    async function salvarPedidoOracao(item) {
        if (!iniciar() || !db || !item) return { sucesso: false, mensagem: ultimoErro };
        try {
            const id = String(item.id || ('oracao-' + Date.now()));
            await db.collection('pedidos_oracao').doc(id).set(Object.assign({}, item, { id: id }), { merge: true });
            return { sucesso: true };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, mensagem: ultimoErro };
        }
    }

    async function buscarPedidosOracao() {
        if (!iniciar() || !db) return { sucesso: false, lista: [], mensagem: ultimoErro };
        try {
            const snap = await db.collection('pedidos_oracao').get();
            const lista = [];
            snap.forEach(function (doc) { lista.push(doc.data()); });
            lista.sort(function (a, b) {
                return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
            });
            return { sucesso: true, lista: lista };
        } catch (e) {
            ultimoErro = (e && e.message) || String(e);
            return { sucesso: false, lista: [], mensagem: ultimoErro };
        }
    }

    async function puxarPedidosOracaoParaLocal() {
        const r = await buscarPedidosOracao();
        if (!r.sucesso) return r;
        try {
            const local = JSON.parse(localStorage.getItem('ibn_pedidos_oracao') || '[]');
            const porId = {};
            local.forEach(function (p) { if (p && p.id) porId[String(p.id)] = p; });
            r.lista.forEach(function (p) { porId[String(p.id)] = Object.assign({}, porId[String(p.id)] || {}, p); });
            const mesclada = Object.keys(porId).map(function (k) { return porId[k]; });
            mesclada.sort(function (a, b) {
                return String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''));
            });
            localStorage.setItem('ibn_pedidos_oracao', JSON.stringify(mesclada));
            return { sucesso: true, lista: mesclada };
        } catch (e) {
            return { sucesso: false, mensagem: String(e) };
        }
    }

    return {
        iniciar: iniciar,
        status: status,
        sincronizarMembros: sincronizarMembros,
        sincronizarUmMembro: sincronizarUmMembro,
        buscarMembros: buscarMembros,
        puxarMembrosParaLocal: puxarMembrosParaLocal,
        sincronizarRelatorio: sincronizarRelatorio,
        buscarRelatorios: buscarRelatorios,
        exportarMembrosCSV: exportarMembrosCSV,
        exportarRelatoriosCSV: exportarRelatoriosCSV,
        enviarTudoDoAparelho: enviarTudoDoAparelho,
        csvMembros: csvMembros,
        csvRelatorios: csvRelatorios,
        baixarArquivo: baixarArquivo,
        salvarFotoNuvem: salvarFotoNuvem,
        buscarFotos: buscarFotos,
        salvarFotoCelulaNuvem: salvarFotoCelulaNuvem,
        buscarFotosCelulas: buscarFotosCelulas,
        registrarAtividade: registrarAtividade,
        buscarAtividades: buscarAtividades,
        puxarFotosParaLocal: puxarFotosParaLocal,
        puxarFotosCelulasParaLocal: puxarFotosCelulasParaLocal,
        salvarPedidoOracao: salvarPedidoOracao,
        buscarPedidosOracao: buscarPedidosOracao,
        puxarPedidosOracaoParaLocal: puxarPedidosOracaoParaLocal
    };
})();
