import { App } from 'octokit';
import { createNodeMiddleware } from '@octokit/webhooks';
import translate from '@tomsun28/google-translate-api';

const appId = process.env.APP_ID;
const privateKey = process.env.PRIVATE_KEY.replace(/\\n/g, '\n');
const secret = process.env.WEBHOOK_SECRET;

const app = new App({
  appId,
  privateKey,
  webhooks: {
    secret
  },
});

app.webhooks.on('issues.opened', async ({ octokit, payload }) => {
  const issueTitle = payload.issue.title;
  const body = payload.issue.body;

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issue_number = payload.issue.number;

  // 你的翻译函数
  async function translateIssueOrigin(text) {
    try {
      const res = await translate(text, { to: 'en' });
      return res.text !== text ? res.text : text;
    } catch (e) {
      console.error(e);
      return text;
    }
  }

  const newTitle = await translateIssueOrigin(issueTitle);
  const newBody = body ? await translateIssueOrigin(body) : body;

  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number,
    title: newTitle,
    body: newBody,
  });
});

app.webhooks.on('issue_comment.created', async ({ octokit, payload }) => {
  const commentBody = payload.comment.body;
  const translatedBody = await translateIssueOrigin(commentBody);

  await octokit.rest.issues.createComment({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    body: translatedBody,
  });
});

// 使用 createNodeMiddleware 包装 webhooks handler
const middleware = createNodeMiddleware(app.webhooks, {
  path: '/api/webhook', // 这里和你的文件路径保持一致
});

export async function POST(req, res) {
  // Vercel 默认把请求和响应对象传进来，直接调用 middleware
  return middleware(req, res);
}

export async function GET(req, res) {
  // 简单响应，方便测试
  res.status(200).json({ message: 'ok' });
}
