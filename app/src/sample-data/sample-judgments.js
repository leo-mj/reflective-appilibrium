// Sample judgment elicitation suggestions for the JudgmentElicitTab.
// Topic: obligations to future generations (matches sample-state.js).
// Used automatically in PROD, or in DEV when the "Use sample data" toggle is on.

// Two judgment texts that double as suppressed premises in sample-arguments.js.
// If the user accepts one of these here, Detect Arguments finds it already in the
// pool (matched by text) and reconstructs the argument from it, instead of
// re-proposing it as a freshly added premise. Defined in one place so the elicit
// option and the argument premise can never drift apart.
export const ELICITABLE_ARGUMENT_PREMISES = {
  affected2100:
    "People living in 2100 and beyond will be causally affected by climate policies adopted today.",
  extinctionNonCreation:
    "A society's failure to prevent its own distant extinction wrongs no one now alive and, with respect to future people, merely fails to bring them into existence.",
};

const sampleJudgments = {
  model: "claude-fable-5",
  suggestions: [
    {
      question:
        "A company buries toxic waste that will only become dangerous in 300 years. No one alive today will be harmed. Is the company acting wrongly?",
      judgments: [
        {
          text: "Knowingly creating serious hazards for future people is morally wrong, even when no currently living person will be affected.",
          confidence: 0.67,
        },
        {
          text: "The action is permissible provided the company discloses the risk and sets aside remediation funds.",
          confidence: 0.67,
        },
        {
          text: "Without a determinate victim, no wrong is committed — future people's interests cannot yet ground obligations.",
          confidence: 0.67,
        },
      ],
    },
    {
      question:
        "Suppose present choices will make Earth inhospitable for humans in 500 years, but will be replaced by a larger, equally flourishing population of a different kind. Has a wrong been committed?",
      judgments: [
        {
          text: "Replacing one set of future people with a different, equally well-off set does not by itself constitute a moral wrong.",
          confidence: 0.67,
        },
        {
          text: "We have a special obligation to the future humans who would have existed, so the substitution is wrong regardless of aggregate welfare.",
          confidence: 0.67,
        },
      ],
    },
    {
      question:
        "A wealthy generation consumes all easily accessible fossil fuels, leaving future generations to meet their needs at significantly higher cost. Is this unjust?",
      judgments: [
        {
          text: "It is unjust to impose significantly higher costs on future generations for meeting basic needs, even if those needs can still be met.",
          confidence: 0.67,
        },
        {
          text: "Intergenerational resource use is just as long as future generations are left with equivalent overall opportunities (the sustainability criterion).",
          confidence: 0.67,
        },
        {
          text: "There is no injustice: each generation is entitled to use available resources for its own flourishing.",
          confidence: 0.67,
        },
      ],
    },
    {
      question:
        "Should parliaments and courts give binding legal weight to the interests of future generations, even at the expense of currently living citizens?",
      judgments: [
        {
          text: "Democratic institutions have a duty to formally represent the interests of future generations in their decision-making processes.",
          confidence: 0.67,
        },
        {
          text: "Future generations' interests should inform policy but should not override democratically expressed preferences of living citizens.",
          confidence: 0.67,
        },
      ],
    },
    {
      question:
        "Is it actually true that the decisions we make now will causally reach people in 2100 and beyond, or is the far future too unpredictable for present acts to determinately affect it?",
      judgments: [
        {
          text: ELICITABLE_ARGUMENT_PREMISES.affected2100,
          confidence: 0.67,
        },
        {
          text: "Beyond a few decades causal chains become too diffuse to say present policy determinately affects any particular future outcome.",
          confidence: 0.67,
        },
      ],
    },
    {
      question:
        "A society could prevent its own painless, distant extinction but declines to. Setting aside effects on people now alive, is anyone wronged?",
      judgments: [
        {
          text: ELICITABLE_ARGUMENT_PREMISES.extinctionNonCreation,
          confidence: 0.67,
        },
        {
          text: "Allowing avoidable extinction wrongs the future people who would otherwise have come to exist and lived good lives.",
          confidence: 0.67,
        },
      ],
    },
  ],
};

export default sampleJudgments;
