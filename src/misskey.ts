import { config } from './config.js';
import { MisskeyNoteRequest } from './types.js';
import { ansi } from './logger.js';

export async function postToMisskey(text: string, cw?: string, renoteId?: string): Promise<string | null> {
  if (!config.misskeyToken) {
    console.log(`${ansi.yellow}[Misskey Dry-Run] Token missing. Note would have been posted:${ansi.reset}`);
    console.log(`${ansi.dim}--- Note Content (Visibility: ${config.misskeyVisibility}) ---${ansi.reset}`);
    if (cw) console.log(`${ansi.bold}[CW]: ${cw}${ansi.reset}`);
    if (renoteId) console.log(`${ansi.bold}[Renote Target ID]: ${renoteId}${ansi.reset}`);
    console.log(text);
    console.log(`${ansi.dim}---------------------------------------------------------${ansi.reset}`);
    return `dryrun_${Date.now()}`;
  }

  const endpoint = `${config.misskeyOrigin}/api/notes/create`;
  const payload: MisskeyNoteRequest = {
    i: config.misskeyToken,
    text,
    visibility: config.misskeyVisibility,
  };

  if (cw) {
    payload.cw = cw;
  }

  if (renoteId) {
    payload.renoteId = renoteId;
  }

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const createdId = data.createdNote?.id || null;
        console.log(`${ansi.green}${ansi.bold}[Misskey] Note posted successfully (ID: ${createdId || 'ok'})${ansi.reset}`);
        return createdId;
      } else {
        const errorText = await response.text();
        console.error(`${ansi.red}${ansi.bold}[Misskey Error] Status ${response.status} (Attempt ${attempt}/${maxRetries}): ${errorText}${ansi.reset}`);
      }
    } catch (err) {
      console.error(`${ansi.red}[Misskey Network Error] Attempt ${attempt}/${maxRetries}:${ansi.reset}`, err);
    }

    if (attempt < maxRetries) {
      const backoffMs = attempt * 2000;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  console.error(`${ansi.bold}${ansi.red}[Misskey] Failed to post note after maximum retries.${ansi.reset}`);
  return null;
}
