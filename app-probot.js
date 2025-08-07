import translate from '@tomsun28/google-translate-api';

export default (app) => {
  // 翻译函数
  async function translateIssueOrigin(body) {
    let result = '';
    try {
      const res = await translate(body, { to: 'en' });
      console.log('translated en text', res);
      if (res.text !== body) {
        result = res.text;
      }
    } catch (err) {
      app.log.error(err);
    }
    return result;
  }

  function combineWithTranslation(original, translation) {
    const translationLines = translation
      .split('\n')
      .filter((line) => line.trim() !== '');

    const quotedTranslation = translationLines
      .map((line) => `> ${line}`)
      .join('\n');

    return `${original.trim()}\n\n${quotedTranslation}`;
  }

  async function getTranslatedBodyWithOrigin(body) {
    const originBody = body;
    const translatedBody = await translateIssueOrigin(body);
    return combineWithTranslation(originBody, translatedBody);
  }

  // 监听 issues.opened 事件
  app.on('issues.opened', async (context) => {
    const payload = context.payload;
    const issueTitle = payload.issue.title;
    const body = payload.issue.body;

    app.log.info('Received new issue opened', issueTitle);

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const issue_number = payload.issue.number;

    const newTitle = (await translateIssueOrigin(issueTitle)) || issueTitle;
    const newBody = (await getTranslatedBodyWithOrigin(body)) || body;

    app.log.debug('Translated content:', newTitle, newBody);

    await context.octokit.rest.issues.update({
      owner,
      repo,
      issue_number,
      title: newTitle,
      body: newBody,
    });
  });

  // 监听 issue_comment.created 事件
  app.on('issue_comment.created', async (context) => {
    const payload = context.payload;
    const commentBody = payload.comment.body;

    app.log.info('Received new issue comment', commentBody);

    const translatedBody = await translateIssueOrigin(commentBody);

    await context.octokit.rest.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.issue.number,
      body: translatedBody,
    });
  });

  // 错误处理
  app.on('error', (error) => {
    if (error.name === 'AggregateError') {
      app.log.error(`Error processing request: ${error.event}`);
    } else {
      app.log.error(error);
    }
  });
};
