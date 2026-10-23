import { timingSafeEqual } from 'node:crypto';

export function adminBoundary(env = process.env) {
  const username = env.GAME_ADMIN_USERNAME || '';
  const password = env.GAME_ADMIN_PASSWORD || '';
  let origin = '';
  try {
    const url = new URL(env.GAME_PUBLIC_ORIGIN || '');
    if (url.protocol === 'https:' && !url.username && !url.password && url.href === `${url.origin}/`) origin = url.origin;
  } catch { /* fail closed */ }
  const configured = username && !username.includes(':') && password.trim().length >= 32 && origin;
  const expected = Buffer.from(`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`);
  return (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY' });
    if (!configured) return res.status(503).json({ error: 'Security configuration required' });
    const actual = Buffer.from(req.get('Authorization') || '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      res.set('WWW-Authenticate', 'Basic realm="Game administration", charset="UTF-8"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('Origin') !== origin) {
      return res.status(403).json({ error: 'Forbidden origin' });
    }
    next();
  };
}

export function installEvaluationRoutes(app, { spawn, scriptPath, now = Date.now }) {
  let running = false, lastStarted = -Infinity, day = Math.floor(now() / 86400000), count = 0;
  app.post('/api/run-evaluation', (_req, res) => {
    const currentDay = Math.floor(now() / 86400000);
    if (currentDay !== day) { day = currentDay; count = 0; }
    if (running) return res.status(409).json({ success: false, error: 'Evaluation is already running' });
    if (now() - lastStarted < 600000 || count >= 10) return res.status(429).json({ success: false, error: 'Evaluation request limit reached' });
    running = true; lastStarted = now(); count++;
    try {
      const child = spawn(process.execPath, [scriptPath], { detached: false, stdio: 'inherit' });
      let finished = false;
      const finish = () => { if (!finished) { finished = true; running = false; } };
      child.once('exit', finish);
      child.once('error', finish);
      return res.json({ success: true, message: 'Evaluation process started', status: 'running' });
    } catch {
      running = false;
      return res.status(500).json({ success: false, error: 'Could not start evaluation' });
    }
  });
  app.get('/api/evaluation-status', (_req, res) => res.json({ success: true, is_running: running,
    timestamp: new Date(now()).toISOString() }));
}
