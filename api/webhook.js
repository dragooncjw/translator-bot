// 文件位置：/api/webhook.js（或 webhook.ts）

import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";

const webhooks = new Webhooks({
  secret: process.env.WEBHOOK_SECRET, // 你的 GitHub App webhook secret
});

webhooks.on("issues.opened", ({ payload }) => {
  console.log("Issue opened:", payload.issue.title);
});

export const config = {
  api: {
    bodyParser: false, // ⚠️ 禁止自动解析请求体，保留原始 Buffer
  },
};

export default createNodeMiddleware(webhooks);
