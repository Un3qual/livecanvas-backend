export type AuthSubmissionGate = {
  begin: () => boolean;
  end: () => void;
  isActive: () => boolean;
};

export function createAuthSubmissionGate(): AuthSubmissionGate {
  let active = false;

  return {
    begin() {
      if (active) {
        return false;
      }

      active = true;
      return true;
    },

    end() {
      active = false;
    },

    isActive() {
      return active;
    },
  };
}
