
# Type-Fight Battle Design Specification

Version: 0.1  
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
- Attack decision-making
- Fantasy combat visuals

The initial goal is not to create a full RPG system.

The priority is creating a fun and addictive typing combat loop.

---

# 2. Current Project Status

Current implementation:

- Create room
- Join room
- 1v1 typing battle
- Shared phrase typing
- Winner determined by WPM
- Play again loop
- LocalStorage persistence:
  - Player name
  - Match history

Current architecture is suitable for gameplay experimentation.

Do not introduce unnecessary complexity yet.

---

# 3. Development Philosophy

The first versions should focus on:

1. Gameplay quality
2. Competitive feeling
3. Visual feedback
4. Player satisfaction

Avoid implementing early:

- Complex RPG stats
- Character balance systems
- Equipment
- Inventory
- Skill trees
- Progression systems

These features should only be added after the core battle system is proven fun.

---

# 4. Core Gameplay Concept

Type-Fight is a continuous real-time battle.

There are no turns.

Both players are always fighting.

The gameplay loop:

Both players fight independently and simultaneously.

Each player chooses their own attack and types their own phrase.

```

Battle begins

```
    ↓
```

Each player chooses their attack type (1-4)

```
    ↓
```

System generates a random phrase from the selected tier

```
    ↓
```

Player types their phrase

```
    ↓
```

Attack animation happens

```
    ↓
```

Opponent loses HP

```
    ↓
```

Repeat

```
    ↓
```

Player reaches 0 HP loses

```

The player is constantly making decisions:

- Attack quickly?
- Risk a stronger attack?
- Play aggressively?
- Play safely?

Players can switch attacks at any time.

Switching abandons the current phrase and progress.

The new attack generates a fresh phrase from the selected tier.

This allows adapting to the opponent's rhythm.

---

# 5. Core Balance Philosophy

The main balancing resource is:

## Time

Every attack is a trade:

```

Time invested

```
    vs
```

Damage received

```

A stronger attack requires:

- Longer phrase
- Longer typing time
- Higher risk

A weaker attack provides:

- Faster completion
- More frequent attacks
- Lower commitment

---

# 6. Attack System

The first version contains four attack types.

---

# 6.1 Quick Attack

Purpose:

Fast pressure and consistent damage.

Characteristics:

- Short phrase
- Low damage
- Low risk

Example:

```

Phrase:

"The sword shines"

Expected completion:

3-5 seconds

Damage:

80

```

Gameplay style:

- Spam pressure
- Maintain momentum
- Punish slow opponents

---

# 6.2 Normal Attack

Purpose:

Standard combat option.

Characteristics:

- Medium phrase
- Medium damage

Example:

```

Phrase:

"The warrior entered the battlefield"

Expected completion:

8-12 seconds

Damage:

180

```

Gameplay style:

- Reliable damage
- Balanced choice

---

# 6.3 Heavy Attack

Purpose:

High commitment attack.

Characteristics:

- Long phrase
- High damage

Example:

```

Phrase:

"The forgotten kingdom was protected by ancient warriors"

Expected completion:

15-25 seconds

Damage:

350

```

Gameplay style:

- Risk versus reward
- Punishes opponents who cannot pressure you

---

# 6.4 Ultimate Attack

Purpose:

High-risk finishing attack.

Characteristics:

- Very long phrase
- Massive damage
- Vulnerable during charging

Example:

```

Phrase:

"The ancient civilization discovered forgotten secrets beneath the endless mountains"

Expected completion:

25-40 seconds

Damage:

600

```

Gameplay style:

- Comeback tool
- Finishing move
- High commitment

---

# 7. Initial Battle Numbers

Recommended starting values:

```

Player HP:

1000

```

Attack values:

```

Quick Attack:

80 damage

Normal Attack:

180 damage

Heavy Attack:

350 damage

Ultimate Attack:

600 damage

```

Target match duration:

```

60-120 seconds

```

Target successful attacks:

```

5-10 attacks per player

```

---

# 8. Why Ultimate Is Balanced

Ultimate should not be the most efficient attack.

Example:

Quick Attack:

```

80 damage  
4 seconds

20 damage/second

```

Ultimate:

```

600 damage  
35 seconds

17 damage/second

```

Ultimate is weaker in efficiency.

Its advantage is burst damage.

Players choose Ultimate because:

- They need a comeback
- They think they have enough time
- They want a finishing move

---

# 9. Accuracy System

Typing speed alone should not determine victory.

Accuracy affects damage.

Formula:

```

Accuracy = Correct Characters Typed / Total Characters in Phrase

Final Damage = Base Damage × Accuracy

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

---

# 9.1 Error Handling

When a player types a wrong character:

- The wrong character is not accepted
- The player must press Backspace to correct
- Time continues flowing during correction
- The error counts against accuracy

Rules:

- Wrong characters cannot be skipped
- Backspace removes the last typed character
- No freeze or time penalty beyond the time spent correcting
- Accuracy is calculated at phrase completion

Example:

```

Phrase: "The sword shines"

Player types: "The swor"

Player presses Backspace twice

Player types: "sword"

Time lost: ~1-2 seconds

Accuracy impact: None if corrected before completion

```

This creates natural pressure:

- Fast typists must be careful
- Mistakes cost time
- Accuracy is a choice between speed and precision

---

# 10. Difficulty Selection

The player should not think:

"Easy, Normal, Hard"

The player should think:

"What attack should I use?"

Final naming:

```

1 - Quick Attack

2 - Normal Attack

3 - Heavy Attack

4 - Ultimate Attack

```

The keys:

```

1  
2  
3  
4

```

should instantly select the attack.

---

# 11. Phrase Generation Rules

Phrases are organized in arrays per attack tier.

Each tier has its own array of curated phrases.

When a player selects an attack:

```

System picks a random phrase from the selected tier's array

```

Phrase word counts per tier:

```

Quick:   4-8 words

Normal:  8-15 words

Heavy:   15-25 words

Ultimate: 25-40 words

```

Implementation:

```

const phrases = {

  quick: [

    "The sword shines bright",

    "Fire burns through darkness",

    "Strike fast and true"

  ],

  normal: [

    "The warrior entered the ancient battlefield with courage",

    "Magic flows through the veins of the forgotten forest"

  ],

  heavy: [

    "The forgotten kingdom was protected by ancient warriors who fought without fear",

    "Darkness spread across the land as the dragon descended from the mountain peaks"

  ],

  ultimate: [

    "The ancient civilization discovered forgotten secrets beneath the endless mountains that stretched beyond the horizon",

    "When the final battle began the warriors knew there was no turning back from the path they had chosen"

  ]

}

```

Random selection:

```

const tier = attackType // "quick", "normal", "heavy", "ultimate"

const pool = phrases[tier]

const phrase = pool[Math.floor(Math.random() * pool.length)]

```

Each character has their own phrase arrays.

Phrases are themed to match the character's style.

Example for Knight:

```

knight: {

  quick: [

    "The blade catches the light",

    "Steel sings through the air"

  ],

  normal: [

    "The knight raised his sword and charged into battle"

  ]

}

```

Phrase difficulty comes from:

- Word count
- Word complexity
- Character theme consistency

---

# 12. Character System

Characters should initially be cosmetic.

They should not affect gameplay balance.

Each character has:

- Unique visual style
- Themed phrase arrays per attack tier
- Attack animations matching their theme

Purpose:

- Visual identity
- Player attachment
- Fantasy feeling

---

## Knight

Attack style:

- Sword slash
- Heavy strike

Phrases:

- Battle, sword, honor, courage, steel, shield
- Medieval combat themes

---

## Mage

Attack style:

- Fireball
- Magic explosion

Phrases:

- Magic, spells, elements, ancient power
- Arcane and mystical themes

---

## Archer

Attack style:

- Arrow projectile

Phrases:

- Wind, precision, forest, nature, speed
- Ranger and hunter themes

---

## Assassin

Attack style:

- Shadow strike

Phrases:

- Shadows, darkness, stealth, poison, night
- Rogue and infiltration themes

---

# 13. Battle Visual Design

Recommended style:

- 2D pixel art
- Retro fantasy
- Simple readable animations

Example battle layout:

```

----------

Player Character

HP:  
██████████

Enemy Character

HP:  
██████░░░░

"The ancient warrior entered..."

Typing Area

Attack Ready

----------

```

---

# 14. Rendering Architecture

Recommended frontend architecture:

```

Vue / Nuxt

Responsible for:

-   Lobby
-   UI
-   Menus
-   Player information

```

Game rendering:

```

PixiJS / Phaser

Responsible for:

-   Characters
-   Effects
-   Animations
-   Damage visuals

```

---

# 15. Database Strategy

Do not prioritize database yet.

First prove gameplay.

Later database structure:

```

Users

|  
|  
Players

|  
|  
Characters

|  
|  
Match History

|  
|  
Ranking

|  
|  
Cosmetics

```

---

# 16. Development Roadmap

---

## Version 0.2 - Combat Upgrade

Goal:

Improve gameplay.

Tasks:

- Add HP system
- Add attack selection
- Add multiple phrases
- Add damage calculation
- Add battle ending condition

---

## Version 0.3 - Visual Upgrade

Goal:

Make combat satisfying.

Tasks:

- Add character sprites
- Add attack animations
- Add hit effects
- Add screen effects
- Add sound effects

---

## Version 0.4 - Player Identity

Goal:

Make players attached to their characters.

Tasks:

- Character selection
- Profiles
- Cosmetic customization

---

## Version 1.0 - Online Features

Tasks:

- Database
- Accounts
- Ranking
- Match history
- Progression

---

# 17. Core Design Rules

Always prioritize:

1. Fun typing experience
2. Short intense matches
3. Meaningful choices
4. Strong visual feedback

Avoid adding complexity unless it improves gameplay.

The ultimate goal:

After finishing a match, the player should think:

> "I want one more battle."

---

# End of Specification
