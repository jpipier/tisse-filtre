# Tissé — filtre pub et IA pour Pinterest

Extension Chrome (Manifest V3) qui masque, sur Pinterest, les épingles sponsorisées et les images générées par IA.
Aucune donnée n'est collectée ; seul le détecteur optionnel envoie l'adresse publique d'une image, avec la clé de l'utilisateur.

## Installer en local

```bash
npm install
npm run build      # construit dist/
npm test           # tests des règles de décision
npm run typecheck
npm run zip        # paquet tisse-filtre.zip pour le Chrome Web Store
```

Puis dans Chrome : `chrome://extensions` → activer le **mode développeur** → **Charger l'extension non empaquetée** → choisir `dist`.

## Comment ça décide

L'extension lit les données JSON que le site de Pinterest charge déjà (`page-hook.ts`, monde `MAIN`) au lieu de deviner
à partir de l'affichage, qui change souvent. Les épingles affichées sont rapprochées de ces données par la signature
de l'image (`i.pinimg.com/…/<signature>.jpg`), puis par l'identifiant d'épingle.

| Cible | Signal | Fiabilité |
|---|---|---|
| Pub | champs `is_promoted`, `promoter`, `campaign_id`, `ad_match_reason`… | très bonne |
| Pub | mention « Sponsorisé » / « Promu par » dans la carte (filet de sécurité) | bonne |
| IA | filtre « Moins d'IA » de Pinterest forcé sur ses requêtes (`filter_genai: true`) | très bonne en déco, faible en mode |
| IA | label IA posé par Pinterest (données ou texte « Modifié par IA ») | très bonne |
| IA | mots-clés (Midjourney, #aiart, « généré par IA »…) et sites d'images IA | bonne |
| IA | PNG/WebP aux dimensions exactes d'un générateur (1024×1536, 832×1216…, ou ×1,5/×2) | bonne, réglable |
| IA | signalements de l'utilisateur (bouton « IA ? ») | certaine |
| IA | détecteur Sightengine, optionnel, avec la clé de l'utilisateur et un quota quotidien | très bonne |

Les fausses alertes se corrigent d'un clic (« C'est une vraie photo »), mémorisé.

## Affichage

- **Voile** (par défaut) : l'épingle est floutée, avec « Afficher » et « C'est une vraie photo ».
- **Retirer complètement** : les épingles sont enlevées des réponses de Pinterest avant affichage, la mosaïque se
  construit sans elles. Celles qu'on ne peut pas retirer des données (premier chargement d'une page, mention
  « Sponsorisé » lue dans la carte) passent en `display: none` ; comme Pinterest positionne chaque épingle en absolu,
  l'extension remonte alors les épingles situées dessous, dans la même colonne (`core/masonry.ts`).

## Mode debug

Dans la fenêtre de l'extension, « Mode debug » affiche sur chaque épingle les indices examinés (✔ retenu, ✘ absent,
? information manquante, – désactivé) et la décision : IA, PUB ou RIEN À MASQUER. Il indique aussi si les données
viennent des réponses de Pinterest ou seulement de la page. Le retrait complet est suspendu pendant le debug,
pour que les épingles repérées restent visibles avec leur explication.

## Code

- `src/core/` : règles pures, testées par Vitest (`npm test`)
- `src/page-hook.ts` : lecture des réponses de Pinterest et activation de `filter_genai`
- `src/content.ts` : rapprochement avec le DOM, voile, bouton « IA ? »
- `src/background.ts` : badge et appels au détecteur (cache, quota, 3 appels simultanés au plus)
- `src/popup.ts` + `static/` : réglages
- `scripts/store-assets.mjs` : visuels de la fiche du store (`node scripts/store-assets.mjs`)
- `store/LISTING.md` : textes de la fiche et réponses du formulaire du Chrome Web Store

## Confidentialité

Voir [PRIVACY.md](PRIVACY.md). Aucune donnée n'est collectée.

Extension indépendante, non affiliée à Pinterest.
