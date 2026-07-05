interface Step {
  label: string;
}

export function StepsRow({ steps, currentIndex }: { steps: Step[]; currentIndex: number }) {
  return (
    <div className="steps-row" style={{ padding: '0 0 20px 0' }}>
      {steps.map((step, i) => {
        const state = i < currentIndex ? 'done' : i === currentIndex ? 'active' : 'pending';
        return (
          <div key={step.label} style={{ display: 'contents' }}>
            <div className="step-item">
              <div className={`step-circle ${state}`}>{state === 'done' ? '✓' : i + 1}</div>
              <div className={`step-label ${state}`}>{step.label}</div>
            </div>
            {i < steps.length - 1 && <div className={`step-line ${i < currentIndex ? 'done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}
