'use strict';
/** Prompts for the live scripts: a visible one, and one that does not echo what is typed (a connection string or a password). Both need a terminal. */
const readline = require('readline');

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

function askSecret(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    const write = rl._writeToOutput;
    rl._writeToOutput = function (s) { if (!muted) write.call(rl, s); };
    process.stdout.write(question);
    muted = true;
    rl.question('', (answer) => { muted = false; process.stdout.write('\n'); rl.close(); resolve(answer); });
  });
}

module.exports = { ask, askSecret };
