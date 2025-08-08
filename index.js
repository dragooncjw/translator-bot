const express = require('express');
const { Webhooks } = require('@octokit/webhooks');
const app = express();
const port = process.env.PORT || 3000;

// 初始化 GitHub Webhook
const webhooks = new Webhooks({
  secret: process.env.GITHUB_WEBHOOK_SECRET || 'development-secret'
});

// 处理 ping 事件
webhooks.on('ping', ({ id, name, payload }) => {
  console.log(`Received ping event: ${id}`);
});

// 处理 issues 事件
webhooks.on('issues.opened', async ({ id, name, payload }) => {
  console.log(`Received issues.opened event: ${id}`);
  console.log(`Issue title: ${payload.issue.title}`);
});

// 配置 Express 路由
app.use(express.json());

// GitHub Webhook 端点
app.post('/api/github/webhook', webhooks.middleware);

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// 启动服务器
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});