#!/usr/bin/env node
/**
 * Écrit la spec OpenAPI agrégée (swagger-jsdoc) dans backend/docs/openapi.json.
 * À lancer depuis le répertoire backend : npm run openapi:json
 */
const fs = require('fs');
const path = require('path');

const spec = require('../src/lib/swagger');
const out = path.join(__dirname, '..', 'docs', 'openapi.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`);
// eslint-disable-next-line no-console
console.log('OpenAPI écrit :', out);
