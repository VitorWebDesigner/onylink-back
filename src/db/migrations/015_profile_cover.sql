-- 015: capa do perfil + garante linha em profiles p/ todo usuário existente
-- (updateProfile é UPDATE puro — sem a linha, salvar perfil viraria no-op).
-- avatar_path/cover_path guardam a URL PÚBLICA da CDN (o upload já devolve `url`;
-- todos os SELECTs de avatar espalhados nos módulos funcionam sem conversão).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_path text;

INSERT INTO profiles (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
