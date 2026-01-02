# 📟 UI/UX Guidelines: 3615 LA BAULE

> **Philosophie :** "Le souvenir du Minitel, pas la réalité du Minitel."
>
> Nous visons une esthétique **Néo-Rétro / Synthwave**. L'interface doit évoquer le Minitel (Vidéotex) par ses codes couleurs et sa structure, mais doit offrir la fluidité (60fps), la lisibilité et le "juice" d'un jeu moderne (Bloom, CRT Shader, Animations).

---

## 🎨 Palette & Visuel

L'interface repose sur la palette stricte du standard Vidéotex (8 couleurs), sublimée par des effets de post-processing.

### Palette Vidéotex (Base)
Les couleurs doivent être utilisées pures pour les éléments UI, mais peuvent être affectées par le Bloom (lueur).

| Couleur | Nom Minitel | Hex (Web) | Usage |
| :--- | :--- | :--- | :--- |
| ⚫ | **Noir** | `#000000` | Fond d'écran, "Vide" |
| 🔴 | **Rouge** | `#FF0000` | Erreur, Danger, Ennemis, Verrouillage |
| 🟢 | **Vert** | `#00FF00` | Succès, Validation, Safe, Loot |
| 🟡 | **Jaune** | `#FFFF00` | Balles, Info importante, Curseur |
| 🔵 | **Bleu** | `#0000FF` | Éléments décoratifs sombres |
| 🟣 | **Magenta** | `#FF00FF` | Accents Cyber, Titres, Hostile Élite |
| 💠 | **Cyan** | `#00FFFF` | Murs, UI Standard, Texte courant |
| ⚪ | **Blanc** | `#FFFFFF` | Surbrillance, Flash |

### Post-Processing (The "Neo" Touch)
Pour éviter l'austérité du Minitel réel, l'UI est rendue via une caméra séparée avec les effets suivants :
1.  **Bloom :** Léger halo sur les textes (surtout Cyan et Magenta).
2.  **Scanlines :** Lignes horizontales fines (opacité 20%).
3.  **Chromatic Aberration :** Décalage RGB très léger sur les bords de l'écran (Vignette).
4.  **Curvature :** Légère déformation sphérique pour imiter l'écran bombé.
5.  **Ghosting :** Traînée légère lors des mouvements rapides de l'interface.

---

## 🔠 Typographie

La typographie est cruciale. Elle doit être monospacée et pixelisée, mais lisible.

*   **Font Principale :** `VT323` (Google Fonts) ou `Mode Seven`.
    *   *Usage :* Tout le texte courant, HUD, Menus.
    *   *Taille :* Large (pour compenser le côté pixel).
*   **Font Titres :** `VCR OSD Mono`.
    *   *Usage :* Logos, "GAME OVER", "VICTOIRE".
*   **Comportement :**
    *   Pas d'anti-aliasing (text-rendering: alien/pixelated).
    *   Ombre portée dure ("Drop Shadow") noire pour détacher le texte du fond 3D.

---

## 🔌 Flow de Connexion "3615"

C'est la première interaction du joueur. Elle doit installer l'ambiance immédiatement.

### Séquence de Boot
1.  **Black Screen :** 1 seconde.
2.  **Sound :** Bruit d'interrupteur mécanique (Click).
3.  **Warm-up :** L'écran s'allume (fade in blanc rapide -> noir). Le bruit statique CRT démarre.
4.  **Handshake (Audio) :** Son du modem V.23 (Tonalité stridente brève) pendant l'affichage du logo.
5.  **Terminal :** Affichage caractère par caractère du texte d'accueil.
    *   *Vitesse :* Rapide (env. 30ms par caractère).
    *   *Son :* "Blip" très court et grave à chaque caractère.

### Exemple de Texte
```text
> 3615 LA BAULE
> CONNECTING...
> BAUD RATE: 1200/75
> CHECKING VRAM... OK
> SEARCHING FOR HOST...
```

---

## 🕹️ HUD (Head-Up Display)

Le HUD respecte la structure "Page Minitel" (25 lignes de 40 colonnes) sans obstruer la vue.

### Structure
*   **Ligne 0 (Bandeau Haut) :** Fond Noir opaque (ou semi-transparent 90%).
    *   *Gauche :* `SCORE: 001500`
    *   *Droite :* `ETAGE: -2` (Sous-sol)
*   **Ligne 1-23 (Zone de Jeu) :** TOTALEMENT TRANSPARENT.
    *   Aucune grille visible.
    *   Les éléments diégétiques flottent dans l'espace 3D.
*   **Ligne 24 (Bandeau Bas) :** Fond Noir opaque.
    *   Barre d'état contextuelle et touches de fonction.

### Indicateurs Diégétiques (In-World)
Au lieu de barres de vie fixes dans un coin :
*   **Santé :** Le contour de l'écran devient rouge et pulse (Vignette rouge) quand la santé est basse. Glitch graphiques (artefacts) augmentent avec les dégâts.
*   **Munitions :** Compteur flottant (Billboard 3D) à côté du personnage.
    *   *Style :* `12/30` en Jaune Néon.
    *   *Animation :* Tremble quand on tire. Devient Rouge si < 20%.
*   **Rechargement :** Barre de progression fine sous le personnage.

---

## ⌨️ Interactions & Terminologie

On remplace le vocabulaire "Gamer" standard par celui du clavier Minitel AZERTY.

### Mapping Sémantique

| Action Jeu | Terme Minitel | Touche Virtuelle (UI) | Couleur Bouton |
| :--- | :--- | :--- | :--- |
| **Start Game** | `CONNEXION` | Touche `CONNEXION` | 🟢 Vert |
| **Ready / OK** | `ENVOI` | Touche `ENVOI` | 🟢 Vert |
| **Back / Cancel** | `CORRECTION` | Touche `CORRECTION` | 🟡 Jaune |
| **Settings** | `SOMMAIRE` | Touche `SOMMAIRE` | 🔵 Bleu |
| **Help / Info** | `GUIDE` | Touche `GUIDE` | 🔵 Bleu |
| **Quit** | `FIN` | Touche `FIN` | 🔴 Rouge |
| **Next / Skip** | `SUITE` | Touche `SUITE` | ⚪ Blanc |

### Feedback Sonore (UI)
*   **Hover :** Bruit de fréquence léger (bip aigu).
*   **Click :** Bruit de touche clavier mécanique lourd (Thock).
*   **Validation (Envoi) :** Son de modulation (Data sent).
*   **Erreur :** Bip système "Error" (Buzzer grave).

---

## 🔊 Audio Guidelines (UI)

*   **Earcons :** Le son du modem (V.23) est utilisé comme feedback de succès majeur (Connexion Lobby réussie, Level Complete). Ne jamais le boucler.
*   **Ambiance Menu :** Léger bourdonnement électrique (Mains hum) + Bruit ventilo ordinateur étouffé.
