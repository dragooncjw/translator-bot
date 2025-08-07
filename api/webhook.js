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

// 3. 注册事件
webhooks.on('issues.opened', async ({ octokit, payload }) => {
  const issueBody = payload.issue.body;

  await octokit.rest.issues.update({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    title: '这是一个新的 title',
  });
});

webhooks.on('issue_comment.created', async ({ octokit, payload }) => {
  const issueBody = payload.issue.body;

  await octokit.rest.issues.update({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    title: '这是一个新的 title',
  });
});

// 4. 处理 Vercel 的 HTTP 请求
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const signature = req.headers['x-hub-signature-256'];
    const id = req.headers['x-github-delivery'];
    const name = req.headers['x-github-event'];

    await webhooks.verifyAndReceive({
      id,
      name,
      signature,
      payload: req.body,
    });

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
