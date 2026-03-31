# Sound Sprite Mapping Reference

The following table lists all **33 sprites** defined in `GameSound_sprite.json` and their current (or suggested) assignments in the `SoundManager.js`.

| Sprite # | Duration (ms) | Current Assignment | Suggested Use Case |
| :--- | :--- | :--- | :--- |
| **Sprite 1** | 1598 | - | - |
| **Sprite 2** | 461 | - | - |
| **Sprite 3** | 460 | - | - |
| **Sprite 4** | 708 | - | - |
| **Sprite 5** | 868 | **Ship Moving (Thrust)** | Engine / Acceleration |
| **Sprite 6** | 689 | - | - |
| **Sprite 7** | 1834 | **Ship Noise (Hum)** | Background / Ambient |
| **Sprite 8** | 1449 | - | - |
| **Sprite 9** | 990 | - | - |
| **Sprite 10** | 1140 | - | - |
| **Sprite 11** | 1454 | - | - |
| **Sprite 12** | 877 | - | - |
| **Sprite 13** | 1074 | - | - |
| **Sprite 14** | 793 | - | - |
| **Sprite 15** | 1074 | - | - |
| **Sprite 16** | 1468 | - | - |
| **Sprite 17** | 2387 | **Game Over** | Dramatic/Ending |
| **Sprite 18** | 2125 | - | - |
| **Sprite 19** | 994 | - | - |
| **Sprite 20** | 976 | - | - |
| **Sprite 21** | 924 | - | - |
| **Sprite 22** | 694 | - | - |
| **Sprite 23** | 990 | - | - |
| **Sprite 24** | 586 | **Bonus Pickup** | Chime / Reward |
| **Sprite 25** | 1332 | - | - |
| **Sprite 26** | 427 | **Shots Fired** | Short / Snappy |
| **Sprite 27** | 422 | **Shots Hitting** | Impact / Hit |
| **Sprite 28** | 539 | **Asteroid Break** | Crunch / Crack |
| **Sprite 29** | 1126 | - | - |
| **Sprite 30** | 713 | - | - |
| **Sprite 31** | 769 | - | - |
| **Sprite 32** | 1956 | **Start Screen** | Menu / Atmosphere |
| **Sprite 33** | 361 | - | - |

---

### How to Reassign Sounds
To change which sprite plays for an action, update the `SPRITE_MAP` in `src/SoundManager.js`:

```javascript
// src/SoundManager.js
this.SPRITE_MAP = {
  shotFired:    'Sprite 26',  // Change numbers to swap sounds
  shotHit:      'Sprite 27',
  shipHum:      'Sprite 7',
  shipThrust:   'Sprite 5',
  gameOver:     'Sprite 17',
  startScreen:  'Sprite 32',
  bonusPickup:  'Sprite 24',
  asteroidBreak:'Sprite 28',
};
```
