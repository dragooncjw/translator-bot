const { createProbot, createNodeMiddleware } = require('probot');
const appFn = require('./app-probot');

const probot = createProbot();

module.exports = createNodeMiddleware(appFn, { probot });