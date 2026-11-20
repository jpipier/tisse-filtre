# Politique de confidentialité — Tissé, filtre pub et IA pour Pinterest

*Dernière mise à jour : 20 novembre 2026* · [English version below](#privacy-policy--tissé-ad--ai-filter-for-pinterest)

L'extension **Tissé — filtre pub et IA pour Pinterest** masque, sur les pages de Pinterest, les épingles sponsorisées et les images probablement générées par intelligence artificielle. Elle est conçue pour ne collecter aucune donnée.

## Ce que l'extension ne fait pas

- Elle ne collecte, ne vend et ne transmet aucune donnée personnelle à l'éditeur de l'extension ni à un tiers.
- Elle n'utilise aucun outil de mesure d'audience, aucun cookie publicitaire, aucun pisteur.
- Elle ne lit pas votre historique de navigation et ne fonctionne que sur les sites de Pinterest.
- Elle n'exécute aucun code téléchargé à distance.

## Ce qui est stocké, et où

Tout reste **sur votre appareil** :

| Donnée | Emplacement | Usage |
|---|---|---|
| Vos réglages (options cochées, mode d'affichage) | stockage local de l'extension (`chrome.storage.local`) | appliquer vos choix |
| Les empreintes d'images que vous avez signalées « IA » ou déclarées « vraie photo » | stockage local de l'extension | ne plus vous les montrer, ou ne plus les masquer |
| Une copie courte des réglages d'affichage | stockage local du site Pinterest (`localStorage`) | appliquer le filtre dès l'ouverture d'une page |
| Si vous utilisez le détecteur optionnel : ses résultats (empreinte et verdict) et le nombre d'appels du jour | stockage local de l'extension | ne pas analyser deux fois la même image, respecter votre limite quotidienne |

Une « empreinte d'image » est l'identifiant public du fichier sur les serveurs de Pinterest (32 caractères hexadécimaux) ; elle ne permet pas de vous identifier. Le bouton « Réinitialiser » de la fenêtre de l'extension efface vos signalements et les résultats du détecteur ; la désinstallation efface tout le stockage de l'extension. La courte copie des réglages conservée par le site Pinterest s'efface avec les données de ce site (paramètres de Chrome → Confidentialité → Données des sites).

## Les données de Pinterest lues par l'extension

Pour décider quoi masquer, l'extension lit dans la page les informations que Pinterest y charge déjà : titre et description des épingles, dimensions et format des images, mention « Sponsorisé ». Ces informations sont analysées **localement**, dans votre navigateur, et ne sont envoyées nulle part. L'extension peut aussi demander à Pinterest d'appliquer son propre filtre « Moins d'IA » à vos recherches, et retirer de l'affichage les épingles concernées.

## Le détecteur optionnel (désactivé par défaut)

Si vous l'activez vous-même et saisissez **vos propres** identifiants Sightengine, l'extension envoie à Sightengine (sightengine.com) l'**adresse publique** d'une image Pinterest (`https://i.pinimg.com/…`) pour savoir si elle est générée par IA. Aucune autre information n'est envoyée. Le traitement est alors soumis à la [politique de confidentialité de Sightengine](https://sightengine.com/policies/privacy). L'autorisation d'accès à Sightengine n'est demandée qu'à l'activation, et vous pouvez la retirer à tout moment.

## Permissions demandées

- **storage** : conserver vos réglages et vos listes sur votre appareil.
- **Accès aux sites de Pinterest** : lire et filtrer les épingles affichées.
- **api.sightengine.com** (facultative) : uniquement si vous activez le détecteur.

## Contact

Pour toute question : [ouvrez un ticket sur le dépôt du projet](https://github.com/jpipier/tisse-filtre/issues).

---

# Privacy policy — Tissé, Ad & AI filter for Pinterest

*Last updated: November 20, 2026*

The **Tissé — Ad & AI filter for Pinterest** extension hides promoted pins and images that are likely AI-generated on Pinterest pages. It is designed to collect no data.

## What the extension does not do

- It does not collect, sell or transmit any personal data to the extension's publisher or to any third party.
- It uses no analytics, no advertising cookies and no trackers.
- It does not read your browsing history and only runs on Pinterest websites.
- It does not execute any remotely downloaded code.

## What is stored, and where

Everything stays **on your device**:

| Data | Location | Purpose |
|---|---|---|
| Your settings (checked options, display mode) | extension local storage (`chrome.storage.local`) | apply your choices |
| Fingerprints of images you reported as "AI" or marked as "real photo" | extension local storage | stop showing them, or stop hiding them |
| A short copy of the display settings | Pinterest site local storage (`localStorage`) | apply the filter as soon as a page opens |
| If you use the optional detector: its results (fingerprint and verdict) and today's number of calls | extension local storage | avoid analysing the same image twice, respect your daily limit |

An "image fingerprint" is the public identifier of the file on Pinterest's servers (32 hexadecimal characters); it cannot identify you. The "Réinitialiser" (reset) button in the extension window erases your reports and the detector results; uninstalling erases all of the extension's storage. The short copy of the settings kept by the Pinterest website is erased with that site's data (Chrome settings → Privacy → Site data).

## Pinterest data read by the extension

To decide what to hide, the extension reads information Pinterest already loads into the page: pin titles and descriptions, image dimensions and format, the "Promoted" label. This information is analysed **locally**, in your browser, and is sent nowhere. The extension may also ask Pinterest to apply its own "Less AI" filter to your searches, and remove the matching pins from display.

## The optional detector (off by default)

If you turn it on yourself and enter **your own** Sightengine credentials, the extension sends Sightengine (sightengine.com) the **public address** of a Pinterest image (`https://i.pinimg.com/…`) to find out whether it is AI-generated. No other information is sent. Processing is then governed by [Sightengine's privacy policy](https://sightengine.com/policies/privacy). Access to Sightengine is only requested when you turn the detector on, and you can revoke it at any time.

## Requested permissions

- **storage**: keep your settings and lists on your device.
- **Access to Pinterest websites**: read and filter the displayed pins.
- **api.sightengine.com** (optional): only if you turn the detector on.

## Contact

For any question: [open an issue on the project repository](https://github.com/jpipier/tisse-filtre/issues).
