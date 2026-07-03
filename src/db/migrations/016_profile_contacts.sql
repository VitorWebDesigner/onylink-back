-- 016: contatos do perfil (decisão do dono, plano-perfil.md §5.1) — o botão
-- Contato do perfil abre sheet com até 3 opções: e-mail, WhatsApp e site.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_email    text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_whatsapp text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_url      text;
