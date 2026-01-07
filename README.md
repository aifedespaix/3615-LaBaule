# 📞 3615 LA BAULE

> **Pitch :** Un shooter top-down coopératif ultra-violent et procédural.
> **Vibe :** *Hotline Miami* rencontre le Minitel sur la Côte d'Amour.
> **Stack :** Bun + React Three Fiber + WebSockets.

---

## 📑 Table des Matières
1. [Architecture & Stack](#-architecture--stack)
2. [Game Design & Mécaniques](#-game-design--mécaniques)
3. [Système de Lobby (Le 3615)](#-système-de-lobby-le-3615)
4. [Génération Procédurale & Scaling](#-génération-procédurale--scaling)
5. [Physique & Moteur Custom](#-physique--moteur-custom)
6. [Protocole Réseau](#-protocole-réseau)
7. [UI/UX & Art Direction](#-uiux--art-direction)
8. [Data & Assets](#-data--assets)
9. [Graphics & Optimization](#-graphics--optimization)
10. [DevOps & Déploiement](#-devops--déploiement)
11. [Structure du Code](#-structure-du-code)
12. [Instructions pour Agents (AI)](#-instructions-pour-agents-ai)

---

## 🚀 Architecture & Stack

Le projet privilégie la **performance brute** (60fps stable) et la **Developer Experience**.

| Scope | Technologie | Justification |
| :--- | :--- | :--- |
| **Runtime / Serveur** | **Bun** | Démarrage instantané, WebSockets natifs ultra-rapides, TypeScript natif. |
| **Frontend Framework** | **Next.js 16.x** | App Router, Server Components, et structure de l'app. |
| **Moteur 3D** | **React Three Fiber (R3F)** | Rendu WebGL déclaratif. Gestion du cycle de vie des objets. |
| **Optimisation 3D** | **@react-three/drei** | Utilisation massive de \`<Instances />\` pour murs/balles. |
| **UI Overlay** | **Shadcn/ui + Tailwind** | Interface vectorielle propre par-dessus le Canvas. |
| **State Manager** | **Zustand** | Store global (Score, Lobby) hors de la boucle de rendu. |
| **Physique** | **Custom (Maths Pures)** | Pas de moteur lourd. Collisions AABB & Cercles manuelles. |

---

## 🎮 Game Design & Mécaniques

> **Voir le document complet :** [GAMEPLAY_RULES.md](./GAMEPLAY_RULES.md) (Règles détaillées, 3C's, Game Feel).

### La Boucle de Gameplay (The Loop)
1.  **Connexion (3615) :** Les joueurs se connectent au Lobby (Interface Minitel).
2.  **Infiltration :** Entrée dans une salle $\rightarrow$ **Verrouillage immédiat** (Portes rouges/Grilles).
3.  **Purge :** Elimination de tous les ennemis. Gameplay "High Lethality" (1 ou 2 coups pour tuer/mourir).
4.  **Déblocage :** Salle vide $\rightarrow$ Lumière verte $\rightarrow$ Accès salle suivante.
5.  **Boss :** Fin de l'étage (Le Syndic, Le Maitre Nageur, etc.).

### Contrôles
* **Mouvement :** ZQSD (Déplacement absolu).
* **Visée :** Souris (Raycast sur plan infini au sol).
* **Action :** Clic Gauche (Tir/Frappe), Clic Droit (Lancer d'arme/Ramasser).

### Ennemis & Comportements (FSM)
* **Le Touriste (Grunt) :** Patrouille. Fonce sur le joueur si vue dégagée. Arme de corps à corps (batte/couteau).
* **Le Résident (Shooter) :** Se met à couvert. Tire à vue. Statique mais précis.
* **Le Gardien (Tank) :** Lent, beaucoup de PV (Shotgun).

---

## 📟 Système de Lobby (Le 3615)

Pour respecter le thème Minitel, pas de liste de serveurs complexe. On utilise un système de "Codes Courts".

### Flux de Connexion
1.  **Host (Serveur) :**
    * Crée une \`Room\`.
    * Le serveur génère un **Code 4 caractères** (ex: \`8492\`, \`AZUR\`, \`BAUL\`).
    * État : \`WAITING_FOR_PEER\`.
2.  **Client (Joiner) :**
    * Entre le code sur le pavé numérique de l'UI.
    * Le serveur valide. État : \`CONNECTED\`.
3.  **Lancement :**
    * Les deux joueurs appuient sur "PRÊT" (touche ENVOI du Minitel).
    * Compte à rebours synchronisé.
    * Le serveur charge la Map procédurale.

---

## 🎲 Génération Procédurale & Scaling

Le jeu adapte la carte et la difficulté selon le nombre de joueurs ($N_p$) présents au lancement de la partie.

### Algorithme de Salle
* **Grille :** Chaque salle est une grille 2D de tuiles (Tilemap) convertie en 3D.
* **Types de Salles :** \`Start\`, \`Fight\`, \`Corridor\`, \`Reward\`, \`Boss\`.

### Scaling de Difficulté (1 vs 2 Joueurs)
| Variable | Solo ($N_p=1$) | Coop ($N_p=2$) |
| :--- | :--- | :--- |
| **Taille Salle** | Standard (12x12) | Large (18x18 ou Fusion de 2 standards) |
| **Ennemis** | Base Count ($X$) | $X \times 1.8$ (Focus sur la saturation) |
| **Portes** | 1 Entrée / 1 Sortie | Activation de portes latérales (Flanking) |
| **Loot** | 1 Arme par reward | Munitions Individuelles + Friendly Fire |

---

## 📐 Physique & Moteur Custom

Pour garantir la fluidité réseau, nous n'utilisons **PAS** de moteur physique type Cannon.js ou Ammo.js.

### 1. Collisions (Côté Serveur & Client prédit)
* **Map statique :** Grille 2D. Collision en $O(1)$ (\`if (grid[x][y] == WALL)\`).
* **Entités dynamiques :** Intersection Cercle (Joueur) vs AABB (Meubles).
* **Portes :** Ce sont des objets physiques rotatifs (Simulés par maths).
    * *Logique :* Si \`Collision(Joueur, Porte)\` $\rightarrow$ Appliquer force rotationnelle à la porte.
    * *Interaction :* La porte qui tourne repousse les ennemis (Knockback).

### 2. Balistique (Raycasting)
* **Détection :** Hitscan (Raycast instantané) sur le serveur.
* **Rendu :** Le client dessine un "Tracer" (TrailRenderer) jaune néon qui voyage de A à B en 3 frames pour l'effet visuel "Hotline".

---

## 📡 Protocole Réseau & Netcode

> **Documentation Technique :** Voir [NETCODE_SPECS.md](./NETCODE_SPECS.md) pour les schémas binaires et algorithmes détaillés.

L'architecture réseau est conçue pour supporter un gameplay rapide et précis (Shooter), sans compromis sur la sécurité (Anti-Cheat).

### Architecture Hybride
*   **Modèle :** Serveur Autoritaire (Bun) / Client Prédicteur (React).
*   **Transport :** WebSockets (Binary ArrayBuffers).
*   **Tickrate :** 30Hz (Serveur) / 60Hz+ (Client Rendu).

### Optimisations Clés
*   **Schéma Binaire :** Pas de JSON. Utilisation de paquets binaires compacts (`UInt8`, `Int16` Fixed-Point).
    *   *Position :* Précision au centimètre (-327.68m à +327.67m).
    *   *Rotation :* Précision angulaire `UInt16`.
*   **Latence & Lag Compensation :**
    *   **Prédiction :** Le client simule ses propres mouvements instantanément (Zero Input Lag).
    *   **Reconciliation :** En cas de désaccord, le client re-simule ses inputs (Replay) pour corriger sa position sans "teleport" visuel brutal.
    *   **Interpolation :** Les ennemis et alliés sont interpolés avec un buffer de 100ms pour fluidifier les mouvements malgré le Jitter.

---

## 🎨 UI/UX & Art Direction

> **Guidelines Complètes :** Voir [UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md) pour la charte graphique, les animations, et le sound design.

### Philosophie "Néo-Rétro"
Nous ne faisons pas de l'émulation stricte, mais une stylisation moderne du souvenir Minitel.
*   **Palette :** 8 Couleurs Vidéotex pures (Cyan, Magenta, Jaune...) sublimées par du Bloom.
*   **Immersion :** Séquence de boot avec son modem V.23, affichage caractère par caractère.
*   **HUD :** Structure en bandeau (Haut/Bas) mais cœur de l'écran transparent pour le combat.

### Interface (Shadcn)
*   **Structure :** L'UI est rendue en HTML/CSS via Tailwind au-dessus du Canvas WebGL.
*   **Terminologie :** Utilisation des touches Minitel (`ENVOI`, `CORRECTION`, `CONNEXION`, `SUITE`).

---

## 💾 Data & Assets

### Système d'Armement (Data Driven)
Fichier de config partagé (\`shared/weapons.ts\`).
\`\`\`typescript
type WeaponConfig = {
  id: string;          // 'uzi', 'shotgun', 'bat'
  type: 'MELEE' | 'HITSCAN' | 'PROJECTILE';
  damage: number;      // Dégâts (100 = One Shot)
  fireRate: number;    // Délai en ms entre deux tirs
  spread: number;      // Cône de dispersion en degrés
  range: number;       // Portée maximale
  screenShake: number; // Intensité du "Juice" visuel (0.0 à 1.0)
}
\`\`\`

### Système "Gore" Optimisé (Object Pooling)
* **Technique :** \`InstancedMesh\` pré-alloué (Pool de 1000 items).
* **Logique :** Buffer Circulaire. Quand une tache apparaît, on met à jour la matrice d'une instance existante et on incrémente l'index. 0 allocation mémoire en jeu.

### Sound Design
* **Musique :** Synthwave sombre. **Ne coupe pas au Respawn**.
* **Spatialisation :** \`PositionalAudio\` (Three.js) pour localiser les ennemis au son.

---

## 🖌 Graphics & Optimization

> **Détails Techniques :** Voir [GRAPHICS_SPECS.md](./GRAPHICS_SPECS.md).

### 1. Asset Pipeline (Web Standard)
*   **Compression :** TOUS les modèles doivent utiliser **Draco Compression** (via `gltf-pipeline`). Les textures doivent être au format **KTX2**.
*   **Lighting :**
    *   **Map :** Lightmaps "Bakeées" (Textures UV2). Pas de lumières dynamiques.
    *   **Objets :** Blob Shadows (Ombres pré-calculées simples). Pas de Shadow Maps temps réel.
*   **Material :** Utilisation stricte de `MeshBasicMaterial` ou `MeshLambertMaterial`. Le PBR (`MeshStandardMaterial`) est proscrit pour garantir les performances.

### 2. Post-Processing "Minitel"
*   Shader Custom CRT (Scanlines + Courbure + Aberration Chromatique).
*   Implémenté via `@react-three/postprocessing`.

---

## 🚢 DevOps & Déploiement

Un serveur de jeu WebSocket nécessite une connexion persistante (pas de Serverless classique).

### Dockerfile (Bun Optimized)
\`\`\`dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install
RUN bun run build
EXPOSE 3000
CMD ["bun", "run", "server/index.ts"]
\`\`\`

### Hébergement
* **Recommandé :** Railway, Fly.io, ou VPS (Hetzner/DigitalOcean).
* **Reverse Proxy :** Doit supporter l'upgrade WebSocket (\`Connection: Upgrade\`).

---

## 📂 Structure du Code

\`\`\`text
/
├── /server                 # BACKEND (Bun)
│   ├── index.ts            # WebSocket Entry Point
│   ├── game.ts             # Game Loop & State Logic
│   └── rooms.ts            # ProcGen Algorithms
│
├── /src                    # FRONTEND (Next.js App)
│   ├── /app                # App Router ((game), (platform))
│   ├── /components
│   │   ├── /game           # R3F Components (Player, Level, Bullets)
│   │   └── /ui             # HTML Overlay (HUD, Menus)
│   ├── /stores             # Zustand (Global State)
│   └── /hooks              # Custom Hooks (useKeyboard, useSocket)
│
├── /shared                 # CODE PARTAGÉ (Single Source of Truth)
│   ├── types.ts            # Interfaces TS
│   ├── math.ts             # Collisions & Vector logic
│   └── constants.ts        # Config (Speed, Damage, MapSize)
\`\`\`

---

## 🤖 Instructions pour Agents (AI)

**Si vous codez avec une IA (Cursor, Copilot, Windsurf), donnez-lui ces règles :**

1.  **PERFORMANCE FIRST :**
    * Jamais de \`new Vector3()\` dans \`useFrame\`. Toujours réutiliser des vecteurs scratch.
    * Pas de logique lourde dans le thread UI React.
    * Utiliser \`useRef\` pour manipuler les objets 3D, pas \`useState\`.
2.  **REACT THREE FIBER :**
    * Privilégier \`<Instances />\` pour tout objet dupliqué > 10 fois.
    * Séparer la logique visuelle (Client) de la logique d'état (Zustand/Serveur).
3.  **STRICT TYPESCRIPT :**
    * Pas de \`any\`.
    * Les types réseaux (Message Packets) doivent être stricts et partagés dans \`/shared\`.

---

## 📅 Roadmap

- [ ] **Phase 1 : Le Moteur (J+2)**
    - Setup Bun + R3F.
    - Mouvement "Glissant" + Visée Souris.
    - Synchro WebSocket basique.
- [ ] **Phase 2 : La Map (J+5)**
    - Génération Grille 10x10.
    - Murs Instanciés + Collisions.
- [ ] **Phase 3 : Violence (J+10)**
    - Tir (Raycast) + Gore System.
    - Ennemis (State Machine simple).
- [ ] **Phase 4 : Structure (J+15)**
    - Room Manager (Lock/Unlock).
    - Lobby Minitel & Scaling 2 joueurs.
