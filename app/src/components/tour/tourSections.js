/**
 * @fileoverview The script the wide guided tour reads from: one flat, ordered
 * list of sections the visitor scrolls through.
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
 * @module components/tour/tourSections
 */

/**
 * @typedef {Object} TourSection
 * @property {string}   id       - Stable key.
 * @property {string}   [chapter] - Chapter heading; set on the section that opens one.
 * @property {string}   title
 * @property {string[]} body     - Paragraphs.
 * @property {string[]} [quote]  - Element IDs whose own text is shown as a card,
 *   read from the live state rather than copied here.
 * @property {string[]} [focus]  - Element IDs the graph zooms to. Omitted keeps
 *   the previous framing; `[]` means "the whole graph again".
 * @property {string}   [select] - Element ID to select, highlighting it and its
 *   neighbours.
 * @property {string}   [argument] - Argument ID to select, highlighting every
 *   premise, the conclusion, and the arrows between them.
 * @property {string}   [target] - `data-tutorial` id of a control to ring.
 * @property {string}   [tab]    - Tab to open before the section is shown.
 * @property {boolean}  [chrome] - True once the app's tab bar belongs on screen.
 * @property {boolean}  [text]   - True where the text panel belongs on screen.
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
        "Reflective equilibrium is a view of how justification works for beliefs in ethics. Roughly, you start from concrete moral judgments you are fairly confident about, look for general principles that would explain why they hold, and then adjust both sides until they fit together.",
        "Neither side is bedrock. A principle you like can be given up because a case tells against it, and a verdict you were sure of can be given up because the principle that best explains everything else says otherwise. What justifies your position, in the end, is that it hangs together.",
      ],
      focus: [],
    },
    {
      id: "what-appilibrium-is",
      chapter: "The method",
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
      title: "The example question",
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
 * Chapter 2 — reading the demo graph.
 *
 * The graph's default view shows arguments only, so every section here walks
 * elements that an argument actually connects. Together they answer "what is a
 * judgment, what is a principle, and why do I need them" by pointing at three
 * of each rather than by defining the terms.
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
      title: "Arguments connect the two",
      body: [
        "Arrows represent arguments. An argument runs from premises to a conclusion: here the principle alone settles the case, so it entails the judgment on its own.",
        "Click any arrow in the graph and the whole argument it belongs to lights up. That is the unit the tool works in — not a loose association between two ideas, but a claim that these premises get you that conclusion.",
      ],
      quote: ["P1", "J3"],
      focus: ["P1", "J3"],
      argument: "arg-sample-4",
    },
    {
      id: "joint-argument",
      title: "Two premises, one conclusion",
      body: [
        "Most arguments need more than one premise. Their lines converge on a dot and continue as a single arrow: neither premise gets you to the conclusion alone, but together they do.",
        "That matters when something has to give. Withdraw either premise and the conclusion loses its support.",
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
      id: "withdrawn",
      title: "Nothing here is permanent",
      body: [
        "Greyed, struck-through nodes were held earlier and given up later. This principle was adopted in round 2 and withdrawn in round 3, once it turned out to conflict with judgments its owner was far more sure of.",
        "Withdrawing is not deleting: it stays in the record, with the reason and the round, and can be reinstated.",
      ],
      quote: ["P4"],
      focus: ["P4"],
      select: "P4",
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
        "Everything so far was structure. The Assist section is the part that uses a language model: it reads your position and proposes candidates — questions to draw out judgments, principles that would systematise them, arguments hiding between elements you already hold.",
        "Every suggestion arrives as a proposal with an accept and a reject button. Nothing enters your position until you put it there, and anything you accept you can edit first.",
        llmEnabled
          ? "Suggestions are generated live, so they follow whatever you have on screen."
          : "This public build has no model connected, so the Assist tabs show pre-recorded example suggestions instead of live ones.",
      ],
      target: "meta-assist",
      tab: "elicitJudgments",
      chrome: true,
      focus: [],
    },
    {
      id: "cycle",
      title: `The Workflow cycle: ${cycle}`,
      body: [
        "The three Assist tabs are one iteration of the process: draw out judgments, find principles that cover them, and detect the arguments between them.",
        "This helps you build out your views and spot both where they hangs together well and where the problems lie.",
        "Start Workflow runs the iteration for you, tab by tab, and loops. Each iteration is meant to leave your position a little more coherent than it found it.",
      ],
      target: "btn-workflow",
      tab: "elicitJudgments",
      chrome: true,
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
        "The other half of the app is for looking at the position rather than growing it. Graph is what you have been reading. History replays the process round by round. Clusters finds the largest sets of your accepted elements that hold no conflict.",
      ],
      target: "meta-analyze",
      tab: "graph",
      chrome: true,
      // Back to the whole graph: the last thing that framed it was a section
      // about three nodes, and this one is about the view as a whole.
      focus: [],
    },
    {
      id: "text",
      title: "The text panel",
      body: [
        "Beside the graph, the same position in full prose — every element and relation with its round, its confidence, its history, and the buttons to revise, withdraw or reinstate it.",
        "The graph is for seeing shape; this is for reading and editing. Use the full-screen button above the graph to fold it away.",
      ],
      tab: "graph",
      chrome: true,
      text: true,
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
    },
    {
      id: "menu",
      title: "Undo, settings, import and export",
      body: [
        "Undo steps back through the process; changes are grouped by round rather than by keystroke. Ctrl+Z does the same.",
        "The ☰ menu holds the rest: show relations beyond argument — support, conflict, undermining, dependence — pick a font or a light theme, and import or export the whole process as a Markdown file you can keep or send on.",
      ],
      target: "btn-menu",
      tab: "graph",
      chrome: true,
    },
    {
      id: "done",
      title: "That's the tour",
      body: [
        "The demo is yours to break — click nodes, drag the graph, withdraw something and see what it takes with it. Nothing you do here is saved.",
        "Press ? in the header to read this again, and hover any button to find out what it does.",
      ],
      tab: "graph",
      chrome: true,
      text: true,
      focus: [],
    },
  ];
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
 * @returns {TourSection[]}
 */
export function buildTourSections({
  isSample,
  hideNonEntailsRels,
  llmEnabled,
  topic,
}) {
  const cycle = hideNonEntailsRels
    ? "judgments → principles → arguments"
    : "judgments → principles → relations → arguments";
  return [
    ...openingSections(topic),
    ...(isSample ? graphSections() : []),
    ...assistSections(cycle, llmEnabled),
    ...chromeSections(),
  ];
}
