import { mock } from 'bun:test';

function NullComponent() {
  return null;
}

mock.module('react-native', () => ({
  ActivityIndicator: NullComponent,
  FlatList: NullComponent,
  Linking: {
    getInitialURL: async () => null,
  },
  Platform: {
    OS: 'ios',
  },
  Pressable: NullComponent,
  ScrollView: NullComponent,
  StyleSheet: {
    create: <Styles>(styles: Styles): Styles => styles,
  },
  Text: NullComponent,
  TextInput: NullComponent,
  View: NullComponent,
}));
