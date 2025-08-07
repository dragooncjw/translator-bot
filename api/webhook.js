import { Webhooks } from "@octokit/webhooks";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import translate from '@tomsun28/google-translate-api'

export const config = {
  api: {
    bodyParser: false,
  },
};

const startMarker = '<!-- bot-translation-start -->';

const suggestionTxt = '> This text is auto-translated:';

const endMarker = '<!-- bot-translation-end -->';

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
  return `${original.trim()}\n\n${startMarker}\n${suggestionTxt}\n${quotedTranslation}\n${endMarker}`;
}

async function retranslateIssue(body) {
  const lines = body.split(/\r?\n/);

  // 1. 找到 bot 翻译部分
  const startIdx = lines.findIndex(line => line.trim() === startMarker);
  const endIdx = lines.findIndex(line => line.trim() === endMarker);

  let originalText;

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    // 2. 提取原文（bot 翻译前的所有内容）
    const before = lines.slice(0, startIdx);
    const after = lines.slice(endIdx + 1);
    originalText = [...before, ...after].join('\n').trim();
  } else {
    // 如果没有找到 bot 翻译部分，就认为整个 body 都是原文
    originalText = body.trim();
  }

  // 3. 调用翻译 API
  const translatedText = await translateIssueOrigin(originalText);

  // 4. 生成新的翻译块
  const markdownTranslated = translatedText
    .split(/\r?\n/)
    .map(line => `> ${line}`)
    .join('\n');

  const newBody = [
    originalText,
    '',
    startMarker,
    suggestionTxt,
    markdownTranslated,
    endMarker
  ].join('\n');

  return newBody;
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

    const objBody = JSON.parse(rawBody);

    // 机器人的回复不要翻译
    if (objBody?.comment?.user?.login === 'flowgram-translator-bot[bot]') {
      res.status(200).send("only translate user txt");
      return;
    }

    if (objBody?.sender?.login === 'flowgram-translator-bot[bot]') {
      res.status(200).send("only translate user txt");
      return;
    }

    if (event !== 'issues' && event !== 'issue_comment') {
      // 除了 issues 以外的 webhook 都返回成功
      res.status(200).send("not issue, received");
      return;
    }

    const webhooks = new Webhooks({
      secret: process.env.WEBHOOK_SECRET,
    });

    // 监听 issue 事件并修改
    webhooks.on("issues.opened", async ({ payload }) => {
      const issueTitle = payload.issue.title;
      const body = payload.issue.body
      console.log(`Issue opened: ${payload.issue.title}`);

      // 1. 获取 installation token
      const auth = createAppAuth({
        appId: process.env.APP_ID,
        privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"), // Vercel 会自动转义换行
        installationId: payload.installation.id,
      });
      const installationAuthentication = await auth({ type: "installation" });

      // 2. 调用 GitHub API 修改标题
      const octokit = new Octokit({ auth: installationAuthentication.token });

      const newTitle = await translateIssueOrigin(issueTitle);
      const newBody = await getTranslatedBodyWithOrigin(body) || body;

      console.log('debugger translated content:', newTitle, newBody);
      await octokit.rest.issues.update({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        title: newTitle,
        body: newBody,
      });
    });

    webhooks.on("issue_comment.created", async ({ payload }) => {
      console.log('Received new issue comment', payload.comment.body);

      // 1. 获取 installation token
      const auth = createAppAuth({
        appId: process.env.APP_ID,
        privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"), // Vercel 会自动转义换行
        installationId: payload.installation.id,
      });
      const installationAuthentication = await auth({ type: "installation" });

      const commentBody = payload.comment.body;
      const translatedBody = await getTranslatedBodyWithOrigin(commentBody)

      // 2. 调用 GitHub API 修改标题
      const octokit = new Octokit({ auth: installationAuthentication.token });
      // await octokit.rest.issues.createComment({
      //   owner: payload.repository.owner.login,
      //   repo: payload.repository.name,
      //   issue_number: payload.issue.number,
      //   body: translatedBody
      // })
      // 更新同一条 comment（需要 token 有权限）
      await octokit.rest.issues.updateComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        comment_id: payload.comment.id,
        body: translatedBody,
      });
    });

    webhooks.on("issues.edited", async ({payload}) => {
      const issueTitle = payload.issue.title;
      const issueBody = payload.issue.body;

      // 1. 获取 installation token
      const auth = createAppAuth({
        appId: process.env.APP_ID,
        privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"), // Vercel 会自动转义换行
        installationId: payload.installation.id,
      });
      const installationAuthentication = await auth({ type: "installation" });

      // 2. 调用 GitHub API 修改标题
      const octokit = new Octokit({ auth: installationAuthentication.token });

      const newTitle = await translateIssueOrigin(issueTitle);
      const newBody = await retranslateIssue(issueBody) || issueBody;

      await octokit.rest.issues.update({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        title: newTitle,
        body: newBody,
      });
    })

    webhooks.on("issue_comment.edited", async ({payload}) => {
      // 1. 获取 installation token
      const auth = createAppAuth({
        appId: process.env.APP_ID,
        privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, "\n"), // Vercel 会自动转义换行
        installationId: payload.installation.id,
      });
      const installationAuthentication = await auth({ type: "installation" });

      // 2. 调用 GitHub API 修改标题
      const octokit = new Octokit({ auth: installationAuthentication.token });

      const commentBody = payload.comment.body;
      const translatedBody = await retranslateIssue(commentBody)

      await octokit.rest.issues.updateComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        comment_id: payload.comment.id,
        body: translatedBody,
      });
    })

    await webhooks.verifyAndReceive({
      id,
      name: event,
      signature: sig,
      payload: rawBody, // 传入原始字符串
    });

    res.status(200).send("Event received");
  } catch (err) {
    console.error(err);
    res.status(500).send("Webhook error");
  }
}