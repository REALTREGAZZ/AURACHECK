# VibeScan AI - Design Document

## 1. Vision & Core Concept
**App Name:** VibeScan AI
**Tagline:** "Are you the Main Character or just an NPC?"
**Core Promise:** A 100% offline, serverless, privacy-first mobile web app that analyzes your face to determine your "Vibe" and "NPC Level" using lightweight client-side AI.

## 2. Technical Architecture (The "Ruthless Simplicity" Stack)
*   **Framework:** Vanilla JS + Vite.
*   **AI Engine:** `face-api.js` (Face Detection + Expressions + Landmarks).
*   **Storage:** `localStorage` (for Evolution Mode & History).
*   **Styling:** Vanilla CSS (Neon Glow, Glassmorphism).
*   **Offline Capability:** PWA (Service Worker).

## 3. User Experience (UX) Flow
1.  **Landing Zone:**
    *   Mode Selection: **Solo**, **Duo (Battle)**, **Squad (4p)**, **Glow Up (Diff)**.
    *   "Start Scan" button.
2.  **The Scanner:**
    *   Multi-face tracking.
    *   Random Events (1/25 chance).
3.  **The Reveal:**
    *   **Badges** (Rare/Legendary).
    *   **Stats** (Gyat, Rizz, Villain, etc.).
    *   **Meme Text** (English, roasted).
4.  **Evolution:**
    *   "Your Sigma dropped 12% since yesterday".

## 4. The "Vibe Algorithm" (Logic Mapping)
We use `face-api.js` outputs (Expressions, Landmarks) to calculate the "Vibe Stats".

### Inputs:
*   **Expressions:** Neutral, Happy, Sad, Angry, Fearful, Disgusted, Surprised.
*   **Landmarks:** Eye distance, jawline width (calculated from points).

### Calculated Stats (The "Brainrot" Metrics):
1.  **Core Stats:**
    *   **NPC Level:** (0-5) Based on Neutral expression & lack of movement.
    *   **Gyat Potential:** (Attractiveness/Presence) Symmetry + Jawline.
    *   **Reality Rizz:** (Charisma) Happy + Confidence (Eye contact).
    *   **Villain Arc:** Angry + Dark lighting + Eyebrows down.
    *   **Side Quest Energy:** Confused/Surprised expressions.
    *   **Level of Glazing:** Happy + Wide Eyes (Simping).

2.  **Badges (Gacha System):**
    *   🥇 **Sigma Prime** (Rare)
    *   💀 **NPC Supreme** (Common)
    *   🔮 **Mysterious Rizztocrat** (Epic)
    *   🔥 **Main Character Aura** (Legendary)
    *   ☠ **Villain Awakening** (Rare)

3.  **Modes:**
    *   **Solo:** Standard analysis.
    *   **Duo/Battle:** Compare 2 faces. Winner gets "Mogger" badge.
    *   **Squad:** Assign roles (The Leader, The NPC, The Villain, The Simp).
    *   **Glow Up:** Compare uploaded "Before" vs Camera "Now".

## 5. Visual Style (Aesthetics)
*   **Palette:**
    *   Primary: Neon Purple (`#8A2BE2`)
    *   Secondary: Spring Green (`#00FF7F`)
    *   Background: Void Black (`#0D0D0D`)
    *   Text: White (`#FFFFFF`)
*   **Vibe:** High-contrast, futuristic, "TikTok Native" UI.


## 6. Implementation Plan
1.  **Setup:** Initialize Vite project.
2.  **Core:** Install `face-api.js`.
3.  **UI:** Build the HUD and Camera component.
4.  **Logic:** Implement the `analyzeVibe(detections)` function.
5.  **Canvas:** Implement `drawResultCard()` for sharing.
6.  **Polish:** Add animations and PWA manifest.
