const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Load config
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const PORT = config.port;
const TARGET = config.target;

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

app.use(session({
  secret: 'replace-this-secret',
  resave: false,
  saveUninitialized: true,
}));

// Show login form
app.get('/auth/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle login POST
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.redirect('/auth/login');

  const authHeader = Buffer.from(`${username}:${password}`).toString('base64');
  req.session.authHeader = authHeader;
  res.redirect('/');
});

// Handle logout
app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

// Proxy everything else with auth
app.use((req, res, next) => {
  if (req.path.startsWith('/auth')) return next();

  if (!req.session.authHeader) return res.redirect('/auth/login');

  return createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader('Authorization', `Basic ${req.session.authHeader}`);
    },
    onProxyRes: (proxyRes) => {
      // Prevent browser popup by removing the "WWW-Authenticate" header
      delete proxyRes.headers['www-authenticate'];
    }
  })(req, res, next);
});

app.listen(PORT, () => {
  console.log(`Auth wrapper running at http://localhost:${PORT}`);
});
