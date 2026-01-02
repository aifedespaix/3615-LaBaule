# 🩸 GAMEPLAY RULES & MECHANICS (Mini-GDD)

> **Philosophie :** "Fast, Brutal, Unfair."
> Ce document définit les règles précises qui transforment un simple shooter top-down en une expérience viscérale.

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

C'est la priorité absolue. Le jeu doit "faire mal" visuellement.

### A. Hitstop (Freeze Frame)
Le jeu se fige pendant quelques millisecondes lors d'un impact impactant.
*   **Kill Ennemi :** 50ms.
*   **Mort Joueur :** 100ms (Accentue la brutalité de la mort).
*   **Explosion :** 80ms.

### B. Screen Shake (Secousses)
La caméra tremble selon l'intensité de l'action.
*   **Directionnel :** Le recul de l'arme pousse la caméra dans la direction opposée au tir.
*   **Trauma :** Valeur float (0.0 à 1.0) qui décroît avec le temps (Linear decay).
    *   *Tir Uzi :* 0.05 per shot.
    *   *Tir Shotgun :* 0.4 per shot.
    *   *Explosion :* 1.0.

### C. Knockback (Recul Physique)
*   **Corps :** Les ennemis (et joueurs) sont physiquement repoussés par les balles.
*   **Ragdoll (Simulé) :** À la mort, appliquer une force violente dans la direction du tir fatal. Le corps doit glisser au sol (avec friction et traînée de sang).

### D. Chromatic Aberration & VFX
*   Augmente avec le niveau de "Stress" ou de "Trauma" de l'écran.
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
*   **Hardcore Mode :** Mort définitive pour l'étage. Le survivant doit finir seul. (Recommandé pour commencer).
