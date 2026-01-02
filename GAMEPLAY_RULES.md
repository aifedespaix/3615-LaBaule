# 🩸 GAMEPLAY RULES & MECHANICS (The Bible)

> **Philosophie :** "Fast, Brutal, Unfair."
> Ce document définit les règles précises qui transforment un simple shooter top-down en une expérience viscérale.
> *Ceci est la source de vérité pour toutes les implémentations mathématiques.*

---

## 1. 🕹️ The 3C's (Camera, Character, Controls)

### A. Mouvements & Inertie
*   **Vitesse de Base :** Rapide. Le joueur ne marche pas, il court.
*   **Accélération :** Quasi-instantanée (2 frames pour atteindre max speed).
*   **Décélération (Friction) :** C'est ici que se joue le "Feel". Le personnage ne s'arrête pas net. Il glisse légèrement (approx. 150ms) après le relâchement de la touche.
    *   *But :* Donner du poids au personnage tout en gardant une réactivité arcade.

### B. Visée (Mouse Look)
*   **Pas de Lock-on :** La visée est 100% manuelle (Skillshot).
*   **Camera "Look Ahead" :** La caméra ne reste pas centrée sur le joueur. Elle se déplace légèrement vers le curseur de la souris (barycentre Joueur/Souris, ratio 70/30).
    *   *Effet :* Permet de voir plus loin dans la direction où l'on vise.

### C. Input Mapping (Revisité)
| Input | Action | Contexte / Détail |
| :--- | :--- | :--- |
| **ZQSD** | Mouvement | Déplacement absolu. |
| **Souris** | Visée | Raycast sol. |
| **Clic GAUCHE** | **FEU / FRAPPE** | Tire (si arme à feu) ou Frappe (si arme blanche). |
| **Clic DROIT** | **LANCER / RAMASSER** | **Si arme en main :** Jette l'arme (Projectile physique).<br>**Si sur une arme :** Ramasse l'arme au sol.<br>**Priorité :** Ramasser > Jeter. |
| **Espace** | **FINISHER (Optionnel)** | *Réservé pour futures features (Roulade ?).* |

---

## 2. ⚔️ Boucle de Combat

### A. Lancer d'Arme (Weapon Throw)
C'est la mécanique de secours et de flow principale.
*   **Physique :** L'arme devient un projectile avec une hitbox rectangulaire rotative.
*   **Impact Ennemi :**
    *   *Dégâts :* Faibles (ne tue pas, sauf headshot chanceux).
    *   *Effet :* **STUN (Étourdissement)**. L'ennemi lâche son arme et recule.
    *   *Flow :* Tirer (Vide) -> Jeter (Stun) -> Ramasser l'arme de l'ennemi -> Tirer.

### B. Pas d'Exécutions au Sol (No Ground Finisher)
*   Contrairement à Hotline Miami, pas d'animation longue qui immobilise le joueur.
*   Un ennemi à terre ou étourdi peut être tué par une simple balle ou un coup de batte standard.
*   *Raison :* Maintenir le rythme frénétique du multijoueur.

### C. Gestion des Armes
*   **Munitions :** Limitées par arme. Une fois vide, l'arme est inutile (sauf pour être jetée). "Click Click" (bruit sec) si on tente de tirer à vide.
*   **Pas de Rechargement :** On ne recharge pas. On jette et on change.

---

## 3. 🥤 Game Feel (The Juice)

C'est la priorité absolue. Les règles mathématiques ci-dessous sont non-négociables.

### A. Screen Shake (Formula: Trauma²)
Nous utilisons un système basé sur le "Trauma" (0.0 à 1.0) pour éviter les secousses linéaires et robotiques.

*   **Variables :**
    *   `Trauma`: Float (0.0 - 1.0).
    *   `MaxAngle`: 10° (Rotation Z de la caméra).
    *   `MaxOffset`: 15px (Déplacement X/Y).
    *   `Decay`: 1.2 par seconde (Linear Decay).
*   **Formule (Exécutée chaque frame) :**
    ```typescript
    shake = trauma * trauma; // Quadratique pour plus de "punch"
    angle = (Math.random() * 2 - 1) * MaxAngle * shake;
    offsetX = (Math.random() * 2 - 1) * MaxOffset * shake;
    offsetY = (Math.random() * 2 - 1) * MaxOffset * shake;

    // Decay
    trauma = Math.max(0, trauma - Decay * dt);
    ```

### B. Hitstop (Freeze Frame)
Le temps (ou juste le rendu) se fige lors d'impacts significatifs.

| Événement | Durée (ms) | Description |
| :--- | :--- | :--- |
| **Impact Fists (Light)** | **8ms** | Impact léger corps à corps. |
| **Impact Batte/Balle** | **12ms** | Impact standard. |
| **Kill (Standard)** | **40ms** | Mort d'un ennemi basique. |
| **Kill (Brutal)** | **80ms** | Headshot, Shotgun close-range, ou Boss. |
| **Mort Joueur** | **150ms** | Souligne l'échec. Laisse le temps au cerveau de réaliser. |

### C. Knockback & "Ice Physics"
Le recul n'est pas juste une force instantanée, c'est un changement d'état physique.

*   **Formule d'Impact :** `Velocity += ImpactVector * (Force / Mass)`
*   **Stun & Slide :**
    *   Quand une entité prend un coup > `Threshold` ou meurt :
    *   **Friction Normale :** `10.0` (Arrêt rapide).
    *   **Friction Stun :** `0.5` pendant **0.5 secondes**.
    *   *Résultat :* Les corps glissent comme sur de la glace.
*   **Domino Effect :** Un corps qui glisse et percute un autre ennemi doit lui infliger un léger `Stagger` (choc).

### D. Chromatic Aberration & VFX
*   Augmente avec le niveau de `Trauma` actuel.
*   Flash blanc très court (1 frame) sur l'écran entier lors d'un kill critique.

---

## 4. ☠️ Coop & Chaos

### A. Friendly Fire (Tir Allié) : ACTIF
*   **Règle :** Les balles des joueurs blessent les autres joueurs.
*   **Dégâts :** Identiques aux ennemis. 1 Shotgun blast = Mort du coéquipier.
*   **Gameplay Émergent :** Force la communication ("Baisse-toi !", "Je passe à gauche !").
*   *Note :* Le corps à corps (Batte) a aussi du Friendly Fire.

### B. Munitions Individuelles
*   Chaque joueur a ses propres armes.
*   Si je ramasse le Shotgun, mon allié ne l'a pas.
*   **Tension :** "Pourquoi t'as pris le Uzi ? T'as déjà un pompe !"
*   Gestion de la pénurie : Il faut laisser des armes aux alliés moins équipés.

### C. Mort & Revive
*   **État "Downed" (Optionnel) :** Le joueur rampe, peut être relevé (Rapide, 1s).
*   **Hardcore Mode :** Mort définitive pour l'étage. Le survivant doit finir seul.

---

## 5. 🔫 Weapon Data (The Arsenal)

Valeurs de référence pour l'équilibrage (Gameplay Loop).
*   **HP Ennemi Standard (Grunt) :** 100 PV.

| Arme | Type | Dégâts | Fire Rate | Munitions | Knockback (Force) | Screen Shake (Trauma Add) | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FISTS (Unarmed)** | Melee | **34** (3 hits kill) | **250ms** | ∞ | **25** (High) | **0.05** | État par défaut. Hitbox courte. |
| **BATTE** | Melee | **100** (1 hit kill) | **600ms** | Durabilité | **50** (X-High) | **0.30** | Large arc de cercle. |
| **PISTOL** | Semi | **50** (2 hits kill) | **400ms** | 12 | **15** | **0.15** | Précis. |
| **UZI** | Auto | **30** (4 hits kill) | **90ms** | 32 | **5** (Low) | **0.04** | Spray & Pray. Accumule vite le Trauma. |
| **SHOTGUN** | Burst | **15 x 8** (120 tot) | **1000ms** | 6 | **10** (x8) | **0.50** | Le roi du "Game Feel". Disperse les foules. |
