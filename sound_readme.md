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

### How to Reassign Sounds

To change which sprite plays for an action, update the `SPRITE_MAP` in `src/SoundManager.js`:

```javascript
// src/SoundManager.js
this.SPRITE_MAP = {
  shotFiredPool: [
    "Sprite 1", "Sprite 2", "Sprite 4", "Sprite 5", "Sprite 6",
    "Sprite 12", "Sprite 13", "Sprite 25", "Sprite 26", "Sprite 31",
  ],
  shotHit: "Sprite 3",
  shipHum: "Sprite 7",
  shipThrust: ["Sprite 17", "Sprite 19", "Sprite 33"],
  shipRotate: "Sprite 21",
  gameOver: ["Sprite 9", "Sprite 10", "Sprite 11"],
  startScreen: "Sprite 16",
  startScreenAmbience: "Sprite 32",
  levelCleared: "Sprite 24",
  bonusPickup: "Sprite 15",
  bonusCapacity: "Sprite 29",
  bonusSpeedup: "Sprite 23",
  asteroidBreak: "Sprite 3",
  asteroidBreakSmall: "Sprite 27",
  proximityAlert: "Sprite 8",
};
```
