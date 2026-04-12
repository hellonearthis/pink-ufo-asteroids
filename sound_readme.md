# Sound Sprite Mapping Reference

The following table lists all **33 sprites** defined in `GameSound_sprite.json` and their current (or suggested) assignments in the `SoundManager.js`.

| Sprite #      | Duration (ms) | Current Assignment         | Suggested Use Case       |
| :------------ | :------------ | :------------------------- | :----------------------- |
| **Sprite 1**  | 1598          | **Shots Fired (Pool)**     | Random Variation         |
| **Sprite 2**  | 461           | **Shots Fired (Pool)**     | Random Variation         |
| **Sprite 3**  | 460           | **Large Asteroid Boom**    | Boom                     |
| **Sprite 4**  | 708           | **Shots Fired (Pool)**     | Random Variation         |
| **Sprite 5**  | 868           | **Shots Fired (Pool)**     | Random Variation         |
| **Sprite 6**  | 689           | **Shots Fired (Pool)**     | Random Variation         |
| **Sprite 7**  | 1834          | **Ship Noise (Hum)**       | Background / Ambient     |
| **Sprite 8**  | 1449          | -                          | dialog, oh no a asteroid |
| **Sprite 9**  | 990           | **Game Over**              | Game Over                |
| **Sprite 10** | 1140          | **Game Over**              | Game Over                |
| **Sprite 11** | 1454          | **Game Over**              | Game Over                |
| **Sprite 12** | 877           | **Shots Fired (Pool)**     | Random Variation         |
| **Sprite 13** | 1074          | **Shots Fired (Pool)**     | Random Variation         |
| **Sprite 14** | 793           | -                          | -                        |
| **Sprite 15** | 1074          | **Bonus Pickup**           | Chime / Reward           |
| **Sprite 16** | 1468          | **Start Screen**           | One-Shot Opening         |
| **Sprite 17** | 2387          | **Ship Moving (Thrust)**   | Engine / Acceleration    |
| **Sprite 18** | 2125          | -                          | dialog                   |
| **Sprite 19** | 994           | **Ship Moving (Thrust)**   | ship moves forward       |
| **Sprite 20** | 976           | -                          | DIALOG                   |
| **Sprite 21** | 924           | **Ship Rotate**            | Turning Noise            |
| **Sprite 22** | 694           | -                          | DIALOG LEVEL 1           |
| **Sprite 23** | 990           | **Bonus Bullet Speedup**   | BONUS BULLET SPEEDUP     |
| **Sprite 24** | 586           | **Level Clear**            | WELL DONE                |
| **Sprite 25** | 1332          | **Shots Fired (Pool)**     | dit da da da             |
| **Sprite 26** | 427           | **Shots Fired (Pool)**     | laser                    |
| **Sprite 27** | 422           | **Small Asteroid Boom**    | Small Explosions         |
| **Sprite 28** | 539           | -                          | dialog                   |
| **Sprite 29** | 1126          | **Bonus Bullet Capacity**  | BONUS BULLET capicity    |
| **Sprite 30** | 713           | -                          | level 1 dialog           |
| **Sprite 31** | 769           | **Shots Fired (Pool)**     | pow pow pow              |
| **Sprite 32** | 1956          | **Start / Retry Ambience** | Start / Retry Ambience   |
| **Sprite 33** | 361           | **Ship Moving (Thrust)**   | pshiit                   |

---

### Music Controls (In-Game)

The game features an adaptive background music system. Controls are active during gameplay:

| Key | Action | Description |
| :--- | :--- | :--- |
| **M** | **Cycle Track** | Rotates through the 8 available music tracks. |
| **N** | **Play / Pause** | Toggles music playback. HUD fades when resumed. |
| **-** | **Volume Down** | Decreases volume by 10%. |
| **=** | **Volume Up** | Increases volume by 10%. |

---

### Tactical Mix Deck (Soundboard)

The **Tactical Mix Deck** is a specialized tool for testing all 33 sound sprites. Access it by pressing **Shift + M** while on the Splash Screen.

#### Navigation & Interaction:
- **Keys / Click**: Press a key or click a virtual button to play the sample once.
- **Shift + [Key/Click]**: Toggles **Looping** for that sample. Active loops are highlighted with a cyan glow.
- **Esc**: Exits the deck and returns to the main menu.

#### Sequential Key Mapping:
The deck is mapped sequentially to your keyboard to make referencing sprites easy:

| Row | Keys | Sprites |
| :--- | :--- | :--- |
| **Top Row** | `Q` `W` `E` `R` `T` `Y` `U` `I` `O` `P` `[` `]` | **S1** through **S12** |
| **Middle Row** | `A` `S` `D` `F` `G` `H` `J` `K` `L` `;` `'` | **S13** through **S23** |
| **Bottom Row** | `Z` `X` `C` `V` `B` `N` `M` `,` `.` `/` | **S24** through **S33** |

---

### Technical Notes

- **Audio Sprite**: All sounds are packed into `GameSounds.mp3` for maximum performance and compatibility.
- **Instance Management**: The `SoundManager` uses a pool of 64 instances to ensure heavily overlapping sounds in the Mix Deck don't cut each other off.
- **Loop Resetting**: Every one-shot play explicitly resets the `loop` state to `false`, preventing pooled instances from accidentally repeating one-off samples.
