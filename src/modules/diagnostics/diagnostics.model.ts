/** SQL do módulo diagnostics. Funções puras retornando SQL parametrizado. */
export const diagnosticsModel = {
  insert: () => `
    INSERT INTO diagnostics
      (user_id, lead_email, answers, score_financeiro, score_comercial,
       score_marketing, score_gestao, score_total, recommendations)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, score_financeiro, score_comercial, score_marketing,
              score_gestao, score_total, recommendations, created_at`,

  latestForUser: () => `
    SELECT id, score_financeiro, score_comercial, score_marketing,
           score_gestao, score_total, recommendations, created_at
    FROM diagnostics
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT 1`,
};
