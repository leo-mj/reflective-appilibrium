import { useState } from "react";
import { HomePage } from "./components/HomePage.jsx";
import REState from "./components/REState.jsx";
import { SAMPLE_STATE, makeEmptyState, makeQuestionnaireState } from "./state.js";
import { C } from "./constants/colors.js";

function Spinner() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: `3px solid ${C.border}`,
          borderTopColor: C.supports,
          animation: "spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

export default function App() {
  const [initialState, setInitialState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSample, setIsSample] = useState(false);

  const navigate = (state, sample = false) => {
    setLoading(true);
    setIsSample(sample);
    setInitialState(state);
  };

  if (!initialState) {
    return (
      <HomePage
        onStartFresh={(topic) => navigate(makeEmptyState(topic))}
        onLoadSample={() => navigate(SAMPLE_STATE, true)}
        onLoadQuestionnaire={(spec) => navigate(makeQuestionnaireState(spec), true)}
        onLoadSession={(state) => navigate(state)}
      />
    );
  }

  return (
    <>
      {loading && <Spinner />}
      <REState
        initialState={initialState}
        isSample={isSample}
        onHome={() => setInitialState(null)}
        onReady={() => setLoading(false)}
      />
    </>
  );
}
