import { App } from 'octokit';
import { createNodeMiddleware } from '@octokit/webhooks';
import translate from '@tomsun28/google-translate-api';

const app = new App({
  appId: process.env.APP_ID,
  privateKey: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  webhooks: { secret: process.env.WEBHOOK_SECRET },
});

app.webhooks.on('issues.opened', async ({ octokit, payload }) => {
  // const issueTitle = payload.issue.title;
  const issueBody = payload.issue.body;

  // const translatedTitle = await translate(issueTitle, { to: 'en' }).then(res => res.text).catch(() => issueTitle);
  // const translatedBody = await translate(issueBody, { to: 'en' }).then(res => res.text).catch(() => issueBody);

  await octokit.rest.issues.update({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    title: '这是一个新的 title',
    // body: `${issueBody}\n\n> ${translatedBody}`,
  });
});

app.webhooks.on('issue_comment.created', async ({ octokit, payload }) => {
  // const issueTitle = payload.issue.title;
  const issueBody = payload.issue.body;

  // const translatedTitle = await translate(issueTitle, { to: 'en' }).then(res => res.text).catch(() => issueTitle);
  // const translatedBody = await translate(issueBody, { to: 'en' }).then(res => res.text).catch(() => issueBody);

  await octokit.rest.issues.update({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    title: '这是一个新的 title',
    // body: `${issueBody}\n\n> ${translatedBody}`,
  });
});

const middleware = createNodeMiddleware(app.webhooks);

export default async function handler(req, res) {
  return middleware(req, res);
}
