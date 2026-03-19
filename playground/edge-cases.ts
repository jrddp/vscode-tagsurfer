function overloaded(value: string): string;
function overloaded(value: number): number;
function overloaded(value: string | number) {
  return value;
}

export const makeWidget = () => {
  return {
    mount() {
      return "mounted";
    },
    destroy() {
      return "destroyed";
    },
  };
};

namespace InternalTools {
  export function alpha() {
    return 1;
  }

  export function beta() {
    return 2;
  }
}

class DecoratedExample {
  static first() {
    return overloaded("one");
  }

  static second() {
    return overloaded(2);
  }
}

export { DecoratedExample, InternalTools };
