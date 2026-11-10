import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import { jsonBody, request } from './http';

export type UserProfile = { id: number; name: string; emailId: string; birthDate: string; role: 'STUDENT' | 'TEACHER'; profileImageUrl: string | null };
export const userApi = {
  get: (userId: number, token: string, signal?: AbortSignal) => request<UserProfile>(`/api/users/${userId}`, { signal }, token),
  updateName: (name: string, token: string) => request<UserProfile>('/api/setting/username', { method: 'PATCH', ...jsonBody({ name }) }, token),
  updateImage: (profileImageUrl: string, token: string) => request<UserProfile>('/api/setting/profile-image', { method: 'PATCH', ...jsonBody({ profileImageUrl }) }, token),
  remove: (userId: number, token: string) => request<void>(`/api/users/${userId}`, { method: 'DELETE' }, token),
  upload: async (asset: ImagePickerAsset, token: string) => {
    const form = new FormData();
    if (Platform.OS === 'web' && asset.file) form.append('file', asset.file, asset.file.name);
    else form.append('file', { uri: asset.uri, name: asset.fileName ?? 'profile.jpg', type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob);
    const uploaded = await request<{ fileId: number; imageUrl: string }>('/api/files/images', { method: 'POST', body: form }, token);
    if (!uploaded?.imageUrl) throw new Error('업로드 결과를 확인할 수 없어요.');
    return uploaded;
  },
};
