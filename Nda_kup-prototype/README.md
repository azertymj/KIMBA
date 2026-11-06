# Ndakup — Prototype de démonstration (programme POUFA)

Prototype interactif en **HTML / CSS / JavaScript pur** (aucune installation, aucun serveur, aucune base de données).
Toutes les données sont **fictives** et stockées dans le navigateur (localStorage).

## Déployer depuis Git

### GitHub Pages
1. Créez un dépôt et poussez le contenu de ce dossier à la racine :
   ```bash
   git init && git add . && git commit -m "Prototype Ndakup"
   git branch -M main
   git remote add origin https://github.com/<compte>/<depot>.git
   git push -u origin main
   ```
2. Dépôt → **Settings → Pages → Build and deployment** : source « Deploy from a branch », branche `main`, dossier `/ (root)`.
3. L'adresse est `https://<compte>.github.io/<depot>/` (HTTPS requis pour le mode hors connexion réel).

### Netlify / Vercel / Cloudflare Pages
Importez le dépôt, **aucune commande de build**, dossier de publication = racine (`/`).

### Test local
```bash
python3 -m http.server 8080   # puis ouvrir http://localhost:8080
```
Ouvrir `index.html` directement fonctionne aussi (sauf le service worker).

## Parcours de test
1. Profil **Éleveur** → *Saisie* : enregistrez une journée.
2. Cliquez **En ligne** (en haut) pour passer en **hors connexion**, saisissez, puis revenez en ligne : les saisies se synchronisent.
3. Saisissez beaucoup de morts (ex. 40) : une **alerte** part vers les services vétérinaires.
4. Profil **Services vétérinaires** → *Alertes* : prendre en charge, confirmer, publier. *Seuils* : modifier le seuil.
5. Profil **POUFA / DGE** : tableau de bord, carte, classement, recoupement des intrants, *Paramétrage* (modifier une formule : tous les indicateurs se recalculent).
6. Profil **Éleveur** → *Saisie* → cession à un abattoir → *Lots & QR* : afficher le QR code.
7. Profil **Abattoir** : valider la réception du lot.
8. **Page publique** (lien sur l'accueil) : scanner le QR (caméra sur Chrome Android) ou saisir le code du lot. Essayez aussi le lot clos et le QR inconnu.
9. Profil **Auditeur ANINF** : journal non modifiable, export CSV.

## Ce que le prototype montre
Registre de 150 fermes (79 opérationnelles), bandes, fiche d'élevage, pesées, indicateurs (mortalité, viabilité, GMQ, IC) calculés par formules **paramétrables**, intrants et recoupement, alerte précoce et circuit vétérinaire, cloisonnement par profil, consentement BCEG révocable, carte, classement, rapport imprimable, lots, QR codes, registre des opérateurs, réception à l'abattoir, page publique consommateur, journal d'audit.

## Limites (prototype)
- Pas de serveur : pas d'authentification réelle, pas de base centrale, pas de synchronisation réelle entre appareils.
- Le mode hors connexion est simulé par le bouton ; le service worker (`sw.js`) permet en plus d'ouvrir l'application sans réseau après une première visite.
- Un QR créé sur un appareil embarque les infos publiques du lot pour pouvoir être lu sur un autre téléphone ; en production, le serveur vérifie chaque scan.
- La carte est schématique (points GPS sur une grille, sans fond cartographique).
- Données régénérées à la première ouverture sur chaque appareil ; bouton de réinitialisation dans *Paramétrage*.

## Structure
```
index.html          page unique
css/style.css       styles (mobile d'abord)
js/data.js          constantes et données fictives
js/store.js         état, calculs, règles de gestion
js/ui.js            graphiques, tableaux, helpers
js/views.js         écrans
js/app.js           routeur, événements, formulaires
js/vendor/qrcode.js génération de QR code (MIT, qrcode-generator)
sw.js, manifest.webmanifest, icons/   mode hors connexion / installable
```
