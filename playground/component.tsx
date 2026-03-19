type PanelProps = {
  title: string;
};

function usePanelState() {
  function openPanel() {
    return true;
  }

  function closePanel() {
    return false;
  }

  return { openPanel, closePanel };
}

export function Panel({ title }: PanelProps) {
  const { openPanel, closePanel } = usePanelState();

  function renderHeader() {
    return <header>{title}</header>;
  }

  function renderBody() {
    return (
      <section>
        <button onClick={openPanel}>Open</button>
        <button onClick={closePanel}>Close</button>
      </section>
    );
  }

  return (
    <article>
      {renderHeader()}
      {renderBody()}
    </article>
  );
}
