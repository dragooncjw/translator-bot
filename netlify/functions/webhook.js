import { Webhooks } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";

// 初始化 Webhooks 实例，绑定 Secret 用于验签
const webhooks = new Webhooks({
  secret: process.env.WEBHOOK_SECRET,
});

// 监听 issues.opened 事件，调用 GitHub API 修改 issue 标题
webhooks.on("issues.opened", async ({ payload }) => {
  console.log(`Issue opened: ${payload.issue.title}`);

  // 使用安装令牌认证调用 GitHub API（这里简化为使用 app token）
  // 如果你是 GitHub App 需要用 installation token，这里是示例简化版本
  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN, // 你的 Personal Access Token
  });

  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issue_number = payload.issue.number;

  // 修改 issue 标题，加上 [BOT] 前缀
  const newTitle = `[BOT] ${payload.issue.title}`;

  try {
    await octokit.issues.update({
      owner,
      repo,
      issue_number,
      title: newTitle,
    });
    console.log("Issue title updated successfully");
  } catch (error) {
    console.error("Failed to update issue title:", error);
  }
});

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 200,
      body: "Only POST requests are accepted",
    };
  }

  try {
    await webhooks.verifyAndReceive({
      id: event.headers["x-github-delivery"],
      name: event.headers["x-github-event"],
      signature: event.headers["x-hub-signature-256"],
      payload: JSON.parse(event.body),
    });
    return {
      statusCode: 200,
      body: "Webhook received and verified",
    };
  } catch (error) {
    console.error("Webhook verification failed:", error);
    return {
      statusCode: 401,
      body: "Webhook signature verification failed",
    };
  }
}
