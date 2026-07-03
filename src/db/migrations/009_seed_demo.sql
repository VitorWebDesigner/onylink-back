-- ============================================================================
-- 009 — SEED de demonstração: empresários, posts, comentários (com respostas e
--        reações) e oportunidades. Idempotente (UUIDs fixos + ON CONFLICT DO
--        NOTHING). Objetivo: ver o app "cheio" sem depender de uso manual.
--        Usuários demo NÃO logam (password_hash placeholder) — só geram conteúdo.
-- ============================================================================

-- ───────────────── empresários demo ─────────────────
INSERT INTO users (id, name, email, password_hash, role, active, email_verified, handle) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Marina Lopes',   'marina@onylink.demo',   'seed-no-login', 'USER', true, true, 'marinalopes'),
  ('22222222-2222-2222-2222-222222222222', 'Rafael Souza',   'rafael@onylink.demo',   'seed-no-login', 'USER', true, true, 'rafasouza'),
  ('33333333-3333-3333-3333-333333333333', 'Carla Mendes',   'carla@onylink.demo',    'seed-no-login', 'USER', true, true, 'carlamendes'),
  ('44444444-4444-4444-4444-444444444444', 'Bruno Alves',    'bruno@onylink.demo',    'seed-no-login', 'USER', true, true, 'brunoalves'),
  ('55555555-5555-5555-5555-555555555555', 'Patrícia Nunes', 'patricia@onylink.demo', 'seed-no-login', 'USER', true, true, 'patricianunes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (user_id, role_title, segment, city, state, bio) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Head de Marketing', 'Marketing',   'Curitiba', 'PR', 'Cresço marcas com conteúdo e dados.'),
  ('22222222-2222-2222-2222-222222222222', 'Diretor Comercial', 'Vendas',      'São Paulo','SP', 'Vendo consultivo. Processo > talento.'),
  ('33333333-3333-3333-3333-333333333333', 'CFO',               'Financeiro',  'Curitiba', 'PR', 'Caixa organizado, empresa saudável.'),
  ('44444444-4444-4444-4444-444444444444', 'CTO',               'Tecnologia',  'Floripa',  'SC', 'Automatizo o que não precisa de gente.'),
  ('55555555-5555-5555-5555-555555555555', 'CEO',               'Gestão',      'São Paulo','SP', 'Gestão simples que cabe na rotina.')
ON CONFLICT (user_id) DO NOTHING;

-- ───────────────── posts ─────────────────
INSERT INTO posts (id, author_id, category, content, status, utility_score, created_at) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Marketing',
    'Testamos 3 versões de headline na landing essa semana. A que falava de RESULTADO (e não de recurso) converteu 38% melhor. Vendam o destino, não o avião.',
    'APPROVED', 90, now() - interval '2 hours'),
  ('aaaa0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Vendas',
    'Fechei 4 contratos essa semana só ajustando o follow-up: toque a cada 2 dias úteis, sempre com um motivo novo (case, dado, prova). Ninguém compra de quem some.',
    'APPROVED', 85, now() - interval '6 hours'),
  ('aaaa0003-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Financeiro',
    'Separar conta PJ de PF foi a virada de chave do meu caixa. Pró-labore fixo, o resto fica na empresa. Parece óbvio, mas 7 de 10 empresários que converso ainda misturam.',
    'APPROVED', 80, now() - interval '1 day'),
  ('aaaa0004-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Tecnologia',
    'Automatizei o onboarding de cliente com n8n: contrato assinado dispara e-mail, cria pasta, agenda kickoff e avisa o time. Economizei ~5h/semana do meu operacional.',
    'APPROVED', 75, now() - interval '1 day 4 hours'),
  ('aaaa0005-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'Gestão',
    'Troquei reunião de 1h por daily de 15min em pé. O que travou ontem, o que faço hoje, onde preciso de ajuda. Reunião longa é onde a produtividade vai morrer.',
    'APPROVED', 70, now() - interval '2 days'),
  ('aaaa0006-0000-0000-0000-000000000006', '11111111-1111-1111-1111-111111111111', 'Networking',
    'Quem aqui é de Curitiba e quer trocar indicação de fornecedor de confiança? Monto uma lista e compartilho com quem participar. Networking de verdade é troca, não vitrine.',
    'APPROVED', 65, now() - interval '3 days')
ON CONFLICT (id) DO NOTHING;

-- ───────────────── comentários (topo + respostas) ─────────────────
-- post 1
INSERT INTO comments (id, post_id, author_id, content, parent_id, created_at) VALUES
  ('cccc0001-0000-0000-0000-000000000001', 'aaaa0001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'Qual ferramenta vocês usaram pro teste A/B? Tô querendo testar na minha também.', NULL, now() - interval '100 minutes'),
  ('cccc0001-0000-0000-0000-0000000000a1', 'aaaa0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'O próprio gerenciador da landing já divide o tráfego, sem custo. Começa simples.', 'cccc0001-0000-0000-0000-000000000001', now() - interval '90 minutes'),
  ('cccc0002-0000-0000-0000-000000000002', 'aaaa0001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'Headline boa muda tudo mesmo. Subestimam isso.', NULL, now() - interval '80 minutes'),
-- post 2
  ('cccc0003-0000-0000-0000-000000000003', 'aaaa0002-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'Follow-up é o que separa amador de profissional. Quanto tempo entre os toques?', NULL, now() - interval '5 hours'),
  ('cccc0003-0000-0000-0000-0000000000a1', 'aaaa0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '2 dias úteis. Mais que isso o lead esfria, menos que isso vira perseguição.', 'cccc0003-0000-0000-0000-000000000003', now() - interval '4 hours'),
-- post 3
  ('cccc0004-0000-0000-0000-000000000004', 'aaaa0003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'Isso. Conta separada salva qualquer negócio — e facilita demais na hora do imposto.', NULL, now() - interval '20 hours'),
-- post 4
  ('cccc0005-0000-0000-0000-000000000005', 'aaaa0004-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555', 'Manda o fluxo do n8n depois! Tô montando algo parecido aqui.', NULL, now() - interval '22 hours'),
-- post 5
  ('cccc0006-0000-0000-0000-000000000006', 'aaaa0005-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', '15min é o segredo. Passou disso vira terapia de grupo.', NULL, now() - interval '1 day 20 hours')
ON CONFLICT (id) DO NOTHING;

-- ───────────────── reações em posts (likes + insights) ─────────────────
INSERT INTO reactions (post_id, user_id, kind) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'LIKE'),
  ('aaaa0001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'LIKE'),
  ('aaaa0001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'LIKE'),
  ('aaaa0001-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'LIKE'),
  ('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'LIKE'),
  ('aaaa0002-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333', 'LIKE'),
  ('aaaa0002-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'LIKE'),
  ('aaaa0003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222', 'LIKE'),
  ('aaaa0003-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'LIKE'),
  ('aaaa0004-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'LIKE'),
  ('aaaa0005-0000-0000-0000-000000000005', '33333333-3333-3333-3333-333333333333', 'LIKE'),
  ('aaaa0005-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444', 'LIKE')
ON CONFLICT DO NOTHING;

INSERT INTO post_insights (post_id, user_id) VALUES
  ('aaaa0001-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555'),
  ('aaaa0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'),
  ('aaaa0003-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444')
ON CONFLICT DO NOTHING;

-- ───────────────── reações em comentários (geram o "top comment" inline) ─────────────────
INSERT INTO comment_likes (comment_id, user_id) VALUES
  ('cccc0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'),
  ('cccc0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('cccc0001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444'),
  ('cccc0002-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111'),
  ('cccc0003-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222'),
  ('cccc0003-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333'),
  ('cccc0004-0000-0000-0000-000000000004', '33333333-3333-3333-3333-333333333333'),
  ('cccc0004-0000-0000-0000-000000000004', '55555555-5555-5555-5555-555555555555'),
  ('cccc0006-0000-0000-0000-000000000006', '44444444-4444-4444-4444-444444444444'),
  ('cccc0006-0000-0000-0000-000000000006', '55555555-5555-5555-5555-555555555555')
ON CONFLICT DO NOTHING;

INSERT INTO comment_insights (comment_id, user_id) VALUES
  ('cccc0001-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555'),
  ('cccc0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111'),
  ('cccc0005-0000-0000-0000-000000000005', '44444444-4444-4444-4444-444444444444')
ON CONFLICT DO NOTHING;

-- ───────────────── oportunidades ─────────────────
INSERT INTO opportunities (id, author_id, kind, title, description, city, segment, status, created_at) VALUES
  ('bbbb0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'PARCERIA',
    'Busco parceria com agência de tráfego pago', 'Tenho carteira de clientes B2B que pedem gestão de tráfego. Procuro agência séria pra indicar e dividir comissão.', 'Curitiba', 'Marketing', 'APPROVED', now() - interval '8 hours'),
  ('bbbb0002-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'VAGA',
    'Vaga: Dev React Native pleno (remoto)', 'Produto próprio, time enxuto, stack moderna (Expo + TS + Node). CLT ou PJ. Buscamos quem gosta de produto, não só de código.', 'Remoto', 'Tecnologia', 'APPROVED', now() - interval '1 day 2 hours'),
  ('bbbb0003-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'EVENTO',
    'Café empresarial em Curitiba — networking real', 'Encontro presencial de empresários pra trocar indicação e fechar parceria. Sem palestra, só conversa que gera negócio.', 'Curitiba', 'Networking', 'APPROVED', now() - interval '2 days')
ON CONFLICT (id) DO NOTHING;

-- comentários de oportunidade (topo + resposta)
INSERT INTO opportunity_comments (id, opportunity_id, author_id, content, parent_id, created_at) VALUES
  ('dddd0001-0000-0000-0000-000000000001', 'bbbb0001-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Tenho agência e atendo Curitiba. Bate com o que você precisa — vamos conversar!', NULL, now() - interval '7 hours'),
  ('dddd0001-0000-0000-0000-0000000000a1', 'bbbb0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Perfeito, te chamo no privado pra alinhar a comissão.', 'dddd0001-0000-0000-0000-000000000001', now() - interval '6 hours'),
  ('dddd0002-0000-0000-0000-000000000002', 'bbbb0002-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'Qual stack além de RN? Tem testes automatizados?', NULL, now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO opportunity_likes (opportunity_id, user_id) VALUES
  ('bbbb0001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333'),
  ('bbbb0001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444'),
  ('bbbb0002-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222'),
  ('bbbb0003-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333'),
  ('bbbb0003-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555')
ON CONFLICT DO NOTHING;

INSERT INTO opportunity_insights (opportunity_id, user_id) VALUES
  ('bbbb0001-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555')
ON CONFLICT DO NOTHING;

INSERT INTO opp_comment_likes (comment_id, user_id) VALUES
  ('dddd0001-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222'),
  ('dddd0001-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333'),
  ('dddd0002-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444')
ON CONFLICT DO NOTHING;

INSERT INTO opp_comment_insights (comment_id, user_id) VALUES
  ('dddd0001-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444')
ON CONFLICT DO NOTHING;

-- ───────────────── sincroniza contadores (idempotente, só entidades do seed) ─────────────────
UPDATE posts p SET
  like_count    = (SELECT count(*) FROM reactions r     WHERE r.post_id = p.id AND r.kind = 'LIKE'),
  insight_count = (SELECT count(*) FROM post_insights pi WHERE pi.post_id = p.id),
  comment_count = (SELECT count(*) FROM comments c       WHERE c.post_id = p.id)
WHERE p.id::text LIKE 'aaaa%';

UPDATE comments c SET
  like_count    = (SELECT count(*) FROM comment_likes cl    WHERE cl.comment_id = c.id),
  insight_count = (SELECT count(*) FROM comment_insights ci WHERE ci.comment_id = c.id),
  reply_count   = (SELECT count(*) FROM comments r          WHERE r.parent_id = c.id)
WHERE c.post_id::text LIKE 'aaaa%';

UPDATE opportunity_comments c SET
  like_count    = (SELECT count(*) FROM opp_comment_likes cl    WHERE cl.comment_id = c.id),
  insight_count = (SELECT count(*) FROM opp_comment_insights ci WHERE ci.comment_id = c.id),
  reply_count   = (SELECT count(*) FROM opportunity_comments r  WHERE r.parent_id = c.id)
WHERE c.opportunity_id::text LIKE 'bbbb%';
