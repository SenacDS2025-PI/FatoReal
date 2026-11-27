import { EventoAgenda, Patrimonio, agendaDaSemana, bensPorTipo, inicioDaSemana, patrimonioDe, tipoCurto } from '../../core/patrimonio-agenda';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerguntarFatobot } from '../../shared/fatobot-bolha';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AlertaJuridico, Politico, TipoAlerta } from '../../core/modelos';
import { AuthService } from '../../core/auth.service';
import { SeguidosService } from '../../core/seguidos.service';
import { AvisosService } from '../../core/avisos.service';
import { DetalhesPolitico, PoliticosService, adicionarAlerta, alertasDe, detalhesCamara, obterSenador, removerAlerta, rotaPolitico } from '../../core/politicos.service';
import { supabase } from '../../core/supabase';
import { linkSeguro, plural } from '../../core/util';
import { inicioLegislatura } from '../../core/politicos.service';
import {
  Carreira, Discurso, FichaSenador, GastosAno, Proposicao, ResumoVotacoes, TIPOS_PROPOSICAO,
  anoLegislatura, carreiraCamara, contagemProposicoes, discursosDe, fichaSenador, gastosDoAno, idade, proposicoesDe, totalDiscursos, votacoesDe, leisDoAutor,
} from '../../core/ficha-politico';
import { compartilharCartao } from '../../shared/cartao-compartilhar';
import { nomeEstado } from '../../shared/mapa-brasil';
import { Avatar, Campo, FonteDado, Icone } from '../../shared/componentes';
import { ProjetoAcoes } from '../../shared/projeto-acoes';
import { Favoritar } from '../../shared/favoritar';
import { PluralPipe } from '../../shared/plural';

type Aba = 'geral' | 'projetos' | 'votacoes' | 'gastos' | 'agenda' | 'patrimonio' | 'discursos' | 'carreira';

@Component({
  selector: 'app-perfil-politico',
  imports: [PluralPipe, RouterLink, FormsModule, DatePipe, CurrencyPipe, DecimalPipe, Avatar, Campo, FonteDado, Icone, ProjetoAcoes, PerguntarFatobot, Favoritar],
  templateUrl: './perfil-politico.html',
})
export class PerfilPoliticoPage implements OnInit {
  private service = inject(PoliticosService);
  private router = inject(Router);
  /** Vem da URL /politicos/:id */
  readonly id = input.required<string>();
  /** Vem dos dados da rota: 'senado' em /politicos/senado/:id. */
  readonly casa = input<'camara' | 'senado'>('camara');
  protected readonly alertas = signal<AlertaJuridico[]>([]);
  protected readonly carregandoAlertas = signal(true);
  /** Onde qualquer pessoa pode consultar processos e sanções oficialmente. */
  protected readonly consultas = [
    { nome: 'STF: consulta de processos', url: 'https://portal.stf.jus.br/' },
    { nome: 'CNJ: condenações por improbidade', url: 'https://www.cnj.jus.br/improbidade_adm/consultar_requerido.php' },
    { nome: 'TSE: candidaturas e certidões', url: 'https://divulgacandcontas.tse.jus.br/' },
    { nome: 'Portal da Transparência: sanções (CEIS/CNEP)', url: 'https://portaldatransparencia.gov.br/sancoes' },
  ];
  protected readonly gravidade: Record<TipoAlerta, 'alta' | 'media' | 'neutra'> = {
    'Condenação': 'alta', 'Inelegibilidade': 'alta', 'Cassação': 'alta',
    'Processo em andamento': 'media', 'Investigação': 'media', 'Sanção administrativa': 'media', 'Polêmica': 'media',
    'Absolvição ou arquivamento': 'neutra',
  };
  protected readonly tipos = Object.keys(this.gravidade) as TipoAlerta[];
  protected auth = inject(AuthService);
  protected seguidos = inject(SeguidosService);

  protected alternarSeguir(p: Politico) {
    const sigo = this.seguidos.alternar(p);
    this.avisos.mostrar(sigo ? `Você agora segue ${p.nome}. Agora aparece em "Políticos que você segue", na página inicial.` : `Você deixou de seguir ${p.nome}.`);
  }
  private avisos = inject(AvisosService);
  protected readonly gerandoCartao = signal(false);

  protected async compartilhar(p: Politico) {
    this.gerandoCartao.set(true);
    try {
      const reg = this.alertas().filter((a) => a.tipo !== 'Absolvição ou arquivamento').length;
      const r = await compartilharCartao({
        rotulo: p.cargo ?? (this.casa() === 'senado' ? 'Senador(a)' : 'Deputado(a) Federal'),
        titulo: p.nome,
        subtitulo: [p.partido, p.uf].filter(Boolean).join(' · '),
        linhas: [reg ? `!${plural(reg, 'registro', 'registros')} de polêmica ou na Justiça` : 'Nenhum registro na Justiça cadastrado', 'Veja o perfil completo no Fato Real'],
        foto: p.foto_url,
        fonte: this.casa() === 'senado' ? 'Senado Federal (dados abertos)' : 'Câmara dos Deputados (dados abertos)',
        nomeArquivo: `fatoreal-${p.nome.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`,
      });
      if (r === 'baixado') this.avisos.mostrar('Card baixado! Agora é só postar nas suas redes.');
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.gerandoCartao.set(false);
    }
  }

  // Formulário da moderação ("Adicionar registro")
  protected readonly adicionando = signal(false);
  protected readonly salvando = signal(false);
  protected novo = this.registroVazio();

  private registroVazio() {
    return { tipo: 'Polêmica' as TipoAlerta, titulo: '', descricao: '', orgao: '', data: '', fonte_url: '' };
  }

  protected fonteValida(): boolean {
    return /^https:\/\/[^\s]+\.[^\s]+/.test(this.novo.fonte_url.trim());
  }

  protected async salvarRegistro() {
    const p = this.politico();
    if (!p || !this.fonteValida()) return;
    this.salvando.set(true);
    try {
      await adicionarAlerta(p, {
        tipo: this.novo.tipo, titulo: this.novo.titulo.trim(), descricao: this.novo.descricao.trim(),
        orgao: this.novo.orgao.trim(), data: this.novo.data || null, fonte_url: this.novo.fonte_url.trim(),
      });
      this.alertas.set(await alertasDe(p));
      this.novo = this.registroVazio();
      this.adicionando.set(false);
      this.avisos.mostrar('Registro adicionado.');
    } catch (e) {
      this.avisos.erro(e);
    } finally {
      this.salvando.set(false);
    }
  }

  protected async remover(a: AlertaJuridico) {
    const p = this.politico();
    if (!p || !confirm(`Remover o registro "${a.titulo}"?`)) return;
    try {
      await removerAlerta(p, a.id);
      this.alertas.set(await alertasDe(p));
    } catch (e) {
      this.avisos.erro(e);
    }
  }

  // ---------------- Abas da ficha ----------------
  protected readonly aba = signal<Aba>('geral');
  protected readonly abas = computed<{ id: Aba; nome: string; icone: string }[]>(() => [
    { id: 'geral', nome: 'Visão geral', icone: 'badge' },
    { id: 'projetos', nome: 'Projetos', icone: 'description' },
    { id: 'votacoes', nome: 'Votações', icone: 'how_to_vote' },
    ...(this.casa() !== 'senado' ? [{ id: 'gastos' as Aba, nome: 'Gastos', icone: 'payments' }] : []),
    ...(this.casa() !== 'senado' ? [{ id: 'agenda' as Aba, nome: 'Agenda', icone: 'calendar_month' }] : []),
    { id: 'patrimonio', nome: 'Patrimônio', icone: 'savings' },
    { id: 'discursos', nome: 'Discursos', icone: 'record_voice_over' },
    { id: 'carreira', nome: 'Carreira', icone: 'timeline' },
  ]);
  protected readonly idade = idade;
  protected readonly anoLegislatura = anoLegislatura;
  protected readonly tiposProposicao = TIPOS_PROPOSICAO;

  protected readonly carreira = signal<Carreira | null>(null);
  protected readonly senador = signal<FichaSenador | null>(null);
  protected readonly carregandoFicha = signal(true);

  protected readonly contagem = signal<{ sigla: string; nome: string; total: number }[] | null>(null);
  protected readonly projetos = signal<Proposicao[]>([]);
  protected readonly totalProjetos = signal(0);
  protected readonly paginaProjetos = signal(1);
  protected readonly tipoProjeto = signal('');
  protected readonly carregandoProjetos = signal(false);
  protected readonly erroProjetos = signal(false);

  protected readonly votacoes = signal<ResumoVotacoes | null>(null);
  protected readonly carregandoVotacoes = signal(false);
  protected readonly erroVotacoes = signal(false);

  protected readonly anosGastos = [0, 1, 2, 3].map((n) => new Date().getFullYear() - n);
  protected readonly anoGastos = signal(new Date().getFullYear());
  protected readonly gastos = signal<GastosAno | null>(null);
  protected readonly carregandoGastos = signal(false);
  protected readonly erroGastos = signal(false);
  protected readonly meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  protected readonly maiorMes = computed(() => Math.max(1, ...(this.gastos()?.porMes ?? [1])));
  protected readonly maiorTipo = computed(() => this.gastos()?.porTipo[0]?.valor || 1);

  protected readonly discursos = signal<Discurso[]>([]);
  protected readonly totalDiscursos = signal(0);
  protected readonly paginaDiscursos = signal(1);
  protected readonly carregandoDiscursos = signal(false);
  protected readonly erroDiscursos = signal(false);
  protected readonly discursoAberto = signal<number | null>(null);

  private carregadas = new Set<Aba>();

  protected abrirAba(a: Aba) {
    this.aba.set(a);
    if (this.carregadas.has(a)) return;
    this.carregadas.add(a);
    if (this.casa() === 'senado') return; // a ficha do Senado vem toda de uma vez
    if (a === 'projetos') this.carregarProjetos();
    if (a === 'votacoes') this.carregarVotacoes();
    if (a === 'gastos') this.carregarGastos();
    if (a === 'discursos') this.carregarDiscursos();
  }

  // ---------------- Patrimônio declarado ao TSE ----------------
  protected readonly patrimonio = signal<Patrimonio | null>(null);
  protected readonly carregandoPatrimonio = signal(true);
  protected readonly gruposBens = computed(() => {
    const p = this.patrimonio();
    if (!p || !p.total) return [];
    return bensPorTipo(p).map((g) => ({ ...g, pct: Math.max(2, Math.round((g.total / p.total) * 100)) }));
  });
  protected readonly todosBens = signal(false);
  protected readonly tipoCurto = tipoCurto;

  // ---------------- Agenda da semana na Câmara ----------------
  protected readonly semana = signal(inicioDaSemana());
  protected readonly agenda = signal<EventoAgenda[]>([]);
  protected readonly carregandoAgenda = signal(true);
  protected readonly erroAgenda = signal(false);
  protected readonly fimSemana = computed(() => { const d = new Date(this.semana()); d.setDate(d.getDate() + 6); return d; });
  protected readonly semanaAtual = computed(() => this.semana().getTime() === inicioDaSemana().getTime());
  /** Eventos agrupados por dia, para a lista da semana. */
  protected readonly agendaPorDia = computed(() => {
    const dias = new Map<string, EventoAgenda[]>();
    for (const e of this.agenda()) {
      const dia = e.inicio.slice(0, 10);
      dias.set(dia, [...(dias.get(dia) ?? []), e]);
    }
    return [...dias.entries()].map(([dia, eventos]) => ({ dia, eventos }));
  });
  /** Reuniões de comissão e audiências (sem contar as sessões do plenário). */
  protected readonly reunioesSemana = computed(() => this.agenda().filter((e) => !e.orgaos.some((o) => o.sigla === 'PLEN')).length);

  protected async carregarAgenda(semana = this.semana()) {
    this.semana.set(semana);
    this.carregandoAgenda.set(true);
    this.erroAgenda.set(false);
    try {
      this.agenda.set(await agendaDaSemana(Number(this.id()), semana));
    } catch {
      this.agenda.set([]);
      this.erroAgenda.set(true);
    } finally {
      this.carregandoAgenda.set(false);
    }
  }

  protected hojeSemana = () => inicioDaSemana();

  protected mudarSemana(passo: number) {
    const d = new Date(this.semana());
    d.setDate(d.getDate() + 7 * passo);
    this.carregarAgenda(d);
  }

  protected async carregarProjetos(pagina = 1) {
    const id = Number(this.id());
    this.carregandoProjetos.set(true);
    this.erroProjetos.set(false);
    if (!this.contagem()) contagemProposicoes(id).then((c) => this.contagem.set(c)).catch(() => this.contagem.set([]));
    try {
      const r = await proposicoesDe(id, pagina, this.tipoProjeto());
      this.projetos.set(r.itens);
      this.totalProjetos.set(r.total);
      this.paginaProjetos.set(pagina);
    } catch {
      this.erroProjetos.set(true);
    } finally {
      this.carregandoProjetos.set(false);
    }
  }

  protected filtrarProjetos(tipo: string) {
    this.tipoProjeto.set(this.tipoProjeto() === tipo ? '' : tipo);
    this.carregarProjetos(1);
  }

  protected async carregarVotacoes() {
    this.carregandoVotacoes.set(true);
    this.erroVotacoes.set(false);
    try {
      this.votacoes.set(await votacoesDe(Number(this.id()), this.politico()?.partido));
    } catch {
      this.erroVotacoes.set(true);
    } finally {
      this.carregandoVotacoes.set(false);
    }
  }

  protected async carregarGastos(ano = this.anoGastos()) {
    this.anoGastos.set(ano);
    this.carregandoGastos.set(true);
    this.erroGastos.set(false);
    try {
      this.gastos.set(await gastosDoAno(Number(this.id()), ano));
    } catch {
      this.erroGastos.set(true);
    } finally {
      this.carregandoGastos.set(false);
    }
  }

  protected async carregarDiscursos(pagina = 1) {
    this.carregandoDiscursos.set(true);
    this.erroDiscursos.set(false);
    try {
      const r = await discursosDe(Number(this.id()), pagina);
      this.discursos.set(r.itens);
      this.totalDiscursos.set(r.total);
      this.paginaDiscursos.set(pagina);
      this.discursoAberto.set(null);
    } catch {
      this.erroDiscursos.set(true);
    } finally {
      this.carregandoDiscursos.set(false);
    }
  }

  protected classeVoto(v: string): string {
    if (/^sim/i.test(v)) return 'voto-sim';
    if (/^n[ãa]o$/i.test(v)) return 'voto-nao';
    if (/não votou|ausente|^ap$|^ncom/i.test(v)) return 'voto-ausente';
    return 'voto-outro';
  }

  /** Frase de resumo montada só com dados oficiais. */
  protected readonly resumo = computed(() => {
    const p = this.politico();
    if (!p) return '';
    const sen = this.casa() === 'senado';
    const sexo = sen ? this.senador()?.sexo : this.carreira()?.sexo;
    const nasc = sen ? this.senador()?.nascimento : this.carreira()?.nascimento ?? p.data_nascimento;
    const anos = idade(nasc);
    const cargo = sen ? (sexo === 'F' ? 'senadora' : sexo === 'M' ? 'senador' : 'senador(a)') : sexo === 'F' ? 'deputada federal' : sexo === 'M' ? 'deputado federal' : 'deputado(a) federal';
    const partes = [`${p.nome}${anos ? `, ${anos} anos,` : ''} é ${cargo}${p.partido ? ` pelo ${p.partido}` : ''}${p.uf ? ` (${p.uf})` : ''}.`];
    if (!sen) {
      const leg = this.carreira()?.legislaturas.length;
      if (leg) partes.push(leg === 1 ? 'Está no primeiro mandato na Câmara.' : `Está no ${leg}º mandato na Câmara.`);
      const tot = this.detalhes()?.totalProposicoes;
      if (tot != null) partes.push(`Apresentou ${tot} proposições nesta legislatura`);
      const g = this.detalhes()?.despesas;
      if (g) partes[partes.length - 1] += `${tot != null ? ' e' : 'Nesta legislatura'} usou ${g.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} da cota parlamentar em ${g.ano}${g.parcial ? ' (parcial)' : ''}.`;
      else if (tot != null) partes[partes.length - 1] += '.';
      const prt = this.carreira()?.partidos.length ?? 0;
      if (prt > 1) partes.push(`Já passou por ${prt} partidos desde que chegou à Câmara.`);
    } else {
      const s = this.senador();
      if (s?.mandatos.length) partes.push(s.mandatos.length === 1 ? 'Está no primeiro mandato no Senado.' : `Tem ${s.mandatos.length} mandatos no Senado.`);
      if (s?.comissoes.length) partes.push(s.comissoes.length === 1 ? "Participa de 1 comissão." : `Participa de ${s.comissoes.length} comissões.`);
    }
    return partes.join(' ');
  });

  // ---------------- Visão geral no formato do slide 10 ----------------
  protected readonly discursosTotal = signal<number | null>(null);
  protected readonly agora = new Date().toISOString();
  protected readonly legislatura = computed(() => {
    const ini = inicioLegislatura();
    const ano = Number(ini.slice(0, 4));
    return { inicio: ini, periodo: `${ano}–${ano + 4}` };
  });
  /** Quando entrou no mandato atual (primeiro registro na legislatura atual). */
  protected readonly inicioMandato = computed(() => {
    if (this.casa() === 'senado') {
      const m = this.senador()?.mandatos[0];
      return m?.periodo ? m.periodo.split(' a ')[0] : null;
    }
    return this.legislatura().inicio;
  });
  protected readonly genero = computed(() => {
    const s = this.casa() === 'senado' ? this.senador()?.sexo : this.carreira()?.sexo;
    return s === 'F' ? 'Feminino' : s === 'M' ? 'Masculino' : null;
  });
  /** Área de atuação: a comissão principal (titular) em que atua. */
  protected readonly area = computed(() => {
    const coms = this.casa() === 'senado' ? this.senador()?.comissoes ?? [] : this.detalhes()?.comissoes ?? [];
    const c = coms.find((x) => /titular|presidente/i.test(x.papel)) ?? coms[0];
    if (!c) return null;
    return c.nome.replace(/^Comissão (de |da |do )?/i, '').replace(/^./, (l) => l.toUpperCase());
  });
  /** Votos nas votações nominais recentes, para o gráfico de rosca. */
  protected readonly rosca = computed(() => {
    const votos = this.casa() === 'senado' ? (this.senador()?.votos ?? []).map((v) => v.voto) : (this.votacoes()?.votos ?? []).map((v) => v.voto);
    if (!votos.length) return null;
    const sim = votos.filter((v) => /^sim$/i.test(v)).length;
    const nao = votos.filter((v) => /^n[ãa]o$/i.test(v)).length;
    const ausente = votos.filter((v) => /não votou|^ap$|ausente|^ncom|^ls|^lap|^mis/i.test(v)).length;
    const outros = votos.length - sim - nao - ausente;
    const total = votos.length;
    const fatias = [
      { nome: 'A favor (Sim)', valor: sim, cor: '#14a370' },
      { nome: 'Contra (Não)', valor: nao, cor: '#d62839' },
      { nome: 'Abstenção / obstrução', valor: outros, cor: '#3b82f6' },
      { nome: 'Não votou', valor: ausente, cor: '#9aa8b3' },
    ].filter((f) => f.valor > 0);
    // Arcos do SVG (circunferência de r=40 ≈ 251,3)
    const C = 2 * Math.PI * 40;
    let acum = 0;
    const arcos = fatias.map((f) => {
      const tam = (f.valor / total) * C;
      const arco = { ...f, pct: Math.round((f.valor / total) * 100), dash: `${tam} ${C - tam}`, offset: -acum };
      acum += tam;
      return arco;
    });
    return { total, arcos };
  });
  /** Até 3 itens da trajetória: mandatos e cargos anteriores. */
  protected readonly trajetoria = computed(() => {
    const p = this.politico();
    if (this.casa() === 'senado') {
      const s = this.senador();
      return [
        ...(s?.mandatos ?? []).map((m) => ({ periodo: m.periodo, titulo: 'Senador(a)', local: m.uf ? `Senado Federal · ${m.uf}` : 'Senado Federal' })),
        ...(s?.formacao ?? []).map((f) => ({ periodo: '', titulo: f.curso, local: f.local })),
      ];
    }
    const c = this.carreira();
    return [
      ...(c?.legislaturas ?? []).map((l) => ({ periodo: `${anoLegislatura(l)}–${anoLegislatura(l) + 4}`, titulo: 'Deputado(a) federal', local: `Câmara dos Deputados · ${p?.uf ?? ''}` })),
      ...(c?.mandatosExternos ?? []).map((m) => ({ periodo: m.periodo, titulo: m.cargo, local: m.local })),
      ...(c?.ocupacoes ?? []).map((o) => ({ periodo: o.periodo, titulo: o.titulo, local: o.entidade })),
    ];
  });
  /** Linha do tempo do mandato: fatos com data vindos das APIs (projetos, discursos, votos, partido). */
  protected readonly linhaDoTempo = computed(() => {
    const ev: { data: string; texto: string }[] = [];
    if (this.casa() === 'senado') {
      const s = this.senador();
      if (this.inicioMandato()) ev.push({ data: `${this.inicioMandato()}-02-01`, texto: 'Início do mandato' });
      for (const a of (s?.autorias ?? []).slice(0, 3)) if (a.data) ev.push({ data: a.data, texto: `Apresentou ${a.titulo}` });
      for (const d of (s?.discursos ?? []).slice(0, 2)) if (d.data) ev.push({ data: d.data, texto: d.tipo || 'Discurso no plenário' });
      for (const v of (s?.votos ?? []).slice(0, 2)) if (v.data) ev.push({ data: v.data, texto: `Votou “${v.voto}”${v.materia ? ' na ' + v.materia : ''}` });
    } else {
      ev.push({ data: this.legislatura().inicio, texto: 'Início do mandato' });
      for (const pt of this.carreira()?.partidos ?? []) if (pt.desde >= this.legislatura().inicio) ev.push({ data: pt.desde, texto: `Filiou-se ao ${pt.sigla}` });
      for (const pr of this.projetos().slice(0, 3)) if (pr.apresentacao) ev.push({ data: pr.apresentacao, texto: `Apresentou o ${pr.titulo}` });
      for (const d of this.discursos().slice(0, 2)) ev.push({ data: d.data, texto: d.fase ? `Discurso: ${d.fase}` : 'Discurso no plenário' });
      for (const v of (this.votacoes()?.votos ?? []).slice(0, 2)) ev.push({ data: v.data, texto: `Votou “${v.voto}”${v.proposicao ? ' no ' + v.proposicao : ''}` });
    }
    const vistos = new Set<string>();
    return ev
      .filter((e) => e.data && !vistos.has(e.texto) && !!vistos.add(e.texto))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-7);
  });
  // ---------------- Tempo na vida pública + pontos de atenção ----------------
  protected readonly leis = signal<number | null>(null);
  protected readonly anoAtual = new Date().getFullYear();

  /** Cada período vira uma barra no gráfico (Câmara, Senado, outros cargos e trabalho fora da política). */
  protected readonly vidaPublica = computed(() => {
    const agora = new Date().getFullYear() + new Date().getMonth() / 12;
    const cores: Record<string, string> = { 'Câmara dos Deputados': '#14a370', 'Senado Federal': '#3b82f6', 'Cargos estaduais e municipais': '#f59e0b', 'Executivo': '#a855f7', 'Fora da política': '#94a3b8' };
    const linhas: { rotulo: string; categoria: string; ini: number; fim: number }[] = [];
    const anos = (txt: string) => (txt.match(/\d{4}/g) ?? []).map(Number);
    const categoria = (cargo: string) =>
      /senador/i.test(cargo) ? 'Senado Federal'
      : /deputad[oa] federal/i.test(cargo) ? 'Câmara dos Deputados'
      : /governador|presidente|ministr|secret[aá]ri/i.test(cargo) ? 'Executivo'
      : 'Cargos estaduais e municipais';
    if (this.casa() === 'senado') {
      for (const m of this.senador()?.mandatos ?? []) {
        const [i, f] = anos(m.periodo);
        if (i) linhas.push({ rotulo: 'Senador(a)', categoria: 'Senado Federal', ini: i, fim: Math.min(f ?? agora, agora) });
      }
    } else {
      const c = this.carreira();
      for (const l of c?.legislaturas ?? []) {
        const i = anoLegislatura(l);
        linhas.push({ rotulo: 'Deputado(a) federal', categoria: 'Câmara dos Deputados', ini: i, fim: Math.min(i + 4, agora) });
      }
      for (const m of c?.mandatosExternos ?? []) {
        const [i, f] = anos(m.periodo);
        if (i) linhas.push({ rotulo: m.cargo, categoria: categoria(m.cargo), ini: i, fim: Math.min((f ?? i) + 1, agora) });
      }
      const primeiraPolitica = Math.min(...linhas.map((l) => l.ini), agora);
      for (const o of c?.ocupacoes ?? []) {
        const [i, f] = anos(o.periodo);
        if (i) linhas.push({ rotulo: o.titulo, categoria: 'Fora da política', ini: i, fim: Math.min((f ?? primeiraPolitica) + (f ? 1 : 0), agora) });
      }
    }
    if (!linhas.length) return null;
    // Junta períodos seguidos do mesmo cargo (ex.: 3 legislaturas = 1 barra)
    linhas.sort((a, b) => a.categoria.localeCompare(b.categoria) || a.ini - b.ini);
    const juntas: typeof linhas = [];
    for (const l of linhas) {
      const ult = juntas[juntas.length - 1];
      if (ult && ult.rotulo === l.rotulo && l.ini <= ult.fim + 0.01) ult.fim = Math.max(ult.fim, l.fim);
      else juntas.push({ ...l });
    }
    juntas.sort((a, b) => a.ini - b.ini);
    const inicio = Math.min(...juntas.map((l) => l.ini));
    const fim = Math.ceil(agora);
    const porCategoria = Object.keys(cores)
      .map((nome) => ({ nome, cor: cores[nome], anos: Math.round(juntas.filter((l) => l.categoria === nome).reduce((t, l) => t + (l.fim - l.ini), 0)) }))
      .filter((c) => c.anos > 0);
    const politica = porCategoria.filter((c) => c.nome !== 'Fora da política').reduce((t, c) => t + c.anos, 0);
    const marcas: number[] = [];
    const passo = fim - inicio > 24 ? 8 : fim - inicio > 12 ? 4 : 2;
    for (let a = Math.ceil(inicio / passo) * passo; a <= fim; a += passo) marcas.push(a);
    return {
      inicio, fim, politica, porCategoria, marcas,
      linhas: juntas.map((l) => ({ ...l, cor: cores[l.categoria], esq: ((l.ini - inicio) / (fim - inicio)) * 100, larg: Math.max(1.5, ((l.fim - l.ini) / (fim - inicio)) * 100), anos: Math.max(1, Math.round(l.fim - l.ini)) })),
    };
  });

  /** Sinais tirados só dos dados oficiais. "alerta" = ponto negativo, "ok" = ponto positivo. */
  protected readonly pontos = computed(() => {
    const p = this.politico();
    if (!p) return [];
    const sen = this.casa() === 'senado';
    const lista: { tipo: 'alerta' | 'atencao' | 'ok'; icone: string; texto: string; detalhe: string }[] = [];
    const reg = this.alertas().filter((a) => a.tipo !== 'Absolvição ou arquivamento');
    if (reg.length) lista.push({ tipo: 'alerta', icone: 'gavel', texto: `${plural(reg.length, 'registro', 'registros')} de polêmica ou processo na Justiça`, detalhe: 'Veja cada um, com fonte, no quadro vermelho acima.' });
    const pres = this.presenca();
    if (pres !== null) {
      if (pres < 70) lista.push({ tipo: 'alerta', icone: 'event_busy', texto: `Faltou em ${100 - pres}% das votações recentes`, detalhe: 'Presença bem abaixo do comum no plenário. Faltas podem ter motivo justo, como licença médica ou missão oficial.' });
      else if (pres < 90) lista.push({ tipo: 'atencao', icone: 'event_busy', texto: `Faltou em ${100 - pres}% das votações recentes`, detalhe: 'Faltas podem ter motivo justo, como licença médica ou missão oficial.' });
      else lista.push({ tipo: 'ok', icone: 'event_available', texto: `Presente em ${pres}% das votações recentes`, detalhe: 'Boa presença no plenário.' });
    }
    const partidos = (sen ? this.senador()?.partidos : this.carreira()?.partidos)?.length ?? 0;
    if (partidos >= 3) lista.push({ tipo: 'atencao', icone: 'swap_horiz', texto: `Já passou por ${partidos} partidos`, detalhe: sen ? 'Segundo as filiações registradas no Senado.' : 'Desde que chegou à Câmara.' });
    if (!sen) {
      const contra = (this.votacoes()?.votos ?? []).filter((v) => v.comPartido === false).length;
      if (contra) lista.push({ tipo: 'atencao', icone: 'call_split', texto: `Votou contra o próprio partido ${plural(contra, 'vez', 'vezes')}`, detalhe: 'Nas votações recentes do plenário. Pode mostrar independência ou divergência.' });
      const tot = this.detalhes()?.totalProposicoes;
      const leis = this.leis();
      if (leis !== null && leis > 0) lista.push({ tipo: 'ok', icone: 'verified', texto: `${leis === 1 ? '1 projeto de autoria virou lei' : plural(leis, 'projeto', 'projetos') + ' de autoria viraram lei'}`, detalhe: 'Projetos de autoria ou coautoria apresentados desde fevereiro de 2023, segundo os dados abertos da Câmara.' });
      else if (leis === 0 && tot != null) lista.push({ tipo: 'atencao', icone: 'block', texto: 'Nenhum projeto de autoria virou lei', detalhe: `Apresentou ${tot} proposições nesta legislatura, mas nenhuma das suas virou lei até agora.` });
      const g = this.comparacaoGastos();
      if (g) {
        if (g.acima > 15) lista.push({ tipo: 'alerta', icone: 'trending_up', texto: `Gastou ${g.acima}% acima da média de ${p.uf}`, detalhe: `Foi o ${g.posicao}º que mais gastou da cota entre ${g.de} deputados do estado.` });
        else if (g.acima < -15) lista.push({ tipo: 'ok', icone: 'savings', texto: `Gastou ${-g.acima}% abaixo da média de ${p.uf}`, detalhe: `Está em ${g.posicao}º lugar entre ${g.de} deputados do estado.` });
      }
    }
    return lista;
  });

  /** Compara com a média do estado, se o ranking de gastos já foi calculado neste navegador. */
  protected readonly comparacaoGastos = computed(() => {
    const p = this.politico();
    if (!p?.uf) return null;
    try {
      const bruto = JSON.parse(localStorage.getItem('fatoreal-cache:gastos-' + p.uf) ?? 'null') as { linhas: { politico: { id: number }; total: number }[] } | null;
      const linhas = (bruto?.linhas ?? []).filter((l) => l.total > 0).sort((a, b) => b.total - a.total);
      const i = linhas.findIndex((l) => l.politico.id === p.id);
      if (i < 0 || linhas.length < 3) return null;
      const media = linhas.reduce((t, l) => t + l.total, 0) / linhas.length;
      return { acima: Math.round(((linhas[i].total - media) / media) * 100), posicao: i + 1, de: linhas.length };
    } catch {
      return null;
    }
  });

  /** Consultas que não têm API aberta: dívidas, sanções e contas de campanha. */
  protected readonly consultasNegativas = [
    { icone: 'account_balance_wallet', titulo: 'Dívidas com a União', texto: 'Lista de devedores da Procuradoria da Fazenda (PGFN)', url: 'https://www.listadevedores.pgfn.gov.br/' },
    { icone: 'block', titulo: 'Sanções e impedimentos', texto: 'Empresas e pessoas punidas (CEIS / CNEP)', url: 'https://portaldatransparencia.gov.br/sancoes' },
    { icone: 'receipt_long', titulo: 'Contas de campanha e bens', texto: 'Prestação de contas e patrimônio declarado (TSE)', url: 'https://divulgacandcontas.tse.jus.br/divulga/#/home' },
    { icone: 'balance', titulo: 'Condenações por improbidade', texto: 'Cadastro Nacional do CNJ', url: 'https://www.cnj.jus.br/improbidade_adm/consultar_requerido.php' },
  ];

  protected readonly nomeEstado = nomeEstado;
  protected dominio(u: string) {
    try {
      return new URL(u).hostname.replace(/^www\./, '');
    } catch {
      return u;
    }
  }
  protected readonly mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  /** Gráfico de barras dos gastos por mês (só deputados; dado da Câmara). */
  protected readonly gastosMes = computed(() => {
    const d = this.detalhes()?.despesas;
    if (this.casa() === 'senado' || !d?.porMes?.some((v) => v > 0)) return null;
    return { ano: d.ano, total: d.total, parcial: d.parcial, meses: d.porMes, max: Math.max(...d.porMes) };
  });
  /** Cartões coloridos do painel do mandato. */
  protected readonly estatisticas = computed(() => {
    const sen = this.casa() === 'senado';
    const d = this.detalhes();
    const s = this.senador();
    const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    const lista = [
      { rotulo: sen ? 'matérias de autoria' : 'proposições apresentadas', icone: 'description', cor: '#4f46e5',
        carregando: sen ? this.carregandoFicha() : this.carregandoDetalhes(), valor: String(sen ? (s?.autorias?.length ?? '—') : (d?.totalProposicoes ?? '—')) },
      { rotulo: 'presença nas votações', icone: 'how_to_reg', cor: '#15803d',
        carregando: sen ? this.carregandoFicha() : this.carregandoVotacoes(), valor: this.presenca() !== null ? this.presenca() + '%' : '—' },
      { rotulo: sen ? 'discursos no último ano' : 'discursos na legislatura', icone: 'record_voice_over', cor: '#be123c',
        carregando: false, valor: String(sen ? (s?.discursos?.length ?? '—') : (this.discursosTotal() ?? '—')) },
    ];
    if (!sen) {
      lista.push(
        { rotulo: 'comissões atuais', icone: 'groups', cor: '#0369a1', carregando: this.carregandoDetalhes(), valor: d ? String(d.comissoes.length) : '—' },
        { rotulo: d?.despesas ? `cota usada em ${d.despesas.ano}` : 'cota parlamentar', icone: 'payments', cor: '#d97706', carregando: this.carregandoDetalhes(), valor: d?.despesas ? moeda(d.despesas.total) : '—' },
      );
    }
    return lista;
  });
  protected readonly presenca = computed<number | null>(() => {
    if (this.casa() !== 'senado') return this.votacoes()?.presenca ?? null;
    const r = this.rosca();
    if (!r) return null;
    const aus = r.arcos.find((a) => a.nome === 'Não votou')?.valor ?? 0;
    return Math.round(((r.total - aus) / r.total) * 100);
  });
  protected readonly fontes = computed(() => {
    const p = this.politico();
    if (!p) return [];
    const sen = this.casa() === 'senado';
    return [
      { icone: 'account_balance', titulo: sen ? 'Página oficial no Senado' : 'Página oficial na Câmara', url: p.fonte_url },
      { icone: 'data_object', titulo: sen ? 'Dados Abertos do Senado' : 'Dados Abertos da Câmara', url: sen ? `https://legis.senado.leg.br/dadosabertos/senador/${p.id}` : `https://dadosabertos.camara.leg.br/api/v2/deputados/${p.id}` },
      { icone: 'how_to_vote', titulo: 'Tribunal Superior Eleitoral (bens e doações)', url: 'https://divulgacandcontas.tse.jus.br/divulga/#/home' },
      { icone: 'payments', titulo: 'Portal da Transparência', url: 'https://portaldatransparencia.gov.br/' },
    ];
  });

  protected readonly politico = signal<Politico | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal('');
  /** Comissões, proposições, gastos e contato: carregam depois do perfil, sem travar a página. */
  protected readonly detalhes = signal<DetalhesPolitico | null>(null);
  protected readonly carregandoDetalhes = signal(true);
  protected readonly link = linkSeguro;

  protected readonly fonte = computed(() => {
    const p = this.politico();
    return p ? { titulo: p.casa === 'senado' ? 'Senado Federal' : 'Câmara dos Deputados', url: p.fonte_url, data: p.data_coleta } : null;
  });
  protected readonly fonteCamara = computed(() => ({
    titulo: 'Dados Abertos da Câmara',
    url: `https://dadosabertos.camara.leg.br/api/v2/deputados/${this.id()}`,
    data: new Date().toISOString(),
  }));
  protected readonly perguntaIa = computed(() => `O que se sabe sobre a atuação de ${this.politico()?.nome ?? ''}?`);
  protected readonly maiorGasto = computed(() => this.detalhes()?.despesas?.porTipo[0]?.valor || 1);
  protected readonly local = computed(() => {
    const g = this.detalhes()?.gabinete;
    if (!g?.sala) return null;
    return [`Sala ${g.sala}`, g.andar && `${g.andar}º andar`, g.predio && `Anexo ${g.predio}`].filter(Boolean).join(' · ');
  });

  async ngOnInit() {
    const id = Number(this.id());
    const senado = this.casa() === 'senado';
    // Proteção: com o Supabase, um link antigo /politicos/<código do Senado> mandaria o código para a API da Câmara
    // (404/429 e perfil vazio). Se esse id é de um senador no banco, troca para a rota do Senado sem chamar a Câmara.
    if (!senado && supabase) {
      const sen = await obterSenador(id).catch(() => null);
      if (sen) {
        this.router.navigate(rotaPolitico(sen), { replaceUrl: true });
        return;
      }
    }
    if (senado) {
      this.carregandoDetalhes.set(false);
      fichaSenador(id).then((f) => this.senador.set(f)).catch(() => this.senador.set(null)).finally(() => this.carregandoFicha.set(false));
    } else {
      carreiraCamara(id).then((c) => this.carreira.set(c)).catch(() => this.carreira.set(null)).finally(() => this.carregandoFicha.set(false));
      // Dados da visão geral (projetos, votos, discursos), sem travar a página
      this.carregadas.add('projetos').add('votacoes').add('discursos');
      this.carregarProjetos(1);
      this.carregarDiscursos(1);
      totalDiscursos(id).then((t) => this.discursosTotal.set(t)).catch(() => {});
      leisDoAutor(id).then((n) => this.leis.set(n)).catch(() => {});
      this.carregarAgenda();
      detalhesCamara(id)
        .then((d) => this.detalhes.set(d))
        .catch(() => this.detalhes.set(null))
        .finally(() => this.carregandoDetalhes.set(false));
    }
    patrimonioDe(senado ? 'senado' : 'camara', id)
      .then((pt) => this.patrimonio.set(pt))
      .finally(() => this.carregandoPatrimonio.set(false));
    try {
      const p = senado ? await obterSenador(id) : await this.service.obter(id);
      this.politico.set(p);
      // Votações dependem do partido (para saber quando votou contra ele)
      if (p && !senado) this.carregarVotacoes();
      if (p) alertasDe(p).then((a) => this.alertas.set(a)).finally(() => this.carregandoAlertas.set(false));
      else this.carregandoAlertas.set(false);
    } catch (e) {
      this.erro.set(e instanceof Error ? e.message : 'Erro ao carregar.');
    } finally {
      this.carregando.set(false);
    }
  }
}
