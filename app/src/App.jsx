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
  // One per process opened. The editor reads `initialState` once, as it
  // mounts, so going from one process straight to another — the tour's way to
  // the demo — has to mount it afresh; leaving the old one also flushes its
  // autosave.
  const [session, setSession] = useState(0);

  const navigate = (state, sample = false) => {
    setLoading(true);
    setIsSample(sample);
    setInitialState(state);
    setSession((n) => n + 1);
  };

  // The home page's Tutorial button, reached from inside the editor.
  const startDemoTour = () => {
    sessionStorage.setItem("startTour", "1");
    navigate(SAMPLE_STATE, true);
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
        key={session}
        initialState={initialState}
        isSample={isSample}
        onHome={() => setInitialState(null)}
        onReady={() => setLoading(false)}
        onStartDemoTour={startDemoTour}
      />
    </>
  );
}
