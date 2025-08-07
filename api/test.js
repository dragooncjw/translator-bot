import translate from '@tomsun28/google-translate-api';

import { Probot } from "probot";

const app = new Probot({
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"), // 注意处理换行
  secret: process.env.WEBHOOK_SECRET,
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
    app.log.error(err);
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

// 监听 issues.opened 事件
app.on('issues.opened', async (context) => {
  const payload = context.payload;
  const issueTitle = payload.issue.title;
  const body = payload.issue.body;

  app.log.info('Received new issue opened', issueTitle);

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issue_number = payload.issue.number;

  const newTitle = (await translateIssueOrigin(issueTitle)) || issueTitle;
  const newBody = (await getTranslatedBodyWithOrigin(body)) || body;

  app.log.debug('Translated content:', newTitle, newBody);

  await context.octokit.rest.issues.update({
    owner,
    repo,
    issue_number,
    title: newTitle,
    body: newBody,
  });
});

// 监听 issue_comment.created 事件
app.on('issue_comment.created', async (context) => {
  const payload = context.payload;
  const commentBody = payload.comment.body;

  app.log.info('Received new issue comment', commentBody);

  const translatedBody = await translateIssueOrigin(commentBody);

  await context.octokit.rest.issues.createComment({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    body: translatedBody,
  });
});

// 错误处理
app.on('error', (error) => {
  if (error.name === 'AggregateError') {
    app.log.error(`Error processing request: ${error.event}`);
  } else {
    app.log.error(error);
  }
});

export function GET() {
  return Response.json({
    message:'ok'
  })
}

export async function POST(request) {
  const body = await request.text(); // 读取原始文本
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");
  const deliveryId = request.headers.get("x-github-delivery");
  const webhookSecret = process.env.WEBHOOK_SECRET;

  // 校验签名
  const crypto = await import("crypto");
  const hmac = crypto.createHmac("sha256", webhookSecret);
  hmac.update(body);
  const digest = "sha256=" + hmac.digest("hex");
  if (signature !== digest) {
    return new Response("Invalid signature", { status: 401 });
  }

  // 解析 JSON payload
  const payload = JSON.parse(body);

  // 用 Probot 处理事件
  await app.receive({
    id: deliveryId,
    name: event,
    payload,
  });

  return new Response("OK", { status: 200 });
}