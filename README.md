# TaskFlow

Petite application full-stack de gestion de tâches (todo-list) avec comptes utilisateurs.
Réalisée dans le cadre du **Passage Développeur II**.

Chaque utilisateur crée un compte, se connecte, puis gère ses propres tâches
(création, lecture, modification, suppression). Les tâches d'un utilisateur ne
sont jamais visibles ni modifiables par un autre utilisateur.

L'application comporte trois vues : une **page d'accueil** qui présente le
produit, une **page de connexion / inscription**, et un **tableau de bord**
(statistiques + gestion des tâches) une fois connecté.

## Stack technique

- **Backend** : Node.js + [Express](https://expressjs.com/)
- **Base de données** : PostgreSQL via [`pg`](https://node-postgres.com/), hébergée gratuitement sur [Neon](https://neon.tech) (voir [Base de données](#base-de-données)). Requêtes préparées partout
- **Authentification** : JWT (`jsonwebtoken`), mot de passe haché avec `scrypt` (module `crypto` natif de Node, pas de dépendance native supplémentaire)
- **Validation** : [`express-validator`](https://express-validator.github.io/) côté serveur, sur chaque route
- **Frontend** : HTML / CSS / JavaScript vanilla (aucun framework, aucune étape de build), servi statiquement par Express. Page d'accueil, page de connexion/inscription et tableau de bord gérés comme trois vues d'une même page (`public/app.js`)

## Choix techniques (résumé)

- **PostgreSQL via `pg`** : base externe au service web, donc indépendante du système de fichiers de
  l'hébergeur (voir [Base de données](#base-de-données) pour le pourquoi). `server/src/db.js` expose une
  petite interface (`all`, `get`, `run`) utilisée par toutes les routes ; les requêtes s'écrivent avec des
  paramètres positionnels `?`, convertis automatiquement en `$1, $2, ...` avant d'être exécutées via un
  pool `pg` : **requêtes préparées** partout, aucune concaténation de chaînes SQL.
- **Validation serveur systématique** : chaque route `POST`/`PUT` passe par des validateurs
  `express-validator` (format email, longueur de mot de passe, longueur/format des champs de tâche,
  énumération du statut, format de date) avant d'atteindre la logique métier. La validation côté
  navigateur (attributs HTML `required`, `type="email"`, etc.) n'est qu'un confort UX ; la sécurité
  réelle est appliquée côté serveur.
- **Mots de passe** : jamais stockés en clair. Hachage avec `crypto.scryptSync` + sel aléatoire de 16
  octets par utilisateur, comparaison en temps constant (`crypto.timingSafeEqual`).
- **Autorisation par ressource** : chaque requête sur `/api/tasks/:id` vérifie que la tâche appartient
  bien à l'utilisateur authentifié (`WHERE id = ? AND user_id = ?`), pour éviter qu'un utilisateur
  accède aux tâches d'un autre en devinant un identifiant.
- **JWT en `Authorization: Bearer`** plutôt qu'un cookie de session : simplifie le frontend vanilla JS
  (pas de gestion CSRF nécessaire) et rend l'API directement testable avec `curl`/Postman.
- **Frontend vanilla** : le périmètre de l'exercice ne justifiait pas un framework front ; un seul
  fichier `app.js` suffit à couvrir l'inscription/connexion et le CRUD des tâches.

## Structure du projet

```
.
├── public/              # Frontend statique (HTML/CSS/JS)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server/
│   ├── src/
│   │   ├── index.js         # Point d'entrée Express
│   │   ├── db.js            # Connexion PostgreSQL (pool pg) + migrations
│   │   ├── middleware/
│   │   │   ├── requireAuth.js
│   │   │   └── validate.js
│   │   ├── routes/
│   │   │   ├── auth.js      # /api/auth/register, /login, /me
│   │   │   └── tasks.js     # /api/tasks (CRUD)
│   │   ├── utils/
│   │   │   ├── password.js  # hash/vérif mot de passe (scrypt)
│   │   │   └── jwt.js       # signature/vérification JWT
│   │   └── validators/
│   │       ├── authValidators.js
│   │       └── taskValidators.js
│   ├── .env.example
│   └── package.json
└── README.md
```

## Base de données

L'application utilise **PostgreSQL** (pas de mode local sans configuration) : sur un service web comme
**Render** (plan gratuit, sans disque persistant), le système de fichiers est réinitialisé à chaque
redéploiement, donc un fichier SQLite local serait perdu à chaque `git push`. En utilisant une base
**PostgreSQL externe**, indépendante du disque du service web, les données survivent aux redéploiements.

[Neon](https://neon.tech) propose un plan gratuit adapté :

1. Créer un compte sur [neon.tech](https://neon.tech) et un nouveau projet Postgres.
2. Copier la chaîne de connexion fournie (elle ressemble à
   `postgresql://user:password@ep-xxxxx.neon.tech/dbname?sslmode=require`).
3. La renseigner comme `DATABASE_URL`, en local dans `server/.env`, et en production dans les variables
   d'environnement du service Render (onglet **Environment**).

Au démarrage, le serveur crée les tables si besoin (`CREATE TABLE IF NOT EXISTS`) et se connecte à cette
base : aucune donnée n'est stockée sur le disque du service web.

## Installation

Prérequis : [Node.js](https://nodejs.org/) >= 18 et une base PostgreSQL (voir [Base de données](#base-de-données) ci-dessus).

```bash
cd server
npm install
cp .env.example .env
# renseigner DATABASE_URL et JWT_SECRET dans .env
```

## Variables d'environnement

Définies dans `server/.env` (voir `server/.env.example`) :

| Variable          | Description                                              | Exemple                  |
|-------------------|-----------------------------------------------------------|---------------------------|
| `PORT`            | Port d'écoute du serveur HTTP                             | `3000`                    |
| `JWT_SECRET`      | Secret de signature des JWT (à changer en production)     | chaîne aléatoire longue   |
| `JWT_EXPIRES_IN`  | Durée de validité des tokens                               | `7d`                      |
| `DATABASE_URL`    | Chaîne de connexion PostgreSQL (obligatoire)               | `postgresql://...`        |

Pour générer un secret aléatoire :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Lancement

```bash
cd server
npm start
```

Puis ouvrir [http://localhost:3000](http://localhost:3000) : le frontend et l'API sont servis
par le même serveur Express (pas de configuration CORS nécessaire).

Mode développement avec rechargement automatique (basé sur `node --watch`, inclus nativement dans Node.js) :

```bash
npm run dev
```

## API

Toutes les routes `/api/tasks/*` nécessitent un header `Authorization: Bearer <token>` obtenu via
`/api/auth/login` ou `/api/auth/register`.

| Méthode | Route               | Description                                  |
|---------|----------------------|-----------------------------------------------|
| POST    | `/api/auth/register`| Création de compte (email + mot de passe)      |
| POST    | `/api/auth/login`   | Connexion, retourne un JWT                     |
| GET     | `/api/auth/me`      | Informations sur l'utilisateur connecté        |
| PATCH   | `/api/auth/me`      | Modification du nom affiché                     |
| DELETE  | `/api/auth/me`      | Suppression définitive du compte (mot de passe requis dans le corps de la requête) |
| GET     | `/api/tasks`        | Liste des tâches de l'utilisateur (filtre `?status=`) |
| POST    | `/api/tasks`        | Création d'une tâche                            |
| GET     | `/api/tasks/:id`    | Détail d'une tâche                              |
| PUT     | `/api/tasks/:id`    | Modification d'une tâche                        |
| DELETE  | `/api/tasks/:id`    | Suppression d'une tâche                         |
| DELETE  | `/api/tasks`        | Suppression de toutes les tâches de l'utilisateur |

## Limites connues / pistes d'amélioration

- Pas de rate-limiting sur les routes d'authentification (à ajouter en production).
- Pas de flux de réinitialisation de mot de passe / vérification d'email.
- Les tests automatisés ne sont pas inclus, l'exercice ayant été vérifié manuellement.
