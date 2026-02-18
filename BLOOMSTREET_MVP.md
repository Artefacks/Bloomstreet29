# Bloomstreet 29 – MVP : env et checklist

## Variables d’environnement (.env.local)

À mettre **à la racine du projet** dans le fichier **`.env.local`** (créer le fichier s’il n’existe pas). Aucune de ces clés ne doit être utilisée côté client, sauf les deux `NEXT_PUBLIC_*`.

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Uniquement côté serveur (RLS bypass)
FINNHUB_API_KEY=xxx                # Uniquement dans /api/prices/refresh
CRON_SECRET=                       # Chaîne secrète pour protéger le cron (à remplir)
PRICE_REFRESH_SECONDS=60
```

- **CRON_SECRET** : générer une chaîne aléatoire (ex. `openssl rand -hex 32`) et la mettre dans `.env.local` ; la même valeur doit être configurée dans Vercel (Cron) comme header `x-cron-secret`.

---

## Checklist de tests manuels

1. **Démarrer l’app**
   - `npm run dev`
   - Ouvrir `http://localhost:3001` (ou le port affiché).

2. **Page /health**
   - Aller sur `http://localhost:3001/health`
   - Vérifier que la page affiche « OK ».

3. **Login Google**
   - Aller sur `/login`
   - Cliquer sur « Continuer avec Google »
   - Vérifier la redirection vers Google puis le retour sur l’app (callback).
   - Dans Supabase Dashboard → Authentication → URL Configuration, ajouter dans **Redirect URLs** :  
     `http://localhost:3001/auth/callback` (et l’URL de prod si besoin).

4. **Créer une partie**
   - Une fois connecté, cliquer sur « Créer une partie »
   - Remplir durée (ex. 7 jours) et cash initial (ex. 100 000), envoyer
   - Vérifier la redirection vers `/games/[id]` avec le code d’invitation affiché.

5. **Seed instruments + prix (SQL)**
   - Dans Supabase → SQL Editor, exécuter le contenu de `supabase/seed_instruments.sql` pour créer des instruments (AAPL, MSFT, etc.).
   - Pour tester le trading sans attendre le cron, insérer manuellement des lignes dans `prices_latest` :
     ```sql
     insert into public.prices_latest (symbol, price, as_of, source) values
       ('AAPL', 150.50, now(), 'manual'),
       ('MSFT', 380.00, now(), 'manual')
     on conflict (symbol) do update set price = excluded.price, as_of = excluded.as_of, source = excluded.source;
     ```

6. **Tester achat puis vente**
   - Sur la page de la partie, dans le tableau « Instruments », saisir une quantité (ex. 10) pour AAPL
   - Cliquer « Acheter » : vérifier message de succès, cash diminué, position créée
   - Saisir une quantité (ex. 5) et cliquer « Vendre » : vérifier message de succès, cash augmenté, position mise à jour

7. **Refresh des prix (curl / Postman)**
   - Générer une valeur pour `CRON_SECRET` et la mettre dans `.env.local`
   - Redémarrer `npm run dev`
   - Tester la route protégée :
     ```bash
     curl -X POST http://localhost:3001/api/prices/refresh -H "x-cron-secret: VOTRE_CRON_SECRET"
     ```
   - Réponse attendue : `{"ok":true,"updated":N}` (N = nombre de symboles mis à jour)
   - Sans le header ou avec un mauvais secret : 401 Unauthorized

8. **Brancher le Cron Vercel**
   - Dans Vercel → projet → Settings → Environment Variables : ajouter `CRON_SECRET` (même valeur que dans `.env.local` pour la prod).
   - Dans Vercel → projet → Settings → Cron Jobs (ou `vercel.json`) : ajouter une tâche qui appelle `POST https://votre-domaine.vercel.app/api/prices/refresh` toutes les 60 secondes (ou selon `PRICE_REFRESH_SECONDS`).
   - Exemple `vercel.json` :
     ```json
     {
       "crons": [
         {
           "path": "/api/prices/refresh",
           "schedule": "* * * * *"
         }
       ]
     }
     ```
   - La route accepte soit le header `x-cron-secret: VOTRE_CRON_SECRET`, soit `Authorization: Bearer VOTRE_CRON_SECRET`. Configurer dans Vercel la variable `CRON_SECRET` et, si le cron n’envoie pas `x-cron-secret`, utiliser l’en-tête Authorization (selon la doc Vercel Cron).

---

## Rappel

- **Aucune clé secrète** (service role, Finnhub, CRON_SECRET) ne doit être exposée côté client.
- Les prix sont rafraîchis côté serveur via la route protégée + Cron ; le client ne fait que lire les données (via l’API state ou les pages serveur).
