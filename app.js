import dotenv from 'dotenv'
import http from 'http'
import { App } from 'octokit'
import translate from '@tomsun28/google-translate-api'
import { createNodeMiddleware } from '@octokit/webhooks'

// Load environment variables from .env file
dotenv.config()

// Set configured values
const appId = process.env.APP_ID
// const privateKeyPath = process.env.PRIVATE_KEY_PATH
// const privateKey = fs.readFileSync(privateKeyPath, 'utf8')
const privateKey = process.env.PRIVATE_KEY;

const secret = process.env.WEBHOOK_SECRET
// const messageForNewPRs = fs.readFileSync('./message.md', 'utf8')

// Create an authenticated Octokit client authenticated as a GitHub App
const app = new App({
  appId,
  privateKey,
  webhooks: {
    secret
  },
})

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
  const translationLines = translation.split('\n').filter(line => line.trim() !== '');

  const quotedTranslation = translationLines.map(line => `> ${line}`).join('\n');

  return `${original.trim()}\n\n${quotedTranslation}`;
}

async function getTranslatedBodyWithOrigin(body) {
  let originBody = body;
  const translatedBody = await translateIssueOrigin(body);
  return combineWithTranslation(originBody, translatedBody);
}

// Optional: Get & log the authenticated app's name
const { data } = await app.octokit.request('/app')

// Read more about custom logging: https://github.com/octokit/core.js#logging
app.octokit.log.debug(`Authenticated as '${data.name}'`)

app.webhooks.on('issues.opened', async({octokit, payload}) => {
  const issueTitle = payload.issue.title;
  const body = payload.issue.body
  console.log('Received new issue opened', issueTitle, body);
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issue_number = payload.issue.number;
  const newTitle = await translateIssueOrigin(issueTitle) || issueTitle;

  const newBody = await getTranslatedBodyWithOrigin(body) || body;
  console.log('debugger translated content:', newTitle, newBody);
  await octokit.rest.issues.update({
    owner,
    repo,
    issue_number,
    title: newTitle,
    body: newBody,
  });
})

app.webhooks.on('issue_comment.created', async({octokit, payload}) => {
  console.log('Received new issue comment', payload.comment.body);
  const commentBody = payload.comment.body;
  const translatedBody = await translateIssueOrigin(commentBody)
  await octokit.rest.issues.createComment({
    owner: payload.repository.owner.login,
    repo: payload.repository.name,
    issue_number: payload.issue.number,
    body: translatedBody
  })
})

// Optional: Handle errors
app.webhooks.onError((error) => {
  if (error.name === 'AggregateError') {
    // Log Secret verification errors
    console.log(`Error processing request: ${error.event}`)
  } else {
    console.log(error)
  }
})

// Launch a web server to listen for GitHub webhooks
const port = process.env.PORT || 3000
const path = '/api/webhook'
const localWebhookUrl = `http://localhost:${port}${path}`

// See https://github.com/octokit/webhooks.js/#createnodemiddleware for all options
const middleware = createNodeMiddleware(app.webhooks, { path })

http.createServer(middleware).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`)
  console.log('Press Ctrl + C to quit.')
})
