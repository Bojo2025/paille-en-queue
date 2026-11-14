# Paille-en-Queue

<img src="assets/sprites/logoIcon.png" height="40" alt="Bojo Solutions logo"> &nbsp; <sub>Developed by Mr Boyjonauth Kevin &middot; **Bojo Solutions**</sub>

A mobile-first 2D runner across the Republic of Mauritius. You fly a white-tailed tropicbird (the *paille-en-queue*) through 18 levels: from Pereybere round the main island, over the northern islets, up a Rodrigues waterfall and out to Agalega and the Saint-Brandon cyclone. It's plain HTML5 Canvas and vanilla JavaScript with no libraries and no build step. All images are embedded in `js/assets.js`, so you can open `index.html` straight from the file system (file://) on a desktop or a phone.

## How to play
- **Fly:** tap or hold to flap up and let go to drop. On a keyboard use Space, Up or W.
- **Energy** (the green bar) drains all the time. Catch leaping fish to refill it. If energy reaches 0 and you touch the sea, the run is over.
- **Tail streamers** are your health. Each hit costs one. You lose when they're all gone. Every 10-catch chain grows one back, up to 4 (5 with the Fifth Streamer move).
- **Combo:** catches in a row raise the multiplier from x1 to x8. The music builds up as the combo grows. The combo drops a step if you go 4.5 s without a catch (6 s with Star Navigator).
- **Near miss:** brush past danger without touching it for bonus points, a short slow-motion moment, a whoosh and a bird call.
- **Stars:** 1 for finishing, +1 for catching 40% of the fish, +1 for catching 60% of the fish with no more than 1 hit. In level 5, finishing the regatta in 1st place also earns 3 stars. Some later levels have their own star rules: L11 counts chicks fed, L14 needs 2 parades and L17 needs the Southern Cross gates.
- **Kreol callouts:** "Bravo!", "Atansion!", "Lapli pe vini!", "Gete sa!" and more.
- **Pause:** P or Esc, or the II button. **Mute:** the note button.

### Moves unlocked by finishing levels (they carry into later levels)
| Finish | Unlocks | Use |
|---|---|---|
| L1 | Fish Sense | Bigger catch radius |
| L2 | Dive | Swipe down, S, Down arrow or the DIVE button: plunge under the surface for deep fish |
| L3 | Slipstream Pro | Slipstream fills 2x faster and the boost lasts longer |
| L4 | Glide | Let go while falling: slower fall and half the energy drain |
| L5 | Speed Burst | Swipe right, D, Right arrow or the BURST button: a dash that passes through danger |
| L6 | Barrel Roll | Swipe up, E, Shift or the ROLL button: spin and dodge one hit |
| L7 | Eagle Eye | Wider near-miss window |
| L8 | Wave Skimmer | Touching the sea costs no energy, and surfing is faster |
| L9 | Thermal Soar | Glide falls slower and thermals lift harder |
| L10 | Quick Wings | Faster climbing for tight gaps |
| L11 | Fifth Streamer | Your tail can grow a 5th streamer |
| L12 | Wind Reader | Gusts and cyclone winds push you 40% less |
| L13 | Flock Sense | Speed Burst recharges in 5 s instead of 7 s |
| L14 | Courtship Loop | Barrel Roll recharges faster and scores style points |
| L15 | Strong Heart | All energy drain is 15% lower |
| L16 | Fish Magnet | Catch fish from further away |
| L17 | Star Navigator | The combo timer lasts 6 s |
| L18 | Legend of Mauritius | A golden glow: you have flown it all |

## The 18 levels
Each level takes about 2.5 to 3 minutes and ends with a harder final section. Finishing a level unlocks the next one, and the level select shows them all on a map of Mauritius with insets for Rodrigues, Agalega and Saint-Brandon.

1. **Pereybere to Cap Malheureux:** bounce on beach umbrellas and dodge kites and kids on the sand. Fishing nets and hook lines rise and fall, so time the gaps. Ends at the red-roofed church.
2. **Coin de Mire:** masked boobies dive-bomb you, and their shadow on the water warns you first. Three basalt cliff corridors get narrower and narrower.
3. **Ile Gabriel & Ile Plate:** a parade of catamarans. Go over the mast or under the boom, and fly just behind a sail to fill the slipstream boost. Tourist camera flashes white out the screen. Deep fish reward the Dive.
4. **Ile aux Cerfs:** parasail tow ropes, golf balls arcing in from the island course, and banana-boat spray that makes you wet and heavy. Ends with a rain squall ("Lapli pe vini!") that pushes you down.
5. **Mahebourg & Grand-Port:** first a pirogue regatta race (fly low and draft to go faster; your place earns 200-3000 bonus). Then the ghost frigates of the 1810 Battle of Grand Port fire cannonballs in arcs through smoke.
6. **Ile aux Fouquets & Ile aux Aigrettes:** a night flight. Two rotating lighthouse beams are the only thing that shows fish and reef rocks. Lit buoys glow on their own. On the protected shore, touching nests or giant tortoises costs points.
7. **Le Souffleur & Le Pont Naturel:** blowholes rumble, then fire water jets that launch you up to high fish. Thread the natural basalt arches along the gold line for a PERFECT LINE bonus. Black sea stacks are deadly.
8. **Gris-Gris:** no reef, just giant waves. Fly low in front of a wave face to surf (speed and points), keep clear of the curling lip, and avoid the heavy spray of La Roche qui Pleure.
9. **Bassin Blanc:** flapping costs double energy in the thin crater air. Let go inside warm thermals to circle up over the ridges, read the lake reflections to find hidden fish, and fly through fog banks.
10. **Black River Gorges:** a dusk canyon run. The walls pinch into narrow gaps, swarms of fruit bats cross the gorge, waterfalls push you down and the river is your floor.
11. **Chamarel cliffs:** catch fish to carry them (up to 3), then fly over a ledge nest to feed the chick. Macaques climb towards the nests: swoop down onto them to scare them off. Rocks fall from the top.
12. **Crystal Rock & Ile aux Benitiers:** drop onto a dolphin's back for a boost, read the gust lines, and watch the sandbank rise as the tide goes out.
13. **Ile aux Serpents:** weave through a shape-shifting murmuration of terns and noddies, and fly high over the colony where territorial birds dive at you.
14. **Round Island:** fly through feather hoops in order for style points, complete a hoop set for a PARADE bonus, shake off rival tropicbirds with a roll or burst, and dodge boulders on the crumbling slopes.
15. **Rodrigues - Cascade Victoire:** a vertical climb up a waterfall (the screen is turned so you fly upward). Water curtains slow you down, falling rocks are marked at the top, and cliff ledges let you rest and refill.
16. **Ile aux Cocos & Ile aux Sables:** the tide comes in and out. Low tide brings up sandbars and coral heads, and frigatebirds tuck their wings and then lunge to steal your fish. Change height at the last moment to make them miss.
17. **Agalega - the open ocean:** an endurance flight. In the midday sun energy drains 1.6x faster unless you fly in cloud shade. Then night falls, and the Southern Cross points to the open lane through each hidden squall wall.
18. **Saint-Brandon - the cyclone (finale):** phase 1 is rain bands, where a white preview line shows each lightning strike before it hits. Phase 2 is the eyewall, with swinging wind and orbiting debris. Then comes the calm eye, where you feed and rest, and phase 3 is the escape with everything at once. Afterwards a victory screen shows your total stars out of 54 and the credits.

## Options
- `index.html?level=N` jumps straight to level N.
- `index.html?demo=1` turns on autopilot. Demo mode never dies: hits only cost streamers down to 1, and energy is topped up to 12 if it runs out over the sea. It plays all 18 levels in a row and then shows the victory screen.
- Progress, unlocks and best scores are saved in `localStorage`.

## Files
- `index.html` and `css/style.css`: the screens (title with credits, map level select, how-to-play, level card, pause, game over, level complete, victory) and the HUD.
- `js/assets.js`: everything visual as base64 data URIs, generated by `tools/make_assets.py` from `assets/source`. That covers:
  - the painted backgrounds for all 18 levels, plus the title and victory images
  - four painted tile textures (basalt, jungle rock, tuff, wave water) used to fill rocks, cliffs, canyons and waves
  - the painted sprites with transparent backgrounds: pirogue, pointu, catamaran hull, sail, speedboat, banana boat, ghost frigate, parasail, umbrella, dolphin, macaque, fruit bat, frigatebird
  - the Bojo Solutions logo and the favicon (just the BS icon)

  The sprites are generated on a green screen, then chroma-keyed (matte, despill, edge erode and feather), cropped and saved as WebP with alpha.
- `js/audio.js`: the WebAudio engine. It unlocks on the first gesture (with the iOS silent-buffer trick) and runs through a compressor and limiter. It plays procedural sega music (ravanne, maravanne, bass, chords and melody) whose intensity follows the combo. Each region has its own style: north and east lagoon, south coast, the west, the islets, Rodrigues, the outer islands, night and the cyclone storm. There are also 40 synthesized sound effects.
- `js/art.js`: procedural drawing for the bird, hazards and props. These vector versions are also the fallback if a sprite fails to load.
- `js/sprites.js`: draws the painted boats and animals. Hulls sit on the waterline with bobbing and pitch, a wake and bow foam, and a soft reflection. Hull colours are hue-shifted, sails are dyed, and the 1810 frigates get a teal ghost version. The hitboxes are the same as the vector boats.
- `js/levels.js` and `js/levels2.js`: level definitions, perks, regions, music styles and the seeded level generators (1-6 and 7-18).
- `js/game.js`: the game loop, physics, collisions, scoring, screens, input and demo autopilot.
- `tools/test_headless.js`: a headless Chrome test (`NODE_PATH=/workspace/pptr/node_modules node tools/test_headless.js`). It checks menus and audio, flies all 18 levels to the finish in demo mode, takes the boss-phase, victory and mobile shots, checks touch input and game over, and saves the screenshots. `node tools/test_headless.js levels 7 18` runs just a range of levels. `tools/shot_boats.js` takes the painted-boat close-ups (`screenshots/50_boats_*.png`).
- `tools/record_preview.js`: renders `preview/paille-en-queue-preview.mp4` (16 s, using ffmpeg): the title and then levels 3, 7, 8, 10, 14, 17 and 18.

## Credits
Developed by **Mr Boyjonauth Kevin** &middot; **Bojo Solutions**. The title screen, the victory screen and this README all carry the credit.
