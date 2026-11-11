import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
} from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../.postgres/', import.meta.url));
const data = path.join(root, 'data');
const command = process.argv[2];
if (!['start', 'stop'].includes(command))
  throw new Error('Usage: node scripts/local-postgres.js start|stop');
let bin = process.env.PG_BIN;
if (!bin) {
  const config = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8' });
  if (
    config.status === 0 &&
    existsSync(path.join(config.stdout.trim(), 'initdb'))
  )
    bin = config.stdout.trim();
}
if (!bin && existsSync('/usr/lib/postgresql')) {
  const versions = readdirSync('/usr/lib/postgresql').sort(
    (a, b) => Number(b) - Number(a),
  );
  bin = versions
    .map((version) => `/usr/lib/postgresql/${version}/bin`)
    .find((dir) => existsSync(path.join(dir, 'initdb')));
}
if (!bin)
  throw new Error(
    'PostgreSQL server binaries not found. Set PG_BIN or use docker compose up -d.',
  );
const run = (name, args) =>
  execFileSync(path.join(bin, name), args, { stdio: 'inherit' });
if (command === 'stop') {
  if (existsSync(path.join(data, 'postmaster.pid')))
    run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
  else console.log('Project PostgreSQL is already stopped.');
} else {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  if (!existsSync(path.join(data, 'PG_VERSION'))) {
    const password = path.join(root, 'init-password');
    writeFileSync(password, 'assessment_local\n', { mode: 0o600 });
    try {
      run('initdb', [
        '-D',
        data,
        '-U',
        'assessment',
        '--pwfile',
        password,
        '--auth=scram-sha-256',
        '--encoding=UTF8',
        '--locale=C',
      ]);
    } finally {
      unlinkSync(password);
    }
  }
  if (
    spawnSync(path.join(bin, 'pg_ctl'), ['-D', data, 'status']).status === 0
  ) {
    console.log('Project PostgreSQL is already running.');
  } else {
    run('pg_ctl', [
      '-D',
      data,
      '-l',
      path.join(root, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p 55432 -k ${root}`,
      '-w',
      'start',
    ]);
  }
  console.log(
    'Project PostgreSQL is available on 127.0.0.1:55432. Run npm run db:setup next.',
  );
}
