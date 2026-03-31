// Dummy judgment elicitation suggestions for the JudgmentElicitTab.
// Topic: obligations to future generations (matches dummy-state.js).
// Set VITE_USE_DUMMY=true in .env to use this instead of calling the backend.

const dummyJudgments = {
  model: "dummy",
  suggestions: [
    {
      question:
        "(This is a dummy suggestion.) A company buries toxic waste that will only become dangerous in 300 years. No one alive today will be harmed. Is the company acting wrongly?",
      text: "Knowingly creating serious hazards for future people is morally wrong, even when no currently living person will be affected.",
      confidence: "high",
    },
    {
      question:
        "Suppose present choices will make Earth inhospitable for humans in 500 years, but will be replaced by a larger, equally flourishing population. Has a wrong been committed?",
      text: "Replacing one set of future people with a different, equally well-off set does not by itself constitute a moral wrong.",
      confidence: "moderate",
    },
    {
      question:
        "A wealthy generation consumes all easily accessible fossil fuels, leaving future generations to develop expensive alternatives. They are still able to meet their needs, just at higher cost. Is this unjust?",
      text: "It is unjust to impose significantly higher costs on future generations for meeting basic needs, even if those needs can still be met.",
      confidence: "moderate",
    },
    {
      question:
        "Should parliaments and courts give binding legal weight to the interests of future generations, even at the expense of currently living citizens?",
      text: "Democratic institutions have a duty to formally represent the interests of future generations in their decision-making processes.",
      confidence: "low",
    },
  ],
};

export default dummyJudgments;
