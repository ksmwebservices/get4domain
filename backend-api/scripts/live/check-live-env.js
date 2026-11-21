#!/usr/bin/env node
'use strict';
/**
 * Pre-flight check of the live environment (job L6): the same rules the live API applies at boot (src/common/startup-check.ts), run before you start it. Prints the NAME and the problem of each fault, never a
 * value. Exit 0 when the environment is fit, 1 when it is not.
 *
 *   node scripts/live/check-live-env.js           (export .env.live to the shell first; needs `npm run build`)
 */
const path = require('path');
const { checkLiveEnv } = require(path.join(__dirname, '..', '..', 'dist', 'src', 'common', 'startup-check'));

const problems = checkLiveEnv(process.env);
if (problems.length === 0) { console.log('The live environment is complete: no missing or placeholder variable, no staging or test database.'); process.exitCode = 0; }
else { console.error(`${problems.length} fault(s):\n${problems.map((p) => `  - ${p.name} ${p.problem}`).join('\n')}`); process.exitCode = 1; }
