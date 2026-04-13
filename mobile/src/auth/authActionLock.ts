type AuthAction = () => Promise<boolean>;

export type AuthActionLock = {
  isLocked: () => boolean;
  run: (action: AuthAction) => Promise<boolean>;
};

export function createAuthActionLock(): AuthActionLock {
  let locked = false;

  return {
    isLocked() {
      return locked;
    },

    async run(action) {
      if (locked) {
        return false;
      }

      locked = true;

      try {
        return await action();
      } finally {
        locked = false;
      }
    },
  };
}
