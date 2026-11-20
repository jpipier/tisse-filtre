# Fiche Chrome Web Store — à copier dans le tableau de bord

Paquet à envoyer : `tisse-filtre.zip` (produit par `npm run zip`).
Icône de la fiche : `store/icon-128.png` (128×128, logo 96×96 et 16 px de marge transparente).
Visuels : `store/screenshots/fr/*.png`, `store/screenshots/en/*.png` (1280×800), `store/promo-440x280-fr.png` / `-en.png`.

---

## Onglet « Fiche Play Store » (Store listing)

**Catégorie** : Personnaliser Chrome › Fonctionnalités et interface (Make Chrome Yours › Functionality & UI)
**Langue principale** : français

### Français

**Nom** (vient du manifest) : Tissé — filtre pub et IA pour Pinterest

**Résumé** (132 caractères max., vient du manifest) :
Masque les épingles sponsorisées et les images générées par IA sur Pinterest. Aucune donnée collectée.

**Description** :

Retrouvez un Pinterest fait de vrais intérieurs et de vraies tenues.

Tissé masque automatiquement, pendant que vous naviguez sur Pinterest :
• les épingles sponsorisées (publicités, offres promotionnelles) ;
• les images très probablement générées par intelligence artificielle.

COMMENT ÇA MARCHE
L'extension combine plusieurs indices, tous analysés dans votre navigateur :
• le filtre « Moins d'IA » de Pinterest, activé d'office sur vos recherches ;
• les labels IA posés par Pinterest ;
• les mots-clés des générateurs (Midjourney, DALL-E, Stable Diffusion, #aiart…) ;
• les dimensions exactes produites par les générateurs d'images ;
• les sites qui ne publient que des images générées ;
• vos propres signalements, d'un clic sur « IA ? ».

VOUS GARDEZ LA MAIN
• Voile flouté avec bouton « Afficher », ou retrait complet sans trou dans la mosaïque.
• « C'est une vraie photo » corrige une erreur, définitivement.
• Mode debug : chaque épingle affiche les indices examinés et la décision.
• Détecteur optionnel (Sightengine), avec votre propre clé, pour les cas difficiles.

RESPECT DE LA VIE PRIVÉE
Aucune donnée collectée, aucun pisteur, aucune publicité. Vos réglages et signalements restent sur votre appareil.

Aucune détection n'est parfaite : certaines images générées peuvent passer, et une vraie photo peut être masquée par erreur. Le mode debug et le bouton « C'est une vraie photo » sont là pour ça.

Extension indépendante, non affiliée à Pinterest.

### English

**Name** (from the manifest): Tissé — Ad & AI filter for Pinterest

**Summary** (from the manifest):
Hides promoted pins and AI-generated images on Pinterest. No data collected.

**Description**:

Get back a Pinterest made of real interiors and real outfits.

While you browse Pinterest, Tissé automatically hides:
• promoted pins (ads, promotional offers);
• images that are very likely AI-generated.

HOW IT WORKS
The extension combines several clues, all analysed in your browser:
• Pinterest's own "Less AI" filter, turned on for your searches;
• AI labels set by Pinterest;
• image generator keywords (Midjourney, DALL-E, Stable Diffusion, #aiart…);
• the exact dimensions produced by image generators;
• websites that only publish generated images;
• your own reports, with one click on "IA ?".

YOU STAY IN CONTROL
• Blurred veil with a "Show" button, or full removal with no gaps in the grid.
• "It's a real photo" fixes a mistake, for good.
• Debug mode: each pin shows the clues examined and the decision.
• Optional detector (Sightengine), with your own key, for difficult cases.

PRIVACY
No data collected, no trackers, no ads. Your settings and reports stay on your device.

The extension's interface is in French for now.

No detection is perfect: some generated images may get through, and a real photo may be hidden by mistake. Debug mode and the "It's a real photo" button are there for that.

Independent extension, not affiliated with Pinterest.

---

## Onglet « Pratiques de confidentialité » (Privacy practices)

**Objectif unique** (Single purpose) :
> Masquer les publicités et les images générées par IA sur les pages de Pinterest.
> *Hide ads and AI-generated images on Pinterest pages.*

**Justification de `storage`** :
> Conserver sur l'appareil les réglages de l'utilisateur, les images qu'il a signalées comme IA ou déclarées « vraies photos », et le quota quotidien du détecteur optionnel.

**Justification des autorisations d'hôte (sites Pinterest)** :
> L'extension doit s'exécuter sur les pages de Pinterest pour lire les épingles affichées et les données que le site charge (texte, dimensions des images, mention sponsorisée), puis masquer celles qui sont des publicités ou des images générées par IA. Elle ne s'exécute sur aucun autre site.

**Justification de l'autorisation facultative `api.sightengine.com`** :
> Demandée uniquement si l'utilisateur active lui-même le détecteur optionnel et saisit ses propres identifiants Sightengine : l'adresse publique de l'image est envoyée à ce service pour savoir si elle est générée par IA.

**Code distant** (Remote code) : **Non**, je n'utilise pas de code distant. Tout le code est dans le paquet.

**Utilisation des données** (Data usage) — cocher :
- [x] **Contenu des sites Web** (Website content) — uniquement l'adresse publique d'une image Pinterest, envoyée à Sightengine si l'utilisateur active le détecteur optionnel. Rien d'autre n'est transmis.

Toutes les autres catégories : non cochées.

Certifications (cocher les trois) :
- [x] Je ne vends ni ne transfère les données des utilisateurs à des tiers, en dehors des cas d'utilisation approuvés.
- [x] Je n'utilise ni ne transfère les données des utilisateurs à des fins sans rapport avec l'objectif unique de mon article.
- [x] Je n'utilise ni ne transfère les données des utilisateurs pour déterminer leur solvabilité ou pour octroyer des prêts.

**URL de la politique de confidentialité** :
`https://github.com/jpipier/tisse-filtre/blob/main/PRIVACY.md`

---

## Onglet « Distribution »

- **Visibilité** : Non répertoriée (Unlisted)
- **Régions** : toutes
- **Paiement** : gratuit

## Notes pour la relecture (champ facultatif « Notes for reviewers »)

> L'extension réécrit deux choses sur pinterest.com, uniquement pour filtrer l'affichage :
> 1. elle passe l'option `filter_genai` à `true` dans les requêtes de recherche de Pinterest (équivalent du bouton « Moins d'IA » du site) ;
> 2. en mode « Retirer complètement », elle enlève des réponses JSON de Pinterest les épingles sponsorisées ou repérées comme IA, avant leur affichage.
> Aucune donnée n'est envoyée à l'éditeur. Le détecteur Sightengine est désactivé par défaut. Code source : https://github.com/jpipier/tisse-filtre
