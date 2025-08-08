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
      core.error(err)
      core.setFailed(err.message)
    })
  return result
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

      const newTitle = await translateIssueOrigin(issueTitle) || issueTitle;
      const newBody = await getTranslatedBodyWithOrigin(body) || body;

      console.log('debugger translated content:', newTitle, newBody);
      await octokit.issues.update({
        owner,
        repo,
        issue_number,
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
      const translatedBody = await translateIssueOrigin(commentBody)

      // 2. 调用 GitHub API 修改标题
      const octokit = new Octokit({ auth: installationAuthentication.token });
      await octokit.rest.issues.createComment({
        owner: payload.repository.owner.login,
        repo: payload.repository.name,
        issue_number: payload.issue.number,
        body: translatedBody
      })
    });

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