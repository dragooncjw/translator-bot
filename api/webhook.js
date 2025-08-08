import { Webhooks } from "@octokit/webhooks";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import translate from '@tomsun28/google-translate-api'

export const config = {
  api: {
    bodyParser: false,
  },
};

async function translateIssueOrigin(body) {
  let result = ''
  await translate(body, {to: 'en'})
    .then(res => {
      console.log('translated en text', res)
      if (res.text !== body) {
        result = res.text
      }
    })
    .catch(err => {
      console.error(err.message);
    })
  return result || body
}

function combineWithTranslation(original, translation) {
  // 1. 用换行拆分翻译文本（假设每一段是一句或一条翻译）
  const translationLines = translation.split('\n').filter(line => line.trim() !== '');

  // 2. 拼接 Markdown 引用的翻译摘录
  const quotedTranslation = translationLines.map(line => `> ${line}`).join('\n');

  // 3. 拼接最终内容
  return `${original.trim()}\n\n${quotedTranslation}`;
}

async function getTranslatedBodyWithOrigin(body) {
  let originBody = body;
  const translatedBody = await translateIssueOrigin(body);
  return combineWithTranslation(originBody, translatedBody);
}

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }
  try {
    const sig = req.headers["x-hub-signature-256"];
    const event = req.headers["x-github-event"];
    const id = req.headers["x-github-delivery"];
    const rawBody = await getRawBody(req);

    res.status(200).send(`rawBody ${JSON.stringify(rawBody)}`);
    return;

  } catch (err) {
    console.error(err);
    res.status(500).send("Webhook error");
  }
}