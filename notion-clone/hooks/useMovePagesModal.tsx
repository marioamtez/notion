import { create } from "zustand";

type MovePagesModalStore = {
  pilaId?: string;
  isOpen: boolean;
  onOpen: (pilaId: string) => void;
  onClose: () => void;
};

export const useMovePagesModal = create<MovePagesModalStore>((set) => ({
  pilaId: undefined,
  isOpen: false,
  onOpen: (pilaId) => set({ isOpen: true, pilaId }),
  onClose: () => set({ isOpen: false, pilaId: undefined }),
}));
