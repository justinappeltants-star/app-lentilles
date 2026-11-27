# Lentilles — suivi quotidien

Petite application web responsive pour noter les journées de port de lentilles, consulter des statistiques et personnaliser l'interface.

## Fonctionnalités disponibles

- Calendrier mensuel avec activation/désactivation des journées.
- Statistiques : total, série actuelle, meilleure série, estimation des heures et étapes.
- Cinq palettes : Océan, Forêt, Lavande, Corail et Minuit.
- Modes sombre, clair et automatique.
- Export et import des données au format JSON.
- Application web progressive (PWA) avec cache hors ligne de base.

## Déploiement sur Netlify

Le site est statique : aucune compilation n'est nécessaire.

1. Dans Netlify, choisir **Add new project** puis **Import an existing project**.
2. Connecter GitHub et sélectionner `justinappeltants-star/app-lentilles`.
3. Branche : `main`.
4. Répertoire de publication : `.` (racine du dépôt).
5. Laisser la commande de build vide, puis lancer le déploiement.

Le fichier `netlify.toml` définit déjà le répertoire publié.

## Lancer en local

Ouvrir `index.html` dans un navigateur pour tester les fonctions principales. Pour tester le service worker/PWA, utiliser un serveur local ou Netlify (HTTPS).

## Données et limites actuelles

Les journées et préférences sont actuellement enregistrées dans le stockage local du navigateur. Elles ne sont donc pas synchronisées entre appareils et ne constituent pas une sauvegarde cloud. L'export JSON permet de conserver une copie.

Le dossier `supabase/` contient un schéma SQL de départ pour les profils, les journées, les rôles administrateur et une limite de comptes configurable entre 2 et 100 000. Il doit être installé, vérifié et testé dans un projet Supabase. L'interface de connexion, la synchronisation cloud, le tableau de bord administrateur et la récupération SMS/WhatsApp ne sont pas encore intégrés.

Ne jamais mettre de mot de passe administrateur, de clé `service_role` ou de secret dans le code public. Toute promotion administrateur doit être faite côté serveur après vérification du compte.

## Structure

```
.
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── service-worker.js
├── netlify.toml
├── icons/
│   └── icon.svg
└── supabase/
    └── schema.sql
```
