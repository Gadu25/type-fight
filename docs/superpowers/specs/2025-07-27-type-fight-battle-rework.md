
# Type-Fight Battle Design Specification

Version: 0.2 (Team Battle Rework)
Project: Type-Fight
Genre: Competitive Real-Time Typing Battle

---

# 1. Project Overview

Type-Fight is a competitive real-time typing battle game where two players fight by typing phrases.

The player's typing ability becomes their combat ability.

The core experience:

> Type faster and more accurately to perform attacks, damage your opponent, and win the battle.

The game combines:

- Typing skill
- Real-time pressure
- Team composition strategy
- Fantasy combat visuals

The initial goal is not to create a full RPG system.

The priority is creating a fun and addictive typing combat loop.

---

# 2. Current Project Status

Current implementation:

- Create room
- Join room
- Shared phrase typing
- Winner determined by WPM
- Play again loop
- LocalStorage persistence (player name, match history)

Current architecture has been upgraded from single-player typing race to a combat system with:

- HP system (1000 base HP)
- Attack selection (grunt, archer, paladin, wizard)
- Healing options (cleric, priest, saint)
- Damage calculation with accuracy
- Battle ending conditions (HP reaches 0, timeout)

This spec converts the single-character system to a team-based battle system.

---

# 3. Development Philosophy

The first versions should focus on:

1. Gameplay quality
2. Competitive feeling
3. Visual feedback
4. Player satisfaction

Avoid implementing early:

- Individual character HP
- Complex RPG stats
- Character balance systems
- Equipment
- Inventory
- Skill trees
- Progression systems

These features should only be added after the core battle system is proven fun.

---

# 4. Core Gameplay Concept

Type-Fight is a continuous real-time team battle.

There are no turns.

Both players are always fighting.

Each player controls a team of 4 characters.

The gameplay loop:

```
Team selection (pre-game, lobby)
    ↓
Battle begins
    ↓
Player picks one of their 4 characters
    ↓
System generates a random phrase from that character's tier
    ↓
Player types the phrase
    ↓
Character executes their skill (damage or heal)
    ↓
Player picks any character again (same or different)
    ↓
Repeat
    ↓
One team's shared HP reaches 0 → team loses
```

The player is constantly making decisions:

- Which character to activate next?
- Risk a slower high-damage character?
- Play safe with fast damage?
- Heal now or push damage?
- Spam the same character or rotate?

Players can switch between their 4 characters at any time.

There are no cooldowns — a character can be used repeatedly.

Each activation generates a fresh random phrase from that character's tier.

This allows adapting to the opponent's rhythm and team composition.

---

# 5. Core Balance Philosophy

The main balancing resources are:

## Time

Every action is a trade:

```
Time invested
```
    vs
```
Team HP impact
```

A stronger character requires:

- Longer phrase
- Longer typing time
- Higher risk

A weaker character provides:

- Faster completion
- More frequent actions
- Lower commitment

## Team Composition

Players choose 4 characters from a roster of 7.

Each character has one role — damage or heal.

There are no duplicates in a team.

The choice trades off:

- Damage output vs sustain
- Speed vs power
- Burst potential vs consistency

---

# 6. Character System

The roster has 7 characters. Each has a unique phrase pool and skill.

## 6.1 Grunt

Role: Fast consistent damage

Phrase length: 4-8 words (short)
Expected completion: 3-5 seconds
Effect: 80 damage to opponent team

Gameplay style:
- Spam pressure
- Maintain momentum
- Punish slow opponents

## 6.2 Archer

Role: Medium damage

Phrase length: 8-15 words (medium)
Expected completion: 8-12 seconds
Effect: 180 damage to opponent team

Gameplay style:
- Reliable damage
- Balanced choice

## 6.3 Paladin

Role: Heavy damage

Phrase length: 15-25 words (long)
Expected completion: 15-25 seconds
Effect: 350 damage to opponent team

Gameplay style:
- Risk versus reward
- Punishes opponents who cannot pressure you

## 6.4 Wizard

Role: Massive burst damage

Phrase length: 25-40 words (very long)
Expected completion: 25-40 seconds
Effect: 600 damage to opponent team

Gameplay style:
- Comeback tool
- Finishing move
- High commitment

## 6.5 Cleric

Role: Small heal

Phrase length: 4-8 words (short)
Expected completion: 3-5 seconds
Effect: +60 heal to player team

Gameplay style:
- Quick sustain
- Defensive momentum

## 6.6 Priest

Role: Medium heal

Phrase length: 8-15 words (medium)
Expected completion: 8-12 seconds
Effect: +140 heal to player team

Gameplay style:
- Reliable sustain
- Balanced healing

## 6.7 Saint

Role: Large heal

Phrase length: 15-25 words (long)
Expected completion: 15-25 seconds
Effect: +280 heal to player team

Gameplay style:
- High commitment sustain
- Comeback healing

---

# 7. Healing Balance

Healing is intentionally weaker than damage at the same phrase tier.

This prevents infinite stall matches:

| Character   | Tier    | Value  | Damage Equivalent | Ratio  |
|-------------|---------|--------|-------------------|--------|
| Cleric      | Short   | +60    | Grunt (80)        | 75%    |
| Priest      | Medium  | +140   | Archer (180)      | 78%    |
| Saint       | Long    | +280   | Paladin (350)     | 80%    |

If healing matched or exceeded damage, a player spamming heals would out-sustain any damage pressure, leading to timeout wins for the healer.

At 75-80% efficiency, healing is a tactical choice:
- Use it when behind on HP
- Use it to force opponent to commit more damage
- But you cannot stall indefinitely — you will lose the HP race if you only heal

There is no heal at the Wizard (very long) tier. The highest commitment slot should remain pure damage.

---

# 8. Team Composition

## Draft Phase (Pre-game Lobby)

Before the game starts, each player builds their team:

- Choose 4 characters from the 7 available
- No duplicates (each character can appear at most once per team)
- Both players build independently (opponent's team is visible)

## During Battle

- Player clicks a character portrait or presses a shortcut key
- System generates a random phrase from that character's tier
- Player types the phrase
- Character executes their skill immediately on completion
- Player can freely pick the next character — same or different, no cooldowns

## Strategy

Example team compositions:

**All-out offense:**
Grunt + Archer + Paladin + Wizard
Max damage output, no sustain. Win by killing faster.

**Balanced:**
Grunt + Archer + Paladin + Cleric
Three damage options with light sustain for recovery.

**Sustain:**
Archer + Paladin + Cleric + Saint
Heavy sustain, slower kills. Win by outlasting.

**Fast pressure:**
Grunt + Grunt (not allowed — no duplicates)
Instead: Grunt + Archer + Cleric + Priest
Mix of speed and sustain to maintain constant pressure.

---

# 9. Initial Battle Numbers

Recommended starting values:

```
Team HP: 1000

Attack values:
  Grunt:    80 damage  (short phrase)
  Archer:   180 damage (medium phrase)
  Paladin:  350 damage (long phrase)
  Wizard:   600 damage (very long phrase)

Heal values:
  Cleric:   +60 heal   (short phrase)
  Priest:   +140 heal  (medium phrase)
  Saint:    +280 heal  (long phrase)
```

Target match duration:

```
60-120 seconds
```

Target successful actions:

```
5-10 actions per player
```

---

# 10. Accuracy System

Unchanged from original design.

Typing speed alone should not determine victory.

Accuracy affects damage/heal:

```
Accuracy = Correct Characters Typed / Total Characters in Phrase
Final Effect = Base Value × Accuracy
```

Example:

Fast but inaccurate:

```
Phrase: "The ancient warrior entered the battlefield" (41 chars)
Correct: 33 chars
Accuracy: 33/41 = 0.80
Damage: 80 × 0.80 = 64
```

Accurate player:

```
Phrase: "The ancient warrior entered the battlefield" (41 chars)
Correct: 41 chars
Accuracy: 41/41 = 0.99
Damage: 80 × 0.99 = 79
```

This rewards:

- Speed
- Precision
- Consistency

## 10.1 Error Handling

When a player types a wrong character:

- The wrong character is not accepted
- The player must click the correct character to proceed
- The error counts against accuracy

Rules:

- Wrong characters cannot be skipped
- No freeze or time penalty beyond the time spent correcting
- Accuracy is calculated at phrase completion

This creates natural pressure:

- Fast typists must be careful
- Mistakes cost time
- Accuracy is a choice between speed and precision

## 10.2 Accuracy Floor

Minimum accuracy is 25%.

If a player's accuracy falls below 0.25, it is clamped to 0.25.

This prevents degenerate cases where extremely inaccurate typing produces near-zero effect.

---

# 11. Difficulty Design

The player should not think:

"Easy, Normal, Hard"

The player should think:

"Which character helps me right now?"

Each character has a distinct thematic name and role.

The keys should instantly select the character:

```
1 — Grunt
2 — Archer
3 — Paladin
4 — Wizard
5 — Cleric
6 — Priest
7 — Saint
```

---

# 12. Phrase Generation Rules

Phrases are organized in arrays per character/tier.

Each character has its own array of curated phrases.

When a player selects a character:

```
System picks a random phrase from that character's array
```

Phrase word counts per character:

```
Grunt:   4-8 words
Cleric:  4-8 words

Archer:  8-15 words
Priest:  8-15 words

Paladin: 15-25 words
Saint:   15-25 words

Wizard:  25-40 words
```

Phrase difficulty comes from:

- Word count
- Word complexity
- Character theme consistency (each character has themed phrases)

---

# 13. Battle Visual Design

Recommended style:

- 2D pixel art
- Retro fantasy
- Simple readable animations

Example battle layout:

```
----------

Player Team

HP Bar:  ██████████

  [Grunt] [Archer] [Paladin] [Wizard]   ← character portraits
  (active)                              ← which one is being typed for

                    [Timer: 1:45]

Opponent Team

HP Bar:  ██████░░░░

  [Grunt] [Cleric] [Priest] [Saint]    ← shown to player

"The ancient warrior entered..."

Typing Area

Attack Ready

----------
```

The Side-by-Side layout is the same as the original design.

Key difference: HP is a shared team bar, not per-character.

Character portraits show each team's lineup.

The active character (the one being typed for) is highlighted.

---

# 14. Rendering Architecture

Current frontend (Next.js + React):

- Lobby
- UI
- Character selection
- HP display
- Typing area
- Attack buttons / character portraits

This is sufficient for the team battle rework.

No game engine (PixiJS / Phaser) is needed at this stage.

---

# 15. Database Strategy

Do not prioritize database yet.

First prove gameplay.

Later database structure:

```
Users
 |
 Players
 |
 Characters
 |
 Match History
 |
 Ranking
 |
 Cosmetics
```

---

# 16. Development Roadmap

---

## Version 0.3 — Team Battle Rework

Goal:

Convert single-character combat to team battle.

Tasks:

- Team selection UI in lobby (pick 4 from 7)
- Update HP to shared team pool
- Allow character switching during battle
- Support heal mechanic
- Update visual layout for team display
- Nerf heal values for balance

---

## Version 0.4 — Visual Upgrade

Goal:

Make combat satisfying.

Tasks:

- Add character sprites
- Add attack animations
- Add hit effects
- Add screen effects
- Add sound effects

---

## Version 0.5 — Player Identity

Goal:

Make players attached to their teams.

Tasks:

- Character selection profiles
- Player profiles
- Cosmetic customization

---

## Version 1.0 — Online Features

Tasks:

- Database
- Accounts
- Ranking
- Match history
- Progression

---

# 17. Future Considerations

## Individual Character HP

Currently using a shared team HP pool.

Individual character HP could add tactical depth:

- Characters knocked out when their HP reaches 0
- Losing a character reduces team options
- Healing revives or restores character HP
- Adds comeback potential

This is deferred. The shared pool is simpler and good enough for initial testing.

## More Characters

The current roster of 7 provides enough variety for 4-character teams.

New characters can be added following the same pattern:
- Choose a tier (short/medium/long/very long)
- Assign role (damage or heal)
- Create themed phrase pool
- Create sprite

---

# 18. Core Design Rules

Always prioritize:

1. Fun typing experience
2. Short intense matches
3. Meaningful team choices
4. Strong visual feedback

Avoid adding complexity unless it improves gameplay.

The ultimate goal:

After finishing a match, the player should think:

> "I want one more battle."

---

# End of Specification
