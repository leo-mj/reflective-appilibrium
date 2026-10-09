/**
 * @fileoverview A prompt the reader copies into a chat with any LLM, to have a
 * text's arguments reconstructed as an Argdown map this app imports — and the
 * reading of that chat's reply back in.
 *
 * Nothing here calls a model. The reader takes the prompt wherever they like,
 * with the text, and pastes back what comes out; the app sends nothing. That is
 * what makes it work in the demo build too, and with a model the backend does
 * not offer.
 *
 * The prompt asks only for what {@link module:utils/importArgdown} reads, in the
 * spelling it reads it: type tags, premise-conclusion structures, loose-mode
 * `+>` and `->` between statements, and the exporter's `not X` / `><` for a
 * negated conclusion. Its example is {@link ARGDOWN_PROMPT_EXAMPLE}, and
 * `argdownPrompt.test.js` imports it, so the prompt cannot teach a syntax the
 * importer has stopped reading.
 *
 * Two choices in the wording:
 *
 * - **No statuses.** A model is told not to mark claims withdrawn or rejected:
 *   which claims to hold is the reader's decision, made in the app.
 * - **Valid arguments, unstated premises marked.** The inferential relations
 *   are what the rethon simulation reads as entailment, so an argument has to
 *   be deductively valid; a reconstruction gets there by adding premises, and
 *   the reader should be able to see which ones the text never stated.
 *
 * @module utils/argdownPrompt
 */

/**
 * A small map in exactly the forms the prompt asks for: a joint argument, one
 * with a negated conclusion and an unstated premise, a support and an attack,
 * and a statement reused by its title. Singer, "Famine, Affluence, and Morality" (1972), in outline.
 */
export const ARGDOWN_PROMPT_EXAMPLE = `===
title: Famine relief
===

<Singer's argument>: Affluent people are obliged to give to famine relief.

(1) [Prevent bad]: If we can prevent something bad without sacrificing anything of comparable moral importance, we ought to do it. #principle
(2) [Starvation bad]: Suffering and death from lack of food are bad. #judgment {confidence: 0.95}
(3) [Can prevent]: Affluent people can prevent some such suffering by giving, without sacrificing anything of comparable moral importance. #theory
----
(4) [Ought give]: Affluent people ought to give to famine relief until giving more would sacrifice something of comparable moral importance. #judgment

<Demandingness objection>: The obligation asks too much.

(1) [Not too demanding]: Morality cannot require people to make themselves nearly as badly off as those they help. #principle
(2) [Giving that much]: Giving until nothing of comparable importance is sacrificed would make the giver nearly as badly off as those helped. #theory // unstated
----
(3) [not Ought give]: It is not the case that @[Ought give].
  >< [Ought give]

[Drowning child]: One ought to wade into a shallow pond to save a drowning child, even at the cost of muddy clothes. #judgment
  +> [Prevent bad]

[Partiality]: People may put their own family's comfort before strangers' survival. #principle
  -> [Ought give]
`;

/** What the reader copies. */
export const ARGDOWN_IMPORT_PROMPT = `Reconstruct the arguments in the text I give you as an Argdown argument map (https://argdown.org/syntax/), which I will import into a reflective-equilibrium tool.

## What to reconstruct

- The claims the text puts forward or relies on, and the arguments it gives for and against them. Be faithful to the text: reconstruct what it argues, not what you think is true, and include the views it argues against.
- One claim per statement. Each statement has a short title in square brackets, unique to that claim. Give a claim its text once, where it first appears; afterwards refer to it by its title alone, e.g. \`(2) [Prevent bad]\`. The same title everywhere is what connects the arguments, so never restate one claim under two titles.
- Tag every statement with exactly one type:
  - \`#judgment\`: a moral verdict, about a case or a kind of case, of any generality.
  - \`#principle\`: a general moral rule.
  - \`#theory\`: a background theory: a meta-ethical commitment, or other background knowledge. Every empirical claim is a #theory, never a judgment.
- Leave out confidence unless the text says how firmly a claim is held; then add \`{confidence: 0.9}\` (between 0 and 1) after the tag.
- Do not mark any claim as withdrawn or rejected. Which claims to hold is for me to decide.

## Arguments

- Write each argument as a premise-conclusion structure: an argument title in angle brackets with a one-line summary, the numbered premises, a line of four dashes, and the numbered conclusion.
- Make each argument deductively valid: the premises together must entail the conclusion. Where the text leaves a needed premise unstated, add it, and put \`// unstated\` at the end of its line.
- A chain of reasoning may have intermediate conclusions. Each inference then uses the statements since the previous conclusion, that conclusion included. If it uses others, name them on the dashed line: \`-- {uses: [1, 3]} --\`.
- If an argument concludes that a claim is false, title the conclusion \`not\` followed by that claim's title, and tie it to the claim with \`><\` on the next line, as in the example.

## Reasons outside arguments

Where the text gives a reason for or against a claim that is not a valid argument, put it under the statement that gives the reason:
- \`+> [Title]\`: this claim is a reason for that one.
- \`-> [Title]\`: this claim is a reason against that one.

Relate statements only to statements, never to whole arguments, and do not use \`_>\`.

## Syntax

- Start with front matter giving the topic: \`===\`, \`title: ...\`, \`===\`.
- Inside a statement's text, avoid characters that are Argdown syntax: \`[ ] < > # { }\` and \`//\`.

## Example

\`\`\`argdown
${ARGDOWN_PROMPT_EXAMPLE.trimEnd()}
\`\`\`

## Output

Reply with one fenced code block marked \`argdown\` holding the whole map. After it, list briefly any part of the text you could not fit into the map, and why.

The text to reconstruct follows this prompt, pasted or attached. If there is none, ask me for it.
`;

/**
 * The Argdown in a chat reply: the first fenced block marked `argdown` (or
 * `ad`), else the first fenced block, else the whole reply — so a reply pasted
 * whole, with the model's notes around the map, reads the same as the map
 * copied alone.
 *
 * @param {string} reply
 * @returns {string}
 */
export function argdownFromReply(reply) {
  const text = (reply ?? "").replace(/\r\n?/g, "\n");
  const fence =
    /^[ \t]*(`{3,}|~{3,})[ \t]*([\w-]*)[^\n]*\n([\s\S]*?)^[ \t]*\1[ \t]*$/gm;
  const blocks = [...text.matchAll(fence)].map((m) => ({
    lang: m[2].toLowerCase(),
    body: m[3],
  }));
  const block =
    blocks.find((b) => b.lang === "argdown" || b.lang === "ad") ?? blocks[0];
  return (block ? block.body : text).trim() + "\n";
}

/**
 * A pasted reply as the `.argdown` File Import and Merge read. Named after the
 * map's front-matter title when it has one, since a merge labels the incoming
 * process by the file's name.
 *
 * @param {string} reply
 * @returns {File}
 */
export function pastedArgdownFile(reply) {
  const text = argdownFromReply(reply);
  const title = /^===\s*\n[\s\S]*?^title:[ \t]*(.+?)[ \t]*$/m
    .exec(text)?.[1]
    ?.replace(/^(["'])(.*)\1$/, "$2")
    .replace(/[\\/:*?"<>|]/g, " ")
    .trim()
    .slice(0, 100);
  return new File([text], `${title || "Pasted argument map"}.argdown`, {
    type: "text/plain",
  });
}
