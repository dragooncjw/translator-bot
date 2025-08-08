// api/webhook.js
import { Webhooks } from "@octokit/webhooks";

const webhooks = new Webhooks({
  secret: process.env.WEBHOOK_SECRET, // GitHub App webhook secret
});

// 监听 issue 创建、标题修改
webhooks.on(["issues.opened", "issues.edited"], async ({ id, name, payload }) => {
  console.log(`Received ${name} event with id=${id}`);
  console.log(`Issue title: ${payload.issue.title}`);
  console.log(`Action: ${payload.action}`);
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK"); // 健康检查
  }

  try {
    const sig = req.headers["x-hub-signature-256"];
    const event = req.headers["x-github-event"];
    const id = req.headers["x-github-delivery"];

    // 处理 Webhook
    await webhooks.verifyAndReceive({
      id,
      name: event,
      signature: sig,
      payload: req.body, // 这里是 raw body
    });

    res.status(200).send("Event received");
  } catch (err) {
    console.error(err);
    res.status(500).send("Webhook error");
  }
}

// Vercel 需要 raw body，否则签名校验会失败
export const config = {
  api: {
    bodyParser: false,
  },
};
