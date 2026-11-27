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

## Comptes et limites actuelles

- Connexion locale par nom d'utilisateur et mot de passe.
- Création de comptes locaux et option « Rester connecté ».
- Compte administrateur initial : identifiant `admin`, mot de passe `admin1234`.
- Les calendriers et préférences sont séparés par compte sur le même navigateur.
- Les mots de passe sont stockés sous forme de condensat SHA-256 dans le stockage local.

**Important : cette connexion est une démonstration locale, pas une authentification sécurisée.** Les comptes et données restent sur l'appareil, ne sont pas synchronisés entre appareils et peuvent être modifiés ou contournés par une personne ayant accès au navigateur ou au code. Le code envoyé au navigateur est visible même si le dépôt GitHub est privé. N'utilise pas ce système pour protéger des données sensibles ou un véritable espace administrateur. Pour une authentification réelle, il faudra ajouter un serveur ou un service comme Supabase.

L'export JSON permet de conserver une copie des données.

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
