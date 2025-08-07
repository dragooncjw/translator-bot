import { createProbot, createNodeMiddleware } from 'probot'
import appFn from '../app-probot';

const probot = createProbot();

export default createNodeMiddleware(appFn, { probot });