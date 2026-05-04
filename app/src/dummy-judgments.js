// Dummy judgment elicitation suggestions for the JudgmentElicitTab.
// Topic: obligations to future generations (matches dummy-state.js).
// Used automatically in PROD, or in DEV when the "Use dummy suggestions" toggle is on.

const dummyJudgments = {
  model: "dummy",
  suggestions: [
    {
      question:
        "(This is a dummy suggestion.) A company buries toxic waste that will only become dangerous in 300 years. No one alive today will be harmed. Is the company acting wrongly?",
      judgments: [
        {
          text: "Knowingly creating serious hazards for future people is morally wrong, even when no currently living person will be affected.",
          confidence: "high",
        },
        {
          text: "The action is permissible provided the company discloses the risk and sets aside remediation funds.",
          confidence: "moderate",
        },
        {
          text: "Without a determinate victim, no wrong is committed — future people's interests cannot yet ground obligations.",
          confidence: "low",
        },
      ],
    },
    {
      question:
        "Suppose present choices will make Earth inhospitable for humans in 500 years, but will be replaced by a larger, equally flourishing population of a different kind. Has a wrong been committed?",
      judgments: [
        {
          text: "Replacing one set of future people with a different, equally well-off set does not by itself constitute a moral wrong.",
          confidence: "moderate",
        },
        {
          text: "We have a special obligation to the future humans who would have existed, so the substitution is wrong regardless of aggregate welfare.",
          confidence: "moderate",
        },
      ],
    },
    {
      question:
        "A wealthy generation consumes all easily accessible fossil fuels, leaving future generations to meet their needs at significantly higher cost. Is this unjust?",
      judgments: [
        {
          text: "It is unjust to impose significantly higher costs on future generations for meeting basic needs, even if those needs can still be met.",
          confidence: "moderate",
        },
        {
          text: "Intergenerational resource use is just as long as future generations are left with equivalent overall opportunities (the sustainability criterion).",
          confidence: "moderate",
        },
        {
          text: "There is no injustice: each generation is entitled to use available resources for its own flourishing.",
          confidence: "low",
        },
      ],
    },
    {
      question:
        "Should parliaments and courts give binding legal weight to the interests of future generations, even at the expense of currently living citizens?",
      judgments: [
        {
          text: "Democratic institutions have a duty to formally represent the interests of future generations in their decision-making processes.",
          confidence: "low",
        },
        {
          text: "Future generations' interests should inform policy but should not override democratically expressed preferences of living citizens.",
          confidence: "moderate",
        },
      ],
    },
  ],
};

export default dummyJudgments;
