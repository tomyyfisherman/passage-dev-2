require('dotenv').config();

const path = require('node:path');
const express = require('express');

if (!process.env.JWT_SECRET) {
  console.error('Erreur : la variable d\'environnement JWT_SECRET est manquante (voir .env.example).');
  process.exit(1);
}

const db = require('./db');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');

const app = express();

app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

app.use(express.static(path.join(__dirname, '..', '..', 'public')));

// 404 pour les routes API inconnues
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route API introuvable.' });
});

// gestionnaire d'erreurs générique (JSON malformé, etc.)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'Erreur serveur inattendue.' });
});

const PORT = process.env.PORT || 3000;

db.ready
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur http://localhost:${PORT} (base de données : ${db.isPostgres ? 'PostgreSQL' : 'SQLite'})`);
    });
  })
  .catch((err) => {
    console.error('Erreur lors de l\'initialisation de la base de données :', err);
    process.exit(1);
  });
