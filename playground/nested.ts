class ExampleRunner {
  private beforeAll() {
    return "before";
  }

  run() {
    function loadInput() {
      return ["a", "b", "c"];
    }

    function normalizeInput() {
      return loadInput().map(item => item.toUpperCase());
    }

    return normalizeInput();
  }

  private afterAll() {
    return "after";
  }
}

export function outerOne() {
  return new ExampleRunner();
}

export function outerTwo() {
  return outerOne();
}
