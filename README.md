# TaskFlow

Petite application full-stack de gestion de taches (todo-list) avec comptes utilisateurs.
Realisee dans le cadre du **Passage Developpeur II**.

Chaque utilisateur cree un compte, se connecte, puis gere ses propres taches
(creation, lecture, modification, suppression). Les taches d'un utilisateur ne
sont jamais visibles ni modifiables par un autre utilisateur.

## Stack technique

- **Backend** : Node.js + [Express](https://expressjs.com/)
- **Base de donnees** : SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (API synchrone, requetes preparees)
- **Authentification** : JWT (`jsonwebtoken`), mot de passe hache avec `scrypt` (module `crypto` natif de Node, pas de dependance native supplementaire)
- **Validation** : [`express-validator`](https://express-validator.github.io/) cote serveur, sur chaque route
- **Frontend** : HTML / CSS / JavaScript vanilla (aucun framework, aucune etape de build), servi statiquement par Express

## Choix techniques (resume)

- **SQLite + `better-sqlite3`** : suffisant pour une ressource CRUD de demonstration, zero configuration
  (pas de serveur de base de donnees a installer), API synchrone qui simplifie le code des routes.
  Toutes les requetes utilisent des **requetes preparees** (`db.prepare(...).run/get/all(...)`) avec
  des parametres positionnels `?` : aucune concatenation de chaines SQL nulle part.
- **Validation serveur systematique** : chaque route `POST`/`PUT` passe par des validateurs
  `express-validator` (format email, longueur de mot de passe, longueur/format des champs de tache,
  enumeration du statut, format de date) avant d'atteindre la logique metier. La validation cote
  navigateur (attributs HTML `required`, `type="email"`, etc.) n'est qu'un confort UX ; la securite
  reelle est appliquee cote serveur.
- **Mots de passe** : jamais stockes en clair. Hachage avec `crypto.scryptSync` + sel aleatoire de 16
  octets par utilisateur, comparaison en temps constant (`crypto.timingSafeEqual`).
- **Autorisation par ressource** : chaque requete sur `/api/tasks/:id` verifie que la tache appartient
  bien a l'utilisateur authentifie (`WHERE id = ? AND user_id = ?`), pour eviter qu'un utilisateur
  accede aux taches d'un autre en devinant un identifiant.
- **JWT en `Authorization: Bearer`** plutot qu'un cookie de session : simplifie le frontend vanilla JS
  (pas de gestion CSRF necessaire) et rend l'API directement testable avec `curl`/Postman.
- **Frontend vanilla** : le perimetre de l'exercice ne justifiait pas un framework front ; un seul
  fichier `app.js` suffit a couvrir l'inscription/connexion et le CRUD des taches.

## Structure du projet

```
.
├── public/              # Frontend statique (HTML/CSS/JS)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── server/
│   ├── src/
│   │   ├── index.js         # Point d'entree Express
│   │   ├── db.js            # Connexion SQLite + creation des tables
│   │   ├── middleware/
│   │   │   ├── requireAuth.js
│   │   │   └── validate.js
│   │   ├── routes/
│   │   │   ├── auth.js      # /api/auth/register, /login, /me
│   │   │   └── tasks.js     # /api/tasks (CRUD)
│   │   ├── utils/
│   │   │   ├── password.js  # hash/verif mot de passe (scrypt)
│   │   │   └── jwt.js       # signature/verification JWT
│   │   └── validators/
│   │       ├── authValidators.js
│   │       └── taskValidators.js
│   ├── .env.example
│   └── package.json
└── README.md
```

## Installation

Prerequis : [Node.js](https://nodejs.org/) >= 18.

```bash
cd server
npm install
cp .env.example .env
```

## Variables d'environnement

Definies dans `server/.env` (voir `server/.env.example`) :

| Variable          | Description                                              | Exemple                  |
|-------------------|-----------------------------------------------------------|---------------------------|
| `PORT`            | Port d'ecoute du serveur HTTP                             | `3000`                    |
| `JWT_SECRET`      | Secret de signature des JWT (a changer en production)     | chaine aleatoire longue   |
| `JWT_EXPIRES_IN`  | Duree de validite des tokens                               | `7d`                      |
| `DB_PATH`         | Chemin du fichier SQLite (cree automatiquement)            | `./data/app.db`           |

Pour generer un secret aleatoire :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Lancement

```bash
cd server
npm start
```

Puis ouvrir [http://localhost:3000](http://localhost:3000) : le frontend et l'API sont servis
par le meme serveur Express (pas de configuration CORS necessaire).

Mode developpement avec rechargement automatique (basé sur `node --watch`, inclus nativement dans Node.js) :

```bash
npm run dev
```

La base de donnees SQLite est creee automatiquement au premier lancement dans `server/data/app.db`.

## API

Toutes les routes `/api/tasks/*` necessitent un header `Authorization: Bearer <token>` obtenu via
`/api/auth/login` ou `/api/auth/register`.

| Methode | Route               | Description                                  |
|---------|----------------------|-----------------------------------------------|
| POST    | `/api/auth/register`| Creation de compte (email + mot de passe)      |
| POST    | `/api/auth/login`   | Connexion, retourne un JWT                     |
| GET     | `/api/auth/me`      | Informations sur l'utilisateur connecte        |
| GET     | `/api/tasks`        | Liste des taches de l'utilisateur (filtre `?status=`) |
| POST    | `/api/tasks`        | Creation d'une tache                            |
| GET     | `/api/tasks/:id`    | Detail d'une tache                              |
| PUT     | `/api/tasks/:id`    | Modification d'une tache                        |
| DELETE  | `/api/tasks/:id`    | Suppression d'une tache                         |

## Limites connues / pistes d'amelioration

- Pas de rate-limiting sur les routes d'authentification (a ajouter en production).
- Pas de flux de reinitialisation de mot de passe / verification d'email.
- Les tests automatises ne sont pas inclus, l'exercice ayant ete verifie manuellement.
