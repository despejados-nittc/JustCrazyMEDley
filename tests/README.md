# Final stage checks

The new-game title option enters a keyboard-only playable Tutorial; Spell continuation still goes directly to Home. Five topics cover movement, collecting credits, red/blue damage and stomps, other hazards, and life recovery/game over. Enter advances after an exercise is completed; R retries it; S or Esc skips to Home at any time (S also works in hosts that reserve Escape). Practice uses Electrical's actual physics/collision/audio routines in a pit-free single-screen arena. Practice credits and completion never update save records.

Run from the project root:

```powershell
node --test tests/*.test.cjs
python -m http.server 8000 --bind 127.0.0.1
```

- `http://localhost:8000/?scene=Final`: the 25-round microgame gauntlet.
- `http://localhost:8000/tests/visual-microgames.html`: frozen rendering gallery; Left/Right cycles all 25 games. Add `?game=solder` (or another ID from `src/minigames/engineering.js`) to choose a starting view. This gallery does not advance timers or write saves.

Final uses only arrows and Space. Each five-round block visits all five departments; all 25 games appear once. Four failures end the run. Surviving all rounds completes the thesis and saves the completion count once. There is no rhythm finale. Each round has an untimed animated demonstration; Space starts the real timer. Arrow keys support holding in movement games, and wrong puzzle inputs give a hint instead of immediately losing a life. The normal Home entrance still requires 150 credits.

The ending after clearing Final hides both the revival-spell heading and spell. Home's normal exit still displays them, including after a previous Final clear. Both endings retain the logo, keyboard return, and automatic return to Title after 60 seconds.

Final difficulty comes from the sum of the five department records (maximum 40 each), ignoring the separate `totalTangye` counter. At 150 credits the challenge is highest; at 200 it is lowest. Between those totals, timers lengthen, movement slows, timing windows widen, and arrow sequences shorten in steps. The profile is fixed for the visit, including retries and all rounds. Separate demonstration puzzles use the same difficulty settings. Direct scene previews without a save use the hardest settings.

Automated checks cover 2,250 solvable game variants (25 games × 3 difficulties × 30 seeds), balanced decks, wrong answers, timeouts, scene input gates, pause/resume, retries, direct ending routing, held movement, untimed demonstrations, forgiving corrections, and save isolation. Phaser rendering is mocked in Node; use the browser gallery for visual checks.

Pit respawn checks cover every department's actual pit layout, narrow islands between consecutive pits, touching/overlapping pits, and Mechanical's existing wall-top respawn. Ground respawns retain the 150px offset when space permits, but stay inside the ground segment before the pit.
All departments ignore item damage for 1.5 seconds after pit respawn; another fall still costs a life.
After respawn, movement and jumping remain blocked until the control keys are released, with no timed delay. Holding a key cannot resume movement; release and press again.

Department naming reference: https://www.tokyo-ct.ac.jp/department/

Timers now use `(game base seconds - tier × 0.2) × (1 - 0.35 × challenge)`, with challenge 1 at 150 tangye and 0 at 200. For example, a 7-second game allows 4.55 seconds at 150 and 7 seconds at 200 before later-round reductions. The old extra 3-second allowance has been removed. Catching/dodging schedules are shortened to fit, and result screens last 0.9 seconds. Demonstrations remain untimed.

To reduce repeated mechanics, six earlier games were replaced: arrow-recipe mixing → temperature control (`thermal`), waveform timing → lightning reaction (`lightning`), numeric balancing → projectile launch (`launch`), polarity matching → flash memory (`memory`), grid specimen finding → counting moving microbes (`microbes`), and metal selection → continuously steering an iron ball through a maze (`magnetmaze`). The run still contains 25 games, five per department.
Audio checks cover credit collection and red/blue contact sounds in all five departments. Red contacts use the glass-crack sound; blue contacts use the stone-breaking sound. Stomps, immune contacts, and converted credits do not trigger contact sounds.
Report damage uses the beep-4 sound in all departments; stomps, immune contacts, and other item types do not trigger this sound.
Denshi's condenser explosion uses the match-blowing-out sound once per explosion, including while immune; stomping a condenser does not trigger it.
Mechanical's scooter damage uses the robot-punch-1 sound, identified by the hazard's scooter type rather than its shared energy-drink group. Stomps, immune contacts, and energy drinks do not trigger this sound.
Energy-drink damage uses the can-opening sound in all departments. Stomps, immune contacts, and Mechanical's scooters do not trigger this sound.
Joho's semicolon damage uses old-ubuntu-error-sound; stomps and immune contacts do not trigger it.
Electrical's original hazard uses E-Kanden.png, with eleven stationary placements including x=600. All are 140px wide, with their actual image bottoms aligned to the ground. Placement tests exclude terrain, pits, and other non-drink hazards' movement envelopes. Damage plays only the first 0.5 seconds of the electrical-crackling sound via a Phaser sound marker; stomps and immune contacts do not trigger it.
Chemical's original hazard damage plays only the first 0.6 seconds of the wine-pouring sound via a Phaser sound marker; stomps and immune contacts do not trigger it.
All departments loop the first 0.2 seconds of the asphalt-running sound only during actual grounded movement. Running audio stops on jumping, blocked movement, damage, capture, game over, leaving, pause, sleep, and scene shutdown.
Block head hits from below play button-44 in all departments, including hidden blocks. Landing on top or touching the side does not trigger this sound.
All departments play cancel-9 for an accepted jump and the jump-landing sound when transitioning from airborne to grounded, including block landings. Standing still and rejected jumps do not repeat these sounds.
Accepted jumps also play the light-touch sound once alongside cancel-9, without looping. Simply falling into a pit does not trigger it.
The light-touch jump sound stops on landing or contact with blocks and items, including stomps and immune contacts, in Home and all departments. Other sound effects are not stopped.
Home uses the same running loop, takeoff, extra jump, landing, and block head-hit sounds. Automatic entrance is silent; landing during a stage-transition fade plays once.
All five department stages loop Maou Damashii's 8bit05 at 20% volume without changing effect volumes. BGM pauses/resumes with the scene and is destroyed on shutdown, so it does not continue in Home or overlap after stage re-entry.
Star invincibility and Mechanical's raised-camera lucky zone switch BGM to maou_bgm_8bit29, looping at the same 20% volume. Normal BGM restarts only after both modes end. Brief damage/respawn immunity does not switch music.
Stomping a moving red or blue grade plays button-33 once when it converts to a credit, including while immune. Side-contact damage sounds and later credit-collection sounds remain unchanged.
Damage knockback cannot stomp red/blue grades on the way down, even after the damage animation ends. Landing, pit respawn, a fresh accepted jump, or resetting a tutorial exercise restores normal stomps; star invincibility alone does not disable them.
Electrical and its inherited Tutorial keep this protection through the landing frame's item collisions, clearing it on the next grounded frame. Tutorial regression checks use the real Electrical damage and grade collision routines.
Stomping other damage items (reports, energy drinks, scooters, and department hazards) plays button-50 in all departments, including while immune. Red/blue stomps retain button-33.
Mechanical energy-drink spawns reserve the full rotating sprite envelope, not just the 40px collision box, to avoid spawning images inside walls or overhead blocks. If no safe location exists, no object is created.
Electrical now uses the same shared spawn-clearance helper for initial and timed energy drinks, including Tutorial's inherited drink placement.
Denshi has ten additional ground-level condensers spread across the stage. Placement checks include full horizontal movement envelopes and sprite sizes to avoid pits, stage edges, other condensers, red/blue grades, and reports; energy drinks are excluded.
