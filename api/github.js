import { createProbot, createNodeMiddleware } from 'probot';

import appFn from '../app-probot';

export function GET(request) {
  const probot = createProbot();
  createNodeMiddleware(appFn, { probot });
  return Response.json({
    message: 'ok'
  });
}