import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
} from 'expo-image-picker';

import {
  pickPostMediaWithPicker,
  type PickedPostMedia,
} from './mediaPostSelectionCore';

const mediaPostPicker = {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
};

export {
  MEDIA_POST_MIME_TYPES,
  MediaPostSelectionError,
} from './mediaPostSelectionCore';
export type {
  MediaPostKind,
  MediaPostMimeType,
  MediaPostPicker,
  PickedPostMedia,
} from './mediaPostSelectionCore';

export function pickPostMedia(): Promise<PickedPostMedia | null> {
  return pickPostMediaWithPicker(mediaPostPicker);
}
