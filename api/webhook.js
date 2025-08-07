// api/webhook.js
import { App } from 'octokit';
import { Webhooks } from '@octokit/webhooks';
import translate from '@tomsun28/google-translate-api';

// 1. 初始化 webhooks
const webhooks = new Webhooks({
  secret: process.env.WEBHOOK_SECRET,
});

// 2. 初始化 App（用于发起 API 请求）
const app = new App({
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  webhooks,
});

// 翻译函数
async function translateIssueOrigin(body) {
  let result = '';
  try {
    const res = await translate(body, { to: 'en' });
    console.log('translated en text', res);
    if (res.text !== body) {
      result = res.text;
    }
  } catch (err) {
    console.error('Translation error:', err);
  }
  return result;
}

function combineWithTranslation(original, translation) {
  const translationLines = translation
    .split('\n')
    .filter((line) => line.trim() !== '');

  const quotedTranslation = translationLines
    .map((line) => `> ${line}`)
    .join('\n');

  return `${original.trim()}\n\n${quotedTranslation}`;
}

async function getTranslatedBodyWithOrigin(body) {
  const originBody = body;
  const translatedBody = await translateIssueOrigin(body);
  return combineWithTranslation(originBody, translatedBody);
}

// 3. 注册事件
webhooks.on('issues.opened', async ({ octokit, payload }) => {
  console.log('Received issues.opened event', {
    repo: payload.repository.full_name,
    issue: payload.issue.number,
    title: payload.issue.title
  });

  const issueTitle = payload.issue.title;
  const body = payload.issue.body || '';

  const newTitle = (await translateIssueOrigin(issueTitle)) || issueTitle;
  const newBody = (await getTranslatedBodyWithOrigin(body)) || body;

  console.log('Translated content:', {
    title: newTitle,
    bodyLength: newBody.length
  });

  await octokit.rest.issues.update({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    title: newTitle,
    body: newBody
  });
});

webhooks.on('issue_comment.created', async ({ octokit, payload }) => {
  console.log('Received issue_comment.created event', {
    repo: payload.repository.full_name,
    issue: payload.issue.number,
    comment: payload.comment.id
  });

  const commentBody = payload.comment.body;
  const translatedBody = await translateIssueOrigin(commentBody);

  if (translatedBody) {
    await octokit.rest.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: translatedBody,
    });
  }
});

// 4. 处理 Vercel 的 HTTP 请求
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  console.log("Received webhook request", {
    method: req.method,
    headers: {
      "x-github-event": req.headers["x-github-event"],
      "x-github-delivery": req.headers["x-github-delivery"],
      "content-type": req.headers["content-type"],
    },
    body: typeof req.body === 'object' ? `Object with ${Object.keys(req.body).length} keys` : typeof req.body,
  });

  try {
    const signature = req.headers['x-hub-signature-256'];
    const id = req.headers['x-github-delivery'];
    const name = req.headers['x-github-event'];

    if (!signature || !id || !name) {
      console.error('Missing required headers:', {
        signature: !!signature,
        id: !!id,
        name: !!name
      });
      return res.status(400).end('Missing required headers');
    }

    await webhooks.verifyAndReceive({
      id,
      name,
      signature,
      payload: req.body,
    });

    console.log(`Successfully processed ${name} event with ID ${id}`);
    res.status(200).end('ok');
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).end('Invalid signature or error');
  }
}

// 5. 开启 JSON body 解析（必要）
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
