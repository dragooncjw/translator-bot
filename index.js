const express = require('express');
const app = express();

// 中间件
app.use(express.json());

// 路由
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString() 
  });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Vercel!' });
});

// 404 处理
app.all('*', (req, res) => {
  res.status(404).json({ status: 'not found' });
});

// 关键：导出应用实例，不要使用 app.listen()
module.exports = app;
    