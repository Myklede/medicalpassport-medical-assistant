import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const expectedRemote = 'https://github.com/Myklede/medipass-medical-assistant-demo.git';
const [major, minor] = process.versions.node.split('.').map(Number);
assert.ok(major > 22 || (major === 22 && minor >= 13), `Node 22.13+ required; found ${process.versions.node}`);

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout.trim();
}
function run(label, command, args) {
  console.log(`\n[check] ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) process.exit(result.status || 1);
}

assert.equal(capture('git', ['remote', 'get-url', 'origin']), expectedRemote, 'origin points at an unexpected repository');
const checkpointPaths = new Set([
  'outputs/pwc-run/best.pt',
  'outputs/pwc-visual-run/best.pt',
  'outputs/wound_unet_fusd.pt',
]);
const generatedTracked = capture('git', ['ls-files', '--', '.env.local', 'dist', 'outputs', '.wrangler'])
  .split(/\r?\n/)
  .filter(Boolean);
const forbiddenTracked = generatedTracked.filter(file => !checkpointPaths.has(file));
assert.deepEqual(forbiddenTracked, [], `Generated/private files are tracked:\n${forbiddenTracked.join('\n')}`);
for (const checkpoint of checkpointPaths) {
  assert.ok(generatedTracked.includes(checkpoint), `Required checkpoint is not tracked: ${checkpoint}`);
  assert.match(
    capture('git', ['check-attr', 'filter', '--', checkpoint]),
    /: filter: lfs$/,
    `Checkpoint must use Git LFS: ${checkpoint}`,
  );
  assert.match(
    capture('git', ['show', `:${checkpoint}`]),
    /^version https:\/\/git-lfs\.github\.com\/spec\/v1\r?\noid sha256:[a-f0-9]{64}\r?\nsize [1-9][0-9]*$/,
    `Checkpoint index entry is not a valid Git LFS pointer: ${checkpoint}`,
  );
}

const tracked = capture('git', ['ls-files', '-z']).split('\0').filter(Boolean);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsb_secret_[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /(?:SUPABASE_SECRET_KEY|OPENAI_API_KEY|GITHUB_TOKEN)\s*=\s*["']?(?!your-|replace-|example|<)[A-Za-z0-9_.-]{20,}/,
];
const suspicious = [];
for (const file of tracked) {
  let data;
  try { data = readFileSync(resolve(file)); } catch { continue; }
  if (data.length > 5_000_000 || data.includes(0)) continue;
  const text = data.toString('utf8');
  if (secretPatterns.some(pattern => pattern.test(text))) suspicious.push(file);
}
assert.deepEqual(suspicious, [], `Possible secrets found in tracked files: ${suspicious.join(', ')}`);

run('Git whitespace and patch integrity', 'git', ['diff', '--check', 'HEAD']);
run('TypeScript', process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
run('Portal, IPS, medication and wound unit tests', process.execPath, ['--test', 'tests/portal.test.ts', 'tests/ips-export.test.ts', 'tests/medication-exchange.test.ts', 'tests/wound-safety.test.ts', 'tests/wound-api.test.ts']);
run('Production build', process.execPath, ['node_modules/vinext/dist/cli.js', 'build']);

console.log(`\nREADY TO PUSH\nRemote: ${expectedRemote}\nBranch: ${capture('git', ['branch', '--show-current'])}`);
