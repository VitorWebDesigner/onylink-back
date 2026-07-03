-- ============================================================================
-- 013 — Post de DEMO da lógica de ocultação de comentários:
--   * 3 comentários PRIMÁRIOS (todos sempre visíveis, pois < limite de primários);
--   * 1 primário com 5 respostas  → respostas COLAPSAM ("Ver 5 respostas");
--   * 1 primário com 2 respostas  → respostas aparecem (≤ limite);
--   * 1 primário sem resposta.
-- ============================================================================

INSERT INTO posts (id, author_id, category, content, status, view_count, utility_score, created_at) VALUES
  ('eeee0007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Gestão',
   'Testei dar autonomia total pro time por 30 dias: cada um decide o próprio horário desde que entregue. Produtividade subiu, mas o alinhamento caiu. Alguém já passou por isso e como equilibrou?',
   'APPROVED', 268, 88, now() - interval '30 minutes')
ON CONFLICT (id) DO NOTHING;

-- primários
INSERT INTO comments (id, post_id, author_id, content, parent_id, created_at) VALUES
  ('ffff0001-0000-0000-0000-000000000001', 'eeee0007-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'Passei por isso. Autonomia sem ritual de alinhamento vira bagunça. O que salvou foi manter UMA reunião curta de sincronização por semana.', NULL, now() - interval '28 minutes'),
  ('ffff0002-0000-0000-0000-000000000002', 'eeee0007-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', 'Autonomia é liberdade COM responsabilidade. Sem meta clara, vira só liberdade.', NULL, now() - interval '25 minutes'),
  ('ffff0003-0000-0000-0000-000000000003', 'eeee0007-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444444', 'Aqui funcionou porque cada entrega tem dono e prazo público. O resto é com a pessoa.', NULL, now() - interval '20 minutes')
ON CONFLICT (id) DO NOTHING;

-- 5 respostas do 1º primário (vão COLAPSAR)
INSERT INTO comments (id, post_id, author_id, content, parent_id, created_at) VALUES
  ('ffff0001-0000-0000-0000-0000000000a1', 'eeee0007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Faz sentido. Quanto tempo dura essa reunião de sincronização?', 'ffff0001-0000-0000-0000-000000000001', now() - interval '27 minutes'),
  ('ffff0001-0000-0000-0000-0000000000a2', 'eeee0007-0000-0000-0000-000000000007', '33333333-3333-3333-3333-333333333333', '15 min no máximo aqui, senão vira reunião pra marcar reunião.', 'ffff0001-0000-0000-0000-000000000001', now() - interval '26 minutes'),
  ('ffff0001-0000-0000-0000-0000000000a3', 'eeee0007-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444444', 'Concordo, e sempre no mesmo dia/hora pra virar hábito.', 'ffff0001-0000-0000-0000-000000000001', now() - interval '24 minutes'),
  ('ffff0001-0000-0000-0000-0000000000a4', 'eeee0007-0000-0000-0000-000000000007', '55555555-5555-5555-5555-555555555555', 'Nós fazemos assíncrona por texto. Cada um posta o status até 10h.', 'ffff0001-0000-0000-0000-000000000001', now() - interval '22 minutes'),
  ('ffff0001-0000-0000-0000-0000000000a5', 'eeee0007-0000-0000-0000-000000000007', '22222222-2222-2222-2222-222222222222', 'Boa, assíncrono escala melhor mesmo. Vou testar.', 'ffff0001-0000-0000-0000-000000000001', now() - interval '21 minutes')
ON CONFLICT (id) DO NOTHING;

-- 2 respostas do 2º primário (vão APARECER)
INSERT INTO comments (id, post_id, author_id, content, parent_id, created_at) VALUES
  ('ffff0002-0000-0000-0000-0000000000b1', 'eeee0007-0000-0000-0000-000000000007', '11111111-1111-1111-1111-111111111111', 'Isso. Meta primeiro, autonomia depois.', 'ffff0002-0000-0000-0000-000000000002', now() - interval '24 minutes'),
  ('ffff0002-0000-0000-0000-0000000000b2', 'eeee0007-0000-0000-0000-000000000007', '44444444-4444-4444-4444-444444444444', 'Exato, sem norte a liberdade dispersa.', 'ffff0002-0000-0000-0000-000000000002', now() - interval '23 minutes')
ON CONFLICT (id) DO NOTHING;

-- sincroniza contadores do post/comentários da demo
UPDATE posts SET comment_count = (SELECT count(*) FROM comments c WHERE c.post_id = posts.id)
WHERE id = 'eeee0007-0000-0000-0000-000000000007';
UPDATE comments c SET reply_count = (SELECT count(*) FROM comments r WHERE r.parent_id = c.id)
WHERE c.post_id = 'eeee0007-0000-0000-0000-000000000007';
