/**
 * DGTL Worklog — user admin from the command line, for when nobody can get in.
 *
 *   npm run user -- list
 *   npm run user -- add   --email sam@dgtlgroup.io --name "Sam" [--role admin] [--password '…']
 *   npm run user -- reset --email sam@dgtlgroup.io [--password '…']
 *   npm run user -- role  --email sam@dgtlgroup.io --role admin
 *   npm run user -- off   --email sam@dgtlgroup.io      (deactivate + kill sessions)
 */

import crypto from 'node:crypto';
import { all, one, run } from '../server/db.mjs';
import { nowISO } from '../server/config.mjs';
import { hashPassword } from '../server/auth.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const flag = (n, dflt = null) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};

const email = (flag('email') || '').toLowerCase();
const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const find = () => one('SELECT * FROM users WHERE lower(email) = ?', email) || die(`No user ${email}`);
const newPassword = () => flag('password') || crypto.randomBytes(12).toString('base64url');

switch (cmd) {
  case 'list': {
    const rows = all('SELECT * FROM users ORDER BY active DESC, name');
    if (!rows.length) console.log('No users yet — run `npm run seed`.');
    for (const u of rows) {
      console.log(`${u.active ? ' ' : '×'} ${u.role.padEnd(6)} ${u.email.padEnd(32)} ${u.name}`);
    }
    break;
  }

  case 'add': {
    if (!email) die('--email is required');
    if (one('SELECT id FROM users WHERE lower(email) = ?', email)) die('That email is already in use');
    const password = newPassword();
    const now = nowISO();
    run(`INSERT INTO users (email, name, role, password_hash, daily_target_minutes, week_start, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 480, 1, 1, ?, ?)`,
      email, flag('name') || email.split('@')[0], flag('role') === 'admin' ? 'admin' : 'member',
      hashPassword(password), now, now);
    console.log(`✓ created ${email}\n  password  ${password}`);
    break;
  }

  case 'reset': {
    const u = find();
    const password = newPassword();
    run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(password), nowISO(), u.id);
    run('DELETE FROM sessions WHERE user_id = ?', u.id);   // old sessions die with the old password
    console.log(`✓ reset ${email}\n  password  ${password}`);
    break;
  }

  case 'role': {
    const u = find();
    const role = flag('role');
    if (!['admin', 'member'].includes(role)) die('--role must be admin or member');
    if (role === 'member' && u.role === 'admin'
      && one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id <> ?", u.id).n === 0) {
      die('That is the last active admin — promote someone else first');
    }
    run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', role, nowISO(), u.id);
    console.log(`✓ ${email} is now ${role}`);
    break;
  }

  case 'off': {
    const u = find();
    if (u.role === 'admin'
      && one("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1 AND id <> ?", u.id).n === 0) {
      die('That is the last active admin — promote someone else first');
    }
    run('UPDATE users SET active = 0, updated_at = ? WHERE id = ?', nowISO(), u.id);
    run('DELETE FROM sessions WHERE user_id = ?', u.id);
    console.log(`✓ deactivated ${email} (their logged hours are kept)`);
    break;
  }

  default:
    console.log(`Usage:
  npm run user -- list
  npm run user -- add   --email <e> [--name <n>] [--role admin|member] [--password <p>]
  npm run user -- reset --email <e> [--password <p>]
  npm run user -- role  --email <e> --role admin|member
  npm run user -- off   --email <e>`);
    process.exit(cmd ? 1 : 0);
}
