import { vi } from 'vitest';

function NullComponent() {
  return null;
}

vi.mock('react-native', () => ({
  ActivityIndicator: NullComponent,
  FlatList: NullComponent,
  Linking: {
    getInitialURL: () => Promise.resolve(null),
  },
  Platform: {
    OS: 'ios',
  },
  Pressable: NullComponent,
  RefreshControl: NullComponent,
  ScrollView: NullComponent,
  StyleSheet: {
    create: <Styles>(styles: Styles): Styles => styles,
  },
  Text: NullComponent,
  TextInput: NullComponent,
  View: NullComponent,
}));
