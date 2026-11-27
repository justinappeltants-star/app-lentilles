# Lentilles — suivi quotidien

Application web de suivi du port de lentilles, avec comptes Supabase, calendriers synchronisés et espace administrateur.

## Fonctionnalités

- Inscription et connexion par nom d'utilisateur et mot de passe via Supabase Auth.
- Option de session persistante (rester connecté).
- Calendrier et statistiques par compte.
- Synchronisation des journées avec Supabase.
- Tableau de bord administrateur : liste des comptes et jours enregistrés.
- Préférences d'apparence, import/export JSON et PWA.

## Configuration Supabase

Le fichier `supabase-config.js` contient uniquement l'URL du projet et la clé publishable. Cette clé est publique par conception ; la sécurité repose sur les politiques RLS. Ne jamais placer la clé `service_role` ou un mot de passe de base de données dans le dépôt ou le navigateur.

Le schéma de référence est dans `supabase/schema.sql`. Les tables utilisées sont `profiles` et `daily_entries`. Le trigger crée automatiquement un profil pour chaque compte Auth. Les utilisateurs ne peuvent lire et modifier que leurs propres journées ; le rôle administrateur peut lire tous les profils et calendriers.

### Configuration nécessaire dans le tableau de bord Supabase

1. Dans **Authentication → Sign In / Providers → Email**, désactiver **Confirm email**. L'application utilise un identifiant interne sous la forme `nom@users.lentilles.invalid` car l'écran d'inscription ne demande pas d'adresse e-mail.
2. Vérifier que les tables `profiles` et `daily_entries` existent et que les politiques RLS sont activées.
3. Créer le compte administrateur depuis l'écran d'inscription du site avec le nom d'utilisateur `admin` et un mot de passe fort choisi par l'administrateur.
4. Dans **Authentication → Users**, copier l'UUID de ce compte, puis exécuter dans le SQL Editor :
   `update public.profiles set role = 'admin' where id = 'UUID_DU_COMPTE_ADMIN';`
5. Se déconnecter puis se reconnecter. L'onglet **Admin** apparaît alors.

Les comptes utilisent des adresses internes non destinées à recevoir des e-mails : la récupération par e-mail n'est donc pas disponible. Prévoir une procédure de récupération administrée séparément avant un usage important.

## Confidentialité

Les utilisateurs sont informés que leurs calendriers sont stockés en ligne et que l'administrateur peut consulter les noms d'utilisateur et les dates enregistrées. Les mots de passe ne sont jamais visibles par l'administrateur. Ne pas utiliser cette application pour stocker des informations médicales ou sensibles.

## Déploiement Netlify

- Branche de production : `main`
- Répertoire publié : `.`
- Commande de build : aucune

Le site est statique ; les modifications fusionnées dans `main` déclenchent le déploiement si Netlify est connecté au dépôt.

## Structure

```
index.html
styles.css
app.js
supabase-config.js
service-worker.js
manifest.webmanifest
netlify.toml
supabase/schema.sql
```
