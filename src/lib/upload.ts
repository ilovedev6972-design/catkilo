import { ref as sref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadFile(path: string, file: File | Blob): Promise<string> {
  const r = sref(storage, path);
  await uploadBytes(r, file);
  return await getDownloadURL(r);
}
