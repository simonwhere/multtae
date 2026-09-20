/**
 * 공간 사진: 고르기 → 1280px 로 줄이기 → 문서 폴더에 저장 (SPEC.md 4.1, 15 이미지).
 * 원본은 보관하지 않는다. 다시 인코딩하면서 위치 같은 EXIF 정보도 떨어져 나간다.
 * DB 에는 문서 폴더 기준 상대 경로를 넣는다. iOS 는 앱을 업데이트하면 문서 폴더의 절대 경로가 바뀔 수 있다.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_SIDE = 1280;
const JPEG_QUALITY = 0.8;
const SPACES_DIR = 'spaces';

export type PhotoSource = 'camera' | 'library';

export type PickPhotoResult =
  | { status: 'picked'; photoPath: string }
  | { status: 'canceled' }
  /** 카메라 권한 거부 */
  | { status: 'denied' }
  /** 시뮬레이터처럼 카메라가 없는 기기 */
  | { status: 'unavailable' }
  | { status: 'failed' };

/** 상대 경로를 화면에 띄울 수 있는 file:// 주소로 */
export function photoUri(photoPath: string): string {
  return new File(Paths.document, photoPath).uri;
}

export function photoExists(photoPath: string): boolean {
  return new File(Paths.document, photoPath).exists;
}

export function deletePhoto(photoPath: string): void {
  const file = new File(Paths.document, photoPath);
  if (file.exists) file.delete();
}

async function launch(source: PhotoSource): Promise<ImagePicker.ImagePickerResult | 'denied' | 'unavailable'> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };

  if (source === 'library') {
    return ImagePicker.launchImageLibraryAsync(options);
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return 'denied';
  try {
    return await ImagePicker.launchCameraAsync(options);
  } catch {
    return 'unavailable';
  }
}

export async function pickSpacePhoto(source: PhotoSource, spaceId: string): Promise<PickPhotoResult> {
  const result = await launch(source);
  if (result === 'denied' || result === 'unavailable') return { status: result };
  if (result.canceled) return { status: 'canceled' };

  try {
    const asset = result.assets[0];
    const context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(asset.width, asset.height) > MAX_SIDE) {
      context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

    const directory = new Directory(Paths.document, SPACES_DIR);
    directory.create({ idempotent: true, intermediates: true });
    // 다시 고를 때마다 이름이 달라야 화면의 이미지 캐시가 새 사진을 보여 준다.
    const fileName = `${spaceId}-${Date.now()}.jpg`;
    new File(saved.uri).move(new File(directory, fileName));

    return { status: 'picked', photoPath: `${SPACES_DIR}/${fileName}` };
  } catch {
    return { status: 'failed' };
  }
}
