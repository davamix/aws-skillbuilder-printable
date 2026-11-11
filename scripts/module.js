// One-shot workflow: extract the given modules, then build + check everything.
//
// Usage: npm run module -- <modules> [--course <slug>] [--allow-start] [--verbose]
//   <modules>: 1 | 1,3 | 2-5 | all
// Exit codes: 0 OK · 2 built, issues to review · 3 session expired (npm run login)
//             4 "Not started" modules need --allow-start (ask the user first) · 1 error
const path = require('path');
const { spawnSync } = require('child_process');
const { parseArgs } = require('../src/args');

const argv = process.argv.slice(2);
const args = parseArgs(argv);
const run = (script, a) => spawnSync(process.execPath, [path.join(__dirname, script), ...a], { stdio: 'inherit' }).status;

const extractCode = run('extract-module.js', argv.filter((a) => a !== '--verbose'));
if (extractCode !== 0) process.exit(extractCode ?? 1);

const buildArgs = [];
if (args.course) buildArgs.push('--course', args.course);
if (args.verbose) buildArgs.push('--verbose');
console.log('');
process.exit(run('build.js', buildArgs) ?? 1);
