# Hue Motion Sensor — relevé de température

Petite application web qui enregistre la température de tes **Philips Hue Motion Sensor**
toutes les 5 minutes et l'affiche :

- **par journée** : courbe de la température + min / moyenne / max du jour ;
- **par heure** : tableau min / moyenne / max pour chaque heure.

Tout tourne dans le cloud, sans appareil allumé chez toi :

```
Capteur → Pont Hue → Cloud Hue (api.meethue.com)
                           ↑ lecture toutes les 5 min
cron-job.org → Vercel (/api/cron) → Neon (Postgres) ← Vercel (pages web)
```

Stack : Next.js (Vercel), Postgres serverless (Neon), Chart.js, API distante Philips Hue (CLIP v2).

> ⚠️ **Dépôt public** : aucun secret ne doit être commité. Toutes les clés vont dans les
> variables d'environnement Vercel. Le site est protégé par un mot de passe.

---

## Installation (≈ 20 minutes)

### 1. Déployer sur Vercel
1. Sur [vercel.com](https://vercel.com), **Add New → Project**, importe ce dépôt GitHub.
2. Déploie une première fois (le site affichera une erreur tant que les variables ne sont pas
   remplies, c'est normal). Note l'URL, par ex. `https://mon-hue.vercel.app`.

### 2. Créer la base de données
1. Dans le projet Vercel : **Storage → Create Database → Neon (Postgres)** (offre gratuite).
2. Relie-la au projet : la variable `DATABASE_URL` est ajoutée automatiquement.
   Les tables sont créées toutes seules au premier appel.

### 3. Créer l'application Hue
1. Crée un compte sur [developers.meethue.com](https://developers.meethue.com) puis
   **Remote Hue API → Add new Hue Remote API app**.
2. **Callback URL** : `https://mon-hue.vercel.app/api/hue/callback`
3. Récupère le **ClientId** et le **ClientSecret**.

### 4. Variables d'environnement Vercel
Dans **Settings → Environment Variables** (voir `.env.example`) :

| Variable | Valeur |
|---|---|
| `HUE_CLIENT_ID` | ClientId de l'app Hue |
| `HUE_CLIENT_SECRET` | ClientSecret de l'app Hue |
| `CRON_SECRET` | une longue chaîne aléatoire (ex. `openssl rand -hex 32`) |
| `APP_PASSWORD` | le mot de passe pour accéder au site |
| `APP_TIMEZONE` | `Europe/Paris` (facultatif) |
| `DATABASE_URL` | ajoutée par Neon à l'étape 2 |

Puis **Redeploy** pour prendre en compte les variables.

### 5. Connecter ton compte Hue
1. Ouvre `https://mon-hue.vercel.app/setup` (identifiant : n'importe quoi, mot de passe :
   `APP_PASSWORD`).
2. Clique **Connecter mon compte Hue**, connecte-toi chez Philips et autorise l'app.
   L'app crée automatiquement sa clé d'accès au pont (pas besoin d'appuyer sur le bouton).

### 6. Programmer la collecte (cron-job.org)
L'offre gratuite de Vercel ne permet qu'une tâche planifiée par jour, on utilise donc
[cron-job.org](https://cron-job.org) (gratuit) :

1. **Create cronjob**
2. **URL** : `https://mon-hue.vercel.app/api/cron`
3. **Schedule** : toutes les 5 minutes
4. **Advanced → Headers** : `Authorization` = `Bearer <ta valeur de CRON_SECRET>`
5. Active les notifications d'échec pour être prévenu si la collecte s'arrête
   (ex. jeton Hue expiré → refaire l'étape 5).

Clique **Test run** : la réponse doit être `{"ok":true,"saved":[...]}`.
La page d'accueil affichera les courbes dès les premières mesures.

---

## Développement local

```bash
cp .env.example .env.local   # remplis les valeurs (ne jamais committer ce fichier)
npm install
npm run dev
```

## Fonctionnement

- `GET /api/cron` (protégé par `CRON_SECRET`) lit la ressource `temperature` de tous les
  capteurs via `https://api.meethue.com/route/clip/v2/...` et enregistre une mesure par capteur.
- Le jeton OAuth Hue est rafraîchi automatiquement avant expiration (et en cas d'erreur 401).
- Les vues jour/heure sont calculées dans le fuseau `APP_TIMEZONE` (changements d'heure gérés).
- Une mesure toutes les 5 min ≈ 105 000 lignes/an par capteur : largement dans l'offre gratuite Neon.

## Limites connues
- Si internet, le cloud Hue, Vercel ou cron-job.org est indisponible, des mesures manquent
  pendant cette période.
- Si le jeton de rafraîchissement Hue expire (collecte arrêtée longtemps), il faut
  reconnecter le compte depuis `/setup`.
