/**
 * @fileoverview The script the guided tour reads from: one flat, ordered list
 * of sections the visitor scrolls through.
 *
 * The tour answers, in this order, the four questions a first-time visitor
 * arrives with: what reflective equilibrium is for, what is already on screen
 * and why, what judgments and principles are and how arguments tie them
 * together, and only then — where the AI comes in and what every tab does.
 *
 * Nothing here renders. A section is a description of what the reader should
 * see while they read it, and {@link module:components/tour/GuidedTour} applies
 * it: which tab is open, whether the app's own chrome is visible, what the
 * graph is zoomed to, and what is selected in it.
 *
 * **One script, both layouts.** The wide tour reads it down a column beside the
 * graph and the narrow one along a sheet under it, but they say the same thing:
 * the method, the demo graph, making changes, the AI. What differs at the two
 * widths is only ever the *route* to a control — Undo is a header button on one
 * and a ☰ entry on the other — so a section states its substance once and
 * carries a `narrow` override for where that control is to be found. Anything
 * that would have to be said differently is a {@link byLayout} paragraph, which
 * keeps the two wordings side by side rather than in two scripts that drift.
 *
 * @module components/tour/tourSections
 */

/**
 * A paragraph whose wording has to follow the layout, because it names a route
 * through an interface the two widths do not share.
 *
 * Reach for it only for the route. A section whose *substance* differs between
 * the layouts is a section one of them is not being told something.
 *
 * @param {string} wide
 * @param {string} narrow
 */
const byLayout = (wide, narrow) => ({ wide, narrow });

/**
 * @typedef {Object} TourSection
 * @property {string}   id       - Stable key.
 * @property {string}   [chapter] - Chapter heading; set on the section that opens one.
 * @property {string|{wide: string, narrow: string}} title
 * @property {(string|{wide: string, narrow: string})[]} body - Paragraphs.
 * @property {Object}   [narrow] - What this section needs at narrow widths,
 *   merged over the section itself: usually the `data-tutorial` id the control
 *   carries there, and whatever has to be on screen to see it.
 * @property {"narrow"|"wide"} [only] - Restricts the section to one layout, for
 *   the handful that describe something the other width does not have.
 * @property {string[]} [quote]  - Element IDs whose own text is shown as a card,
 *   read from the live state rather than copied here.
 * @property {string[]} [focus]  - Element IDs the graph zooms to. Omitted keeps
 *   the previous framing; `[]` means "the whole graph again".
 * @property {string}   [select] - Element ID to select, highlighting it and its
 *   neighbours.
 * @property {string}   [argument] - Argument ID to select, highlighting every
 *   premise, the conclusion, and the arrows between them.
 * @property {string|string[]} [target] - `data-tutorial` id of a control to
 *   ring, or several to ring at once — two ways of doing the same thing want
 *   showing together rather than a section each.
 * @property {string}   [tab]    - Tab to open before the section is shown.
 * @property {boolean}  [chrome] - True once the app's tab bar belongs on screen.
 * @property {boolean}  [text]   - True where the text panel belongs on screen.
 * @property {boolean}  [addBar] - Brings the add bar back before the chapters
 *   that would otherwise have earned it.
 * @property {boolean}  [menu]   - Opens the header's ☰ menu, for the sections
 *   that ring something inside it.
 */

/**
 * Chapter 1 — what the method is, what the app is, and what the visitor is looking at.
 * No chrome: the tab bar and the text panel stay out of the way until the tour
 * has said what the graph behind it means.
 */
function openingSections(topic) {
  return [
    {
      id: "what-re-is",
      chapter: "The method",
      title: "Reflective equilibrium",
      body: [
        "Reflective equilibrium is a view of how justification works for beliefs in ethics: you start from concrete moral judgments you are fairly confident about, look for general principles that would explain them, and adjust both sides until they fit together.",
        "Neither side is bedrock. A principle can fall to a case that tells against it, and a verdict you were sure of can fall to the principle that best explains everything else. What justifies a position, in the end, is that it hangs together.",
        "IMPORTANT: Neither reflective equilibrium nor this app guarantee reaching ethical truth.",
      ],
      focus: [],
    },
    {
      id: "what-appilibrium-is",
      chapter: "The app",
      title: "Reflective APPilibrium",
      body: [
        "Reaching an equilibrium state - a position in which all your judgments fit together with each other and with the principles - can be difficult.",
        "This app, Reflective Appilibrium, is supposed to assist in performing reflective equilibrium processes through visualisation, documentation, and (optionally) AI.",
        "How exactly? It's easier to show by using an example question than to explain in the abstract.",
      ],
      focus: [],
    },
    {
      id: "the-question",
      title: "Demo example",
      body: [
        topic
          ? `This demo works through a standard question in ethics: “${topic}”`
          : "This demo works through a single ethical question.",
        "The graph beside you shows a fictional set of beliefs someone might reach — eight rounds of judgments, principles and arguments, kept here so you can look around a worked example before starting one of your own.",
      ],
      target: "topic",
      focus: [],
    },
  ];
}

/**
 * Chapters 2 and 3 — reading the demo graph, then changing it.
 *
 * The graph's default view shows arguments only, so every section here walks
 * elements that an argument actually connects. Together they answer "what is a
 * judgment, what is a principle, what is a background theory, and why do I need
 * them" by pointing at each in turn rather than by defining the terms.
 *
 * Still no tab bar: the second half is about writing the graph, not about the
 * interface around it, and the text panel it ends on is asked for by that
 * section alone.
 */
function graphSections() {
  return [
    {
      id: "judgments",
      chapter: "Reading the graph",
      title: "Judgments — the concrete verdicts",
      body: [
        "Circles are judgments: verdicts on cases, of any generality. They are where a process starts.",
        "The stronger the fill of a judgment, the more confident this thinker was about it.",
        "Hover any graph node to read it in full.",
      ],
      quote: ["J1"],
      focus: ["J1"],
      select: "J1",
    },
    {
      id: "principles",
      title: "Principles — the general rules",
      body: [
        "Rounded rectangles are principles: general rules meant to explain a whole family of verdicts at once, rather than to settle one case.",
        "A principle earns its place by accounting for judgments you already hold — and pays for it by committing you to verdicts in cases you have not considered yet.",
      ],
      quote: ["P1"],
      focus: ["P1"],
      select: "P1",
    },
    {
      id: "argument",
      title: "Arguments",
      body: [
        "Arrows represent arguments, running from premises to a conclusion. Most need more than one premise: their lines converge on a dot and continue as a single arrow, because neither premise gets you there alone but together they do. Withdraw either one and the conclusion loses its support.",
        "Click any arrow and the whole argument it belongs to lights up. That is the unit the tool works in — not a loose association between two ideas, but a claim that these premises get you that conclusion.",
      ],
      quote: ["P2", "P3", "J5"],
      focus: ["P2", "P3", "J5"],
      argument: "arg-sample-3",
    },
    {
      id: "tension",
      title: "Conflicts",
      body: [
        "Red arrows show conflicts among your views: these premises rule the conclusion out. Here a principle about proximity and a judgment about parents together imply that obligations do weaken with distance in time — which is exactly what the judgment they point at denies.",
        "This is reflective equilibrium doing its work. Something has to move: restrict the principle, give up the judgment, or accept the cost and say why. Nothing in the tool decides that for you.",
      ],
      quote: ["P6", "J7", "J10"],
      focus: ["P6", "J7", "J10"],
      argument: "arg-sample-5",
    },
    {
      id: "theories",
      title: "Background theories",
      body: [
        "Diamonds are background theories. Background theories are not immediate judgments about the ethical question at hand nor ethical rules that structure them.",
        "Instead, they add further details that help inform arguments for and against judgments and principles. They can come from any domain of inquiry that is relevant for your ethical question, including metaphysics, epistemology, and social and natural sciences.",
        "Invoking background theories on top of judgments and principles makes a reflective equilibrium 'wide' as opposed to 'narrow'",
        "The two example theories below are the argument for P2 — the principle you just watched doing work above — and, being an argument, it can be attacked like one. Reaching down to this layer is what makes a reflective equilibrium wide.",
      ],
      quote: ["T1", "T2"],
      focus: ["T1", "T2", "P2"],
      argument: "arg-sample-1",
    },
    {
      id: "adding",
      chapter: "Making changes",
      title: "Adding to the graph",
      body: [
        "Of course, you not only want to read the graph, you want to write it.",
        "+ J, + P and + T put a judgment, a principle or a background theory on the graph; + Arg opens a form for premises and a conclusion.",
        byLayout(
          "Or pick them out on the graph itself: select a node, Ctrl-click the others, and the bar that appears turns the selection into an argument.",
          "Or pick them out on the graph itself: tap a node, then tap the others with the argument bar open, and it turns the selection into an argument.",
        ),
        byLayout(
          "The bar along the bottom does the same thing.",
          "The ⊕ button at the foot of the text view does the same thing.",
        ),
      ],
      target: ["graph-add", "add-bar"],
      addBar: true,
      focus: [],
      // No add bar along the bottom at this width — the sheet is there — so the
      // graph's own buttons are the whole of what this section can point at.
      narrow: { target: "graph-add", addBar: false },
    },
    {
      id: "narrow-menu",
      only: "narrow",
      title: "Everything else is behind ☰",
      body: [
        "There is no room for a tab bar on a screen this narrow, so everything that is not the graph lives behind the ☰ button: the other views, the settings, import and export, and undo.",
        "The rest of the tour opens it as it goes, and rings whatever it is describing. Nothing here is doing anything until you tap it.",
      ],
      target: "btn-menu",
    },
    {
      id: "revising",
      title: "Revising the graph",
      body: [
        byLayout(
          "Click any node to modify it: revise the wording or withdraw it entirely. Withdrawing is not deleting — the node greys out and keeps its place in the record, and can be reinstated.",
          "Tap any node to modify it: revise the wording or withdraw it entirely. Withdrawing is not deleting — the node greys out and keeps its place in the record, and can be reinstated.",
        ),
        "The principle below went in round 3, once it turned out to conflict with judgments its owner was far more sure of.",
        byLayout(
          "And nothing is final either way: Undo, ringed in the header, steps back through the changes, as does Ctrl+Z. They are grouped by round rather than by keystroke, so it walks back through the thinking rather than through the typing.",
          "And nothing is final either way: Undo, ringed in the ☰ menu, steps back through the changes. They are grouped by round rather than by keystroke, so it walks back through the thinking rather than through the typing.",
        ),
      ],
      quote: ["P4"],
      target: "btn-undo",
      narrow: { target: "menu-undo", menu: true },
    },
    {
      id: "text",
      title: byLayout("The text panel", "The text view"),
      body: [
        "Reading the contents of your position is not limited to the graph. Every element and relation with its round, its confidence, its history, and the same buttons to revise, withdraw or reinstate it can be found in the text panel.",
        byLayout(
          "(You reach it via Assist → Text and Analyze → Graph in the tab bar. The tab bar is hidden while the tour is reading the graph — it comes back a few sections below.)",
          "(You reach it via ☰ → Analyze → Text, and come back the same way.)",
        ),
      ],
      target: "text-panel",
      tab: "graph",
      text: true,
      // A tab of its own at this width rather than a panel beside the graph, so
      // it is reached by opening it rather than by asking for the chrome.
      narrow: { tab: "text", text: false },
    },
    {
      id: "menu-files",
      title: "Saving your progress",
      body: [
        "Nothing you do here is stored on a server, so closing the tab is the end of the process. Export writes it out as a Markdown file instead — every element and relation, the round-by-round log, and the graph's layout — and Import reads one back, yours or one someone sent you.",
        "Both are in the ☰ menu, open beside this card, along with the settings. Hover any entry to find out what it does.",
      ],
      target: "menu-files",
      menu: true,
    },
  ];
}

/** Chapter 3 — where the AI is, and what it is and is not allowed to do. */
function assistSections(cycle, llmEnabled) {
  return [
    {
      id: "assist",
      chapter: "Where AI comes in",
      title: "Assist proposes, you decide",
      body: [
        "The Assist section is the part that uses a large language model: it reads your position and proposes candidates — questions to draw out judgments, principles that would systematise them, arguments hiding between elements you already hold.",
        "PLEASE NOTE: AI-generated statements within this app do not necessarily express the views of the Institute for Ethics in Technology.",
        "Each AI-suggestion arrives as a proposal with an accept and a reject button. Nothing enters your position until you put it there, and anything you accept you can edit first.",
        llmEnabled
          ? "Suggestions are generated live, so they follow whatever you have on screen."
          : "This demo has no model connected, so the Assist tabs show pre-recorded example suggestions from Claude Fable instead of live ones.",
      ],
      target: "meta-assist",
      tab: "elicitJudgments",
      chrome: true,
      focus: [],
      narrow: { target: "menu-assist", menu: true },
    },
    {
      id: "cycle",
      title: `The Workflow cycle: ${cycle}`,
      body: [
        byLayout(
          "The three Assist tabs are one iteration of the process: draw out judgments, find principles that cover them, and detect the arguments between them.",
          "The three Assist views are one iteration of the process: draw out judgments, find principles that cover them, and detect the arguments between them.",
        ),
        "This helps you build out your views and spot both where they hangs together well and where the problems lie.",
        byLayout(
          "Start Workflow runs the iteration for you, tab by tab, and loops. Each iteration is meant to leave your position a little more coherent than it found it.",
          "Start Workflow runs the iteration for you, view by view, and loops. Each iteration is meant to leave your position a little more coherent than it found it.",
        ),
        "Go ahead and click the workflow button.",
      ],
      target: "btn-workflow",
      tab: "elicitJudgments",
      chrome: true,
      narrow: { menu: true },
    },
    {
      id: "llm-settings",
      title: "Bringing your own AI model",
      body: [
        "The app comes with no AI model of its own. Whoever runs it points the app at a model via the ☰ menu — LLM settings.",
        "It asks for three things: a provider, a model on it, and a key to authenticate with — and will test the three against the provider before you commit them.",
        llmEnabled
          ? "This build can reach a backend, so a provider you configure here is the one the Assist tabs will call."
          : "In this public demo, the AI features are not enabled, but you can still see what selecting your model of choice would look like.",
      ],
      target: "btn-llm",
      // Still on the Assist tab: this chapter is about the model, and the
      // entry it rings is in the header either way.
      tab: "elicitJudgments",
      chrome: true,
      menu: true,
    },
  ];
}

/** Chapter 4 — the rest of the interface, in the order it is likely to be needed. */
function chromeSections() {
  return [
    {
      id: "analyze",
      chapter: "The rest of the interface",
      title: "Analyze — where you stand",
      body: [
        "The Analyze part of the app is for looking at the position rather than growing it. Graph is what you have been reading. History replays the process round by round. Clusters finds the largest sets of your accepted elements that hold no conflict.",
      ],
      target: "meta-analyze",
      tab: "graph",
      chrome: true,
      // Back to the whole graph: the last thing that framed it was a section
      // about three nodes, and this one is about the view as a whole.
      focus: [],
      narrow: { target: "menu-analyze", menu: true },
    },
    {
      id: "history",
      title: "History",
      body: [
        "Drag the slider or press Play and the position rebuilds itself round by round, each element appearing in the round it was added and greying out in the round it was withdrawn.",
      ],
      target: "tab-history",
      tab: "history",
      chrome: true,
      // Same entry, in the menu rather than the tab bar — so the menu has to be
      // open before there is anything to ring.
      narrow: { menu: true },
    },
    {
      id: "clusters",
      title: "Coherence clusters",
      body: [
        "The largest groups of connected, currently accepted elements with no conflict inside them. A position that falls into several disconnected clusters is telling you something.",
      ],
      target: "tab-clusters",
      tab: "clusters",
      chrome: true,
      narrow: { menu: true },
    },
    {
      id: "done",
      title: "That's the tour",
      body: [
        byLayout(
          "The demo is yours to explore — click nodes, drag the graph, withdraw something and see what it takes with it. Nothing you do here is saved by us.",
          "The demo is yours to explore — tap nodes, drag the graph, withdraw something and see what it takes with it. Nothing you do here is saved by us.",
        ),
        byLayout(
          "Hover any button to find out what it does. Press ? in the header to read this guided tour again.",
          "Long-press any button to find out what it does. Open ☰ → Guided tour to read this again.",
        ),
      ],
      tab: "graph",
      chrome: true,
      text: true,
      focus: [],
      // The text panel is a tab here, and ending the tour on it would leave the
      // reader looking at a list rather than at the graph they were just
      // invited to explore.
      narrow: { text: false },
    },
  ];
}

/**
 * Settles a script written for both layouts into the one being rendered:
 * drops the sections the other width owns, picks the wording that names the
 * right route, and merges the `narrow` override over the section itself.
 *
 * What comes out is a plain list of sections with `title` and `body` as
 * strings, so neither tour has to know that the other exists.
 */
function forLayout(sections, isNarrow) {
  const layout = isNarrow ? "narrow" : "wide";
  const pick = (value) =>
    value && typeof value === "object" ? value[layout] : value;
  return sections
    .filter((s) => !s.only || s.only === layout)
    .map(({ narrow: override, ...section }) => {
      const resolved = isNarrow ? { ...section, ...override } : section;
      return {
        ...resolved,
        title: pick(resolved.title),
        body: resolved.body.map(pick),
      };
    });
}

/**
 * Builds the tour.
 *
 * @param {Object}  options
 * @param {boolean} options.isSample - Whether the demo state is loaded. The
 *   graph chapter walks the demo's own elements by ID, so on someone's own
 *   process — where those IDs mean something else, or nothing — it is dropped
 *   and the tour is the method, the AI, and the interface.
 * @param {boolean} options.hideNonEntailsRels - Names the cycle after the
 *   relation modes that are on, matching the tabs actually on screen.
 * @param {boolean} options.llmEnabled
 * @param {string}  [options.topic]
 * @param {boolean} [options.narrow] - Which layout is going to read it. The
 *   sections are the same either way; this settles where each one says its
 *   controls are to be found.
 * @returns {TourSection[]}
 */
export function buildTourSections({
  isSample,
  hideNonEntailsRels,
  llmEnabled,
  topic,
  narrow = false,
}) {
  const cycle = hideNonEntailsRels
    ? "judgments → principles → arguments"
    : "judgments → principles → relations → arguments";
  return forLayout(
    [
      ...openingSections(topic),
      ...(isSample ? graphSections() : []),
      ...assistSections(cycle, llmEnabled),
      ...chromeSections(),
    ],
    narrow,
  );
}
