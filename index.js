import getRawBody from "raw-body";

import { Webhooks } from "@octokit/webhooks";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";

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
  await octokit.issues.update({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    title: `[BOT] ${payload.issue.title}`,
  });
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }
  try {
    const rawBody = (await getRawBody(req)).toString(); // 拿到原始请求体字符串

    const sig = req.headers["x-hub-signature-256"];
    const event = req.headers["x-github-event"];
    const id = req.headers["x-github-delivery"];

    await webhooks.verifyAndReceive({
      id,
      name: event,
      signature: sig,
      payload: JSON.parse(rawBody),  // 解析后的对象
    });

    res.status(200).send("Event received");
  } catch (err) {
    console.error(err);
    res.status(500).send("Webhook error");
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
