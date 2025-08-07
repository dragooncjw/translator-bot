import { Probot, createNodeMiddleware } from "probot";

const app = new Probot();

// 注册事件监听
app.on("issues.opened", async (context) => {
  const issueTitle = context.payload.issue.title;
  console.log("New issue opened:", issueTitle);

  // 这里写你处理 issue.opened 的业务逻辑
  // 例如回复评论：
  // await context.octokit.issues.createComment(context.issue({ body: "Thanks for opening!" }));
});

// 把 probot app 包装成 node 中间件
const probotMiddleware = createNodeMiddleware(app, { path: "/" });

export default async function handler(req, res) {
  if (req.method === "POST") {
    // 交给 probot 中间件处理
    return probotMiddleware(req, res);
  } else {
    res.status(404).send("Not Found");
  }
}