import { query, queryOne } from '../../core/db';
import { ApiError } from '../../core/http';
import { diagnosticsModel as M } from './diagnostics.model';
import type { CreateDiagnosticInput } from './diagnostics.schema';

type Area = 'financeiro' | 'comercial' | 'marketing' | 'gestao';

interface Recommendation {
  area: Area;
  score: number;
  message: string;
  groupSlug: string;
}

/** Mapeia área fraca → grupo-semente (slugs criados em 002_seed.sql). */
const AREA_GROUP: Record<Area, string> = {
  financeiro: 'gestao-financeira',
  comercial: 'marketing-vendas',
  marketing: 'marketing-vendas',
  gestao: 'varejo',
};

const AREA_TIP: Record<Area, string> = {
  financeiro: 'Organize fluxo de caixa, precificação e DRE. Comece pela visão semanal de caixa.',
  comercial: 'Estruture seu processo comercial: funil, follow-up e metas claras por etapa.',
  marketing: 'Defina posicionamento e um canal de aquisição principal antes de espalhar esforço.',
  gestao: 'Implemente rotina de indicadores e delegação para sair do operacional.',
};

/** Normaliza um array de respostas 0..5 para nota 0..100. */
function scoreArea(answers: number[]): number {
  if (answers.length === 0) return 0;
  const sum = answers.reduce((a, b) => a + b, 0);
  return Math.round((sum / (answers.length * 5)) * 100);
}

export const diagnosticsService = {
  async create(input: CreateDiagnosticInput, userId: string | null) {
    if (!userId && !input.leadEmail) {
      throw new ApiError('Informe um e-mail para receber o resultado.', 400);
    }

    const { financeiro, comercial, marketing, gestao } = input.answers;
    const scores: Record<Area, number> = {
      financeiro: scoreArea(financeiro),
      comercial: scoreArea(comercial),
      marketing: scoreArea(marketing),
      gestao: scoreArea(gestao),
    };
    const total = Math.round((scores.financeiro + scores.comercial + scores.marketing + scores.gestao) / 4);

    // Recomendações para áreas abaixo de 60 (maturidade baixa/média).
    const recommendations: Recommendation[] = (Object.keys(scores) as Area[])
      .filter((area) => scores[area] < 60)
      .sort((a, b) => scores[a] - scores[b])
      .map((area) => ({ area, score: scores[area], message: AREA_TIP[area], groupSlug: AREA_GROUP[area] }));

    const recommendedGroups = [...new Set(recommendations.map((r) => r.groupSlug))];

    const row = await queryOne(M.insert(), [
      userId,
      input.leadEmail ?? null,
      JSON.stringify(input.answers),
      scores.financeiro,
      scores.comercial,
      scores.marketing,
      scores.gestao,
      total,
      JSON.stringify(recommendations),
    ]);

    return { ...row, scores, total, recommendations, recommendedGroups };
  },

  async latestForUser(userId: string) {
    return query(M.latestForUser(), [userId]).then((rows) => rows[0] ?? null);
  },
};
