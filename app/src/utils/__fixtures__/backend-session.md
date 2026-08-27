# Autonomy and paternalism

Saved: 2026-01-15 09:30:00 UTC

```re-state
{
  "topic": "Autonomy and paternalism",
  "phase": 2,
  "round": 4,
  "elements": [
    {
      "id": "J1",
      "type": "judgment",
      "status": "withdrawn",
      "confidence": 0.67,
      "origin": "user",
      "text": "Locking someone in for their own good is wrong.",
      "addedRound": 1,
      "negated": false,
      "history": [
        {
          "round": 2,
          "type": "withdrawn",
          "reason": "Too broad."
        },
        {
          "round": 3,
          "type": "reinstated"
        },
        {
          "round": 4,
          "type": "withdrawn",
          "reason": "Still too broad."
        }
      ]
    },
    {
      "id": "P1",
      "type": "principle",
      "status": "revised",
      "confidence": 1.0,
      "origin": "gpt-4o+user",
      "text": "Respect competent refusal of treatment.",
      "addedRound": 1,
      "negated": false,
      "previousText": "Respect refusal of treatment.",
      "revisedRound": 3,
      "history": [
        {
          "round": 3,
          "type": "revised",
          "previousText": "Respect refusal of treatment."
        }
      ]
    },
    {
      "id": "T1",
      "type": "theory",
      "status": "active",
      "confidence": 0.67,
      "origin": "gpt-4o",
      "text": "Autonomy is grounded in a capacity for reflective self-governance rather than in the quality of the choices it produces.",
      "addedRound": 4,
      "negated": false,
      "sources": [
        {
          "type": "book",
          "authors": [
            "Frankfurt, H. G."
          ],
          "year": "1988",
          "title": "The importance of what we care about",
          "container": "",
          "editors": [],
          "publisher": "Cambridge University Press",
          "volume": "",
          "issue": "",
          "pages": "",
          "doi": "10.1017/cbo9780511818172"
        }
      ]
    }
  ],
  "relations": [
    {
      "from": "P1",
      "to": "J1",
      "type": "supports",
      "explanation": "The principle grounds the verdict.",
      "addedRound": 1,
      "origin": "user",
      "history": [
        {
          "round": 2,
          "type": "withdrawn"
        },
        {
          "round": 3,
          "type": "reinstated"
        }
      ]
    }
  ],
  "coherence": {
    "tensions": [],
    "orphans": [],
    "clusters": []
  },
  "log": [
    {
      "round": 2,
      "findings": "J1 overreaches.",
      "options": "Withdraw or narrow.",
      "decision": "Withdraw.",
      "changes": "J1 withdrawn."
    }
  ],
  "reviews": [
    {
      "id": "rev-1737000000000-a1b2c3",
      "round": 3,
      "headline": "A single principle absorbed the work two judgments had been doing.",
      "arc": "The process began with J1 carrying the whole objection to paternalism and ended with P1 carrying it instead, narrowed to competent refusal.",
      "surprises": "J1 was reinstated in round 3 and withdrawn again in round 4 — the second withdrawal, unlike the first, gave the same reason.",
      "missed": "P1 and J1 were never related after the revision, so the support edge still points at wording P1 no longer has.",
      "method": "Mostly revising rather than adding, and the one model suggestion was reworded before acceptance.",
      "model": "gpt-4o",
      "origin": "gpt-4o & user"
    }
  ]
}
```
