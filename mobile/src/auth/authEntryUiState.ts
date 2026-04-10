type ResolveAuthEntryUiStateParams = {
  hasGoogleAuthOption: boolean;
  hasAppleAuthOption: boolean;
  isBusy: boolean;
};

export function resolveAuthEntryUiState({
  hasGoogleAuthOption,
  hasAppleAuthOption,
  isBusy,
}: ResolveAuthEntryUiStateParams): {
  canSwitchScreens: boolean;
  showOauthDivider: boolean;
} {
  return {
    canSwitchScreens: !isBusy,
    showOauthDivider: hasGoogleAuthOption || hasAppleAuthOption,
  };
}
