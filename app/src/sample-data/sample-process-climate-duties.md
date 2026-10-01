# Reflective Equilibrium: What does the climate crisis require of us now?

**Round:** 4 · **Sample process**

A second sample process, for trying out **Merge** against the one the app opens
with — ☰ → Session → **Merge (demo)** brings it in without leaving the app, and
☰ → Session → Merge takes it as a file like any other. It shares several claims
with the opening process in different words — which is what the **Merge** assist
tab then offers to merge element by element — and brings along others of its own.

Nothing here is identical to the opening process word for word, so nothing is
fused automatically; every pair is yours to decide.

---

## Elements

### Judgments

**J1** · 1
Leaving radioactive waste unsealed where it will contaminate drinking water for thousands of years is wrong.

**J2** · 1
When we set climate targets, the wellbeing of people alive in 2100 counts.

**J3** · 0.67
That someone will live later than us is no reason to count their interests for less.

**J4** · 0.67
Wealthy countries owe a larger share of the cost of cutting emissions than poor ones.

**J5** · 0.33
Individual choices such as flying matter far less than energy policy does.

**J6** · 0.33
A poor country may burn fossil fuels now if that is the only available route out of poverty.

**J7** · 1
Unsealed waste hands the next generation land and water carrying a hazard they did not create.

**J8** · 0.33 *(withdrawn)*
~~Only people who are alive today can be wronged by what we do.~~

### Principles

**P1** · 1
No generation may hand on a world in worse condition than the one it inherited.

**P2** · 0.67
Those who cause a harm should bear the cost of preventing it.

### Background Theories

**T1** · 0.67
What makes someone matter morally is the capacity to fare well or badly, not which particular person they turn out to be.

---

## Relations

- **P1** → *jointly entails* → **J1**
- **J7** → *jointly entails* → **J1**
- **P1** → *supports* → **J2**
- **J3** → *supports* → **J2**
- **P2** → *supports* → **J4**
- **J6** → *conflicts* → **P1**
- **T1** → *supports* → **J3**

---

```re-state
{
  "topic": "What does the climate crisis require of us now?",
  "phase": 2,
  "round": 4,
  "elements": [
    {
      "id": "J1",
      "type": "judgment",
      "status": "active",
      "confidence": 1.0,
      "origin": "user",
      "text": "Leaving radioactive waste unsealed where it will contaminate drinking water for thousands of years is wrong.",
      "addedRound": 1
    },
    {
      "id": "J2",
      "type": "judgment",
      "status": "active",
      "confidence": 1.0,
      "origin": "user",
      "text": "When we set climate targets, the wellbeing of people alive in 2100 counts.",
      "addedRound": 1
    },
    {
      "id": "J3",
      "type": "judgment",
      "status": "active",
      "confidence": 0.67,
      "origin": "user",
      "text": "That someone will live later than us is no reason to count their interests for less.",
      "addedRound": 2
    },
    {
      "id": "J4",
      "type": "judgment",
      "status": "active",
      "confidence": 0.67,
      "origin": "user",
      "text": "Wealthy countries owe a larger share of the cost of cutting emissions than poor ones.",
      "addedRound": 2
    },
    {
      "id": "J5",
      "type": "judgment",
      "status": "active",
      "confidence": 0.33,
      "origin": "claude-fable-5",
      "text": "Individual choices such as flying matter far less than energy policy does.",
      "addedRound": 3
    },
    {
      "id": "J6",
      "type": "judgment",
      "status": "active",
      "confidence": 0.33,
      "origin": "user",
      "text": "A poor country may burn fossil fuels now if that is the only available route out of poverty.",
      "addedRound": 3
    },
    {
      "id": "J7",
      "type": "judgment",
      "status": "active",
      "confidence": 1.0,
      "origin": "user",
      "text": "Unsealed waste hands the next generation land and water carrying a hazard they did not create.",
      "addedRound": 1
    },
    {
      "id": "J8",
      "type": "judgment",
      "status": "withdrawn",
      "confidence": 0.33,
      "origin": "user",
      "text": "Only people who are alive today can be wronged by what we do.",
      "addedRound": 1,
      "reason": "Given J2, an account on which people in 2100 cannot be wronged was not one this process could keep.",
      "history": [
        {
          "round": 3,
          "type": "withdrawn",
          "reason": "Given J2, an account on which people in 2100 cannot be wronged was not one this process could keep."
        }
      ]
    },
    {
      "id": "P1",
      "type": "principle",
      "status": "active",
      "confidence": 1.0,
      "origin": "user",
      "text": "No generation may hand on a world in worse condition than the one it inherited.",
      "addedRound": 2
    },
    {
      "id": "P2",
      "type": "principle",
      "status": "active",
      "confidence": 0.67,
      "origin": "claude-fable-5",
      "text": "Those who cause a harm should bear the cost of preventing it.",
      "addedRound": 3
    },
    {
      "id": "T1",
      "type": "theory",
      "status": "active",
      "confidence": 0.67,
      "origin": "claude-fable-5",
      "text": "What makes someone matter morally is the capacity to fare well or badly, not which particular person they turn out to be.",
      "addedRound": 4
    }
  ],
  "relations": [
    {
      "from": "P1",
      "to": "J1",
      "type": "jointly_entails",
      "explanation": "Unsealed waste leaves the next generation worse off than we found things, which P1 forbids.",
      "addedRound": 4,
      "argumentId": "arg-sample-b-1",
      "origin": "user"
    },
    {
      "from": "J7",
      "to": "J1",
      "type": "jointly_entails",
      "explanation": "Unsealed waste leaves the next generation worse off than we found things, which P1 forbids.",
      "addedRound": 4,
      "argumentId": "arg-sample-b-1",
      "origin": "user"
    },
    {
      "from": "P1",
      "to": "J2",
      "type": "supports",
      "explanation": "Targets that ignore 2100 hand on a worse world.",
      "addedRound": 2,
      "origin": "user"
    },
    {
      "from": "J3",
      "to": "J2",
      "type": "supports",
      "explanation": "If time is no discount, the people of 2100 count now.",
      "addedRound": 2,
      "origin": "user"
    },
    {
      "from": "P2",
      "to": "J4",
      "type": "supports",
      "explanation": "Wealthy countries caused most of the emissions in question.",
      "addedRound": 3,
      "origin": "user"
    },
    {
      "from": "J6",
      "to": "P1",
      "type": "conflicts",
      "explanation": "Burning fossil fuels now is how the world is handed on in worse condition.",
      "addedRound": 3,
      "origin": "user"
    },
    {
      "from": "T1",
      "to": "J3",
      "type": "supports",
      "explanation": "If the capacity to fare well is what matters, when someone lives is beside the point.",
      "addedRound": 4,
      "origin": "claude-fable-5"
    }
  ],
  "coherence": {
    "tensions": [],
    "orphans": [],
    "clusters": []
  },
  "log": [
    {
      "round": 1,
      "findings": "Three judgments written down: the waste case, climate targets, and what unsealed waste hands on.",
      "options": "",
      "decision": "Added",
      "changes": "J1, J2, J7, J8 added"
    },
    {
      "round": 2,
      "findings": "A principle general enough to cover the waste case and the climate case.",
      "options": "",
      "decision": "Added",
      "changes": "P1, J3, J4 added; P1 → J2, J3 → J2 added"
    },
    {
      "round": 3,
      "findings": "J8 could not stand beside J2, and the cost question needed a principle of its own.",
      "options": "",
      "decision": "Withdrawn and added",
      "changes": "J8 withdrawn; P2, J5, J6 added; J6 conflicts P1 recorded"
    },
    {
      "round": 4,
      "findings": "A background theory for why temporal distance is beside the point, and the waste case written out as an argument.",
      "options": "",
      "decision": "Added",
      "changes": "T1 added; T1 → J3 added; P1, J7 → J1 (jointly entails) added"
    }
  ]
}
```
