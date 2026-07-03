import { query } from '../db';
import { logger } from '../logger';
import { uploadObject } from './bunny';
import { createCollection } from './bunnyStream';
import { rootKeepPath } from './paths';

/**
 * Provisiona a pasta-raiz de mídia do usuário no cadastro:
 *  - Storage: sobe um placeholder que RESERVA a pasta `users/{mediaRoot}/`;
 *  - Stream:  cria a COLEÇÃO do usuário e guarda o id em users.stream_collection_id.
 * BEST-EFFORT: qualquer falha na Bunny só loga (nunca derruba o cadastro); as
 * subpastas materializam no 1º upload de cada tipo.
 */
export async function provisionUserMedia(userId: string, mediaRoot: string): Promise<void> {
  try {
    const readme = Buffer.from(
      `OnyLink — pasta de mídia de ${mediaRoot}\n` +
        `Subpastas: profile/ posts/ comments/ opportunities/ stories/ messages/\n`,
      'utf8',
    );
    await uploadObject(rootKeepPath(mediaRoot), readme, 'text/plain');
  } catch (err) {
    logger.warn({ err, mediaRoot }, 'provision: pasta de Storage falhou (materializa no 1º upload)');
  }

  try {
    const collectionId = await createCollection(mediaRoot);
    await query('UPDATE users SET stream_collection_id = $2 WHERE id = $1', [userId, collectionId]);
  } catch (err) {
    logger.warn({ err, mediaRoot }, 'provision: coleção do Stream falhou (cria no 1º vídeo)');
  }
}
