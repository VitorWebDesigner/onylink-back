-- ============================================================================
-- Seed inicial: selos (badges) e grupos-semente. Idempotente.
-- ============================================================================

INSERT INTO badges (code, name, description, icon) VALUES
  ('PERFIL_COMPLETO',       'Perfil Completo',       'Completou todo o perfil empresarial', 'check-circle'),
  ('EMPRESARIO_VERIFICADO', 'Empresário Verificado', 'Identidade e empresa verificadas',    'verified'),
  ('CONECTOR',              'Conector',              'Conecta empresários de forma ativa',  'link'),
  ('ESPECIALISTA',          'Especialista',          'Reconhecido como especialista',       'award'),
  ('MENTOR',                'Mentor',                'Mentora outros empresários',          'compass'),
  ('TOP_CONTRIBUIDOR',      'Top Contribuidor',      'Conteúdo útil em alto volume',        'star')
ON CONFLICT (code) DO NOTHING;

INSERT INTO groups (name, slug, description, segment, city) VALUES
  ('Empresários do Varejo',   'varejo',          'Donos e gestores de varejo',          'Varejo',   NULL),
  ('Empresários de Teresina', 'teresina',        'Rede local de Teresina-PI',           NULL,       'Teresina'),
  ('Marketing e Vendas',      'marketing-vendas','Estratégias de aquisição e receita',  'Marketing',NULL),
  ('Gestão Financeira',       'gestao-financeira','Fluxo de caixa, precificação, DRE',  'Financeiro',NULL),
  ('Donos de Agência',        'agencias',        'Gestão e crescimento de agências',    'Serviços', NULL)
ON CONFLICT (slug) DO NOTHING;
