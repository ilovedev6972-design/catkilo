import {
  collection, addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc,
  query, orderBy, limit, getDocs, where, updateDoc, increment, onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

export interface Post {
  id: string;
  authorId: string;
  username: string;
  authorPhoto?: string;
  caption: string;
  mediaUrls: string[];
  mediaType: "image" | "video";
  hashtags: string[];
  location?: string;
  likesCount: number;
  commentsCount: number;
  createdAt: any;
}

export async function createPost(data: Omit<Post, "id" | "likesCount" | "commentsCount" | "createdAt">) {
  const ref = await addDoc(collection(db, "posts"), {
    ...data,
    likesCount: 0,
    commentsCount: 0,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", data.authorId), { postsCount: increment(1) });
  return ref.id;
}

export async function deletePost(postId: string, authorId: string) {
  await deleteDoc(doc(db, "posts", postId));
  await updateDoc(doc(db, "users", authorId), { postsCount: increment(-1) });
}

export async function toggleLike(postId: string, userId: string, authorId: string) {
  const likeRef = doc(db, "posts", postId, "likes", userId);
  const snap = await getDoc(likeRef);
  if (snap.exists()) {
    await deleteDoc(likeRef);
    await updateDoc(doc(db, "posts", postId), { likesCount: increment(-1) });
  } else {
    await setDoc(likeRef, { userId, createdAt: serverTimestamp() });
    await updateDoc(doc(db, "posts", postId), { likesCount: increment(1) });
    if (authorId !== userId) {
      await addDoc(collection(db, "notifications"), {
        userId: authorId, fromUserId: userId, type: "like", postId, read: false, createdAt: serverTimestamp(),
      });
    }
  }
}

export async function toggleSave(postId: string, userId: string) {
  const ref = doc(db, "users", userId, "saved", postId);
  const snap = await getDoc(ref);
  if (snap.exists()) await deleteDoc(ref);
  else await setDoc(ref, { postId, savedAt: serverTimestamp() });
}

export async function toggleFollow(targetId: string, currentId: string) {
  const f = doc(db, "users", currentId, "following", targetId);
  const snap = await getDoc(f);
  if (snap.exists()) {
    await deleteDoc(f);
    await deleteDoc(doc(db, "users", targetId, "followers", currentId));
    await updateDoc(doc(db, "users", currentId), { followingCount: increment(-1) });
    await updateDoc(doc(db, "users", targetId), { followersCount: increment(-1) });
  } else {
    await setDoc(f, { userId: targetId, createdAt: serverTimestamp() });
    await setDoc(doc(db, "users", targetId, "followers", currentId), { userId: currentId, createdAt: serverTimestamp() });
    await updateDoc(doc(db, "users", currentId), { followingCount: increment(1) });
    await updateDoc(doc(db, "users", targetId), { followersCount: increment(1) });
    await addDoc(collection(db, "notifications"), {
      userId: targetId, fromUserId: currentId, type: "follow", read: false, createdAt: serverTimestamp(),
    });
  }
}

export async function addComment(postId: string, postAuthorId: string, userId: string, username: string, photoURL: string, text: string) {
  await addDoc(collection(db, "posts", postId, "comments"), {
    userId, username, photoURL, text, likes: 0, createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "posts", postId), { commentsCount: increment(1) });
  if (postAuthorId !== userId) {
    await addDoc(collection(db, "notifications"), {
      userId: postAuthorId, fromUserId: userId, type: "comment", postId, text, read: false, createdAt: serverTimestamp(),
    });
  }
}

export { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, increment };
