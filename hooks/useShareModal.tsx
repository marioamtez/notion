import { create } from "zustand";

type ShareModalStore = {
  documentId?: string;
  isOpen: boolean;
  onOpen: (documentId: string) => void;
  onClose: () => void;
};

export const useShareModal = create<ShareModalStore>((set) => ({
  documentId: undefined,
  isOpen: false,
  onOpen: (documentId) => set({ isOpen: true, documentId }),
  onClose: () => set({ isOpen: false, documentId: undefined }),
}));
