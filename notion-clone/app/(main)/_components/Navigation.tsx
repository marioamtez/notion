"use client";

import React, { ComponentRef, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "usehooks-ts";
import { useCreateDocument, useCreatePila } from "@/hooks/useDocumentMutations";
import { useMovePagesModal } from "@/hooks/useMovePagesModal";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { ADMIN_EMAILS } from "@/lib/adminEmails";
import { useParams, usePathname, useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { RootDocumentList } from "./RootDocumentList";
import { Item } from "./Item";
import { UserItem } from "./UserItem";

import { toast } from "sonner";
import {
  ChevronsLeft,
  Globe,
  MenuIcon,
  Plus,
  PlusCircle,
  Search,
  Settings,
  Trash,
  Users,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TrashBox } from "./TrashBox";
import { useSearch } from "@/hooks/useSearch";
import { useSettings } from "@/hooks/useSettingsModal";
import { Navbar } from "./Navbar";
import { ScrollableList } from "@/components/scrollable-list";
import { FavoritesList } from "./FavoritesList";
import { ActionTooltip } from "@/components/action-tooltip";
import { useFocusMode } from "@/hooks/useFocusMode";
import NavDrawer from "./NavDrawer";

const Navigation = () => {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();

  const isMobile = useMediaQuery("(max-width: 768px)");
  const isDesktop = useMediaQuery("(min-width: 1020px)");

  const search = useSearch();
  const settings = useSettings();
  const { user } = useSupabaseUser();
  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase());

  const { focusMode, setFocusMode } = useFocusMode();
  const prevFocusMode = useRef(focusMode);

  const { mutateAsync: create } = useCreateDocument();
  const { mutateAsync: createPila } = useCreatePila();
  const movePagesModal = useMovePagesModal();

  const isResizingRef = useRef(false);
  const sidebarRef = useRef<ComponentRef<"aside">>(null);
  const navbarRef = useRef<ComponentRef<"div">>(null);

  const [isResetting, setIsResetting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(isMobile);

  const [isNavbarHovered, setIsNavbarHovered] = useState(false);

  // sidebar effects
  useEffect(() => {
    if (isMobile) {
      collapse();
    } else {
      resetWidth();
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile) {
      collapse();
    }
  }, [pathname, isMobile]);

  // focus mode effects
  useEffect(() => {
    if (isMobile) return;

    if (focusMode && params.documentId) {
      collapse();
    } else if (!focusMode && prevFocusMode.current && params.documentId) {
      resetWidth();
    } else if (!isCollapsed) {
      resetWidth();
    }

    prevFocusMode.current = focusMode;
  }, [params.documentId, focusMode, isMobile, isCollapsed]);

  useEffect(() => {
    if (!navbarRef.current) return;

    if (
      focusMode &&
      params.documentId &&
      !isNavbarHovered &&
      isCollapsed &&
      !isMobile
    ) {
      setTimeout(
        () => navbarRef.current?.style.setProperty("opacity", "0"),
        400,
      );
    } else {
      navbarRef.current.style.removeProperty("opacity");
    }
  }, [focusMode, params.documentId, isMobile, isNavbarHovered, isCollapsed]);

  // key binds effects
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "\\") {
        e.preventDefault();
        isCollapsed ? resetWidth() : collapse();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "F") {
        e.preventDefault();
        setFocusMode(!focusMode);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusMode]);

  const handleMouseDown = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    isResizingRef.current = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    let newWidth = e.clientX;

    if (newWidth < 240) newWidth = 240;
    if (newWidth > 480) newWidth = 480;

    if (sidebarRef.current && navbarRef.current) {
      sidebarRef.current.style.width = `${newWidth}px`;
      navbarRef.current.style.setProperty("left", `${newWidth}px`);
      navbarRef.current.style.setProperty(
        "width",
        `calc(100% - ${newWidth}px)`,
      );
    }
  };

  const handleMouseUp = () => {
    isResizingRef.current = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const resetWidth = () => {
    if (sidebarRef.current && navbarRef.current) {
      setIsCollapsed(false);
      setIsResetting(true);
      setTimeout(() => {
        if (sidebarRef.current && navbarRef.current) {
          sidebarRef.current.style.width = isMobile ? "100%" : "240px";
          navbarRef.current.style.removeProperty("width");
          navbarRef.current.style.setProperty(
            "width",
            isMobile ? "0" : "calc(100%-240px)",
          );
          navbarRef.current.style.setProperty(
            "left",
            isMobile ? "100%" : "240px",
          );
        }
      }, 0);
      setTimeout(() => setIsResetting(false), 300);
    }
  };

  const collapse = () => {
    if (sidebarRef.current && navbarRef.current) {
      setIsCollapsed(true);
      setIsResetting(true);

      sidebarRef.current.style.width = "0";
      navbarRef.current.style.setProperty("width", "100%");
      navbarRef.current.style.setProperty("left", "0");
      setTimeout(() => setIsResetting(false), 300);
    }
  };

  const handleCreate = () => {
    const promise = create({ title: "Sin título" }).then((doc) =>
      router.push(`/documents/${doc.id}`),
    );

    toast.promise(promise, {
      loading: "Creando una nota nueva....",
      success: "Nota creada.",
      error: "No se pudo crear la nota.",
    });
  };

  const handleCreatePila = () => {
    const promise = createPila({ title: "Nueva pila pública" }).then((doc) => {
      router.push(`/documents/${doc.id}`);
      movePagesModal.onOpen(doc.id);
    });

    toast.promise(promise, {
      loading: "Creando pila pública...",
      success: "Pila creada.",
      error: "No se pudo crear la pila.",
    });
  };

  return (
    <>
      <aside
        ref={sidebarRef}
        className={cn(
          "group/sidebar bg-secondary relative z-300 flex h-full w-60 flex-col overflow-hidden overflow-x-hidden pb-4",
          isResetting && "transition-all duration-300 ease-in-out",
          isMobile && "w-0",
        )}
      >
        <ActionTooltip label="Cerrar la barra lateral (Ctrl + \)">
          <div
            onClick={collapse}
            role="button"
            aria-label="Cerrar la barra lateral"
            className={cn(
              "text-muted-foreground absolute top-3 right-2 h-6 w-6 rounded-sm opacity-0 transition group-hover/sidebar:opacity-100 hover:bg-neutral-300 dark:hover:bg-neutral-600",
              isMobile && "opacity-100",
            )}
          >
            <ChevronsLeft className="h-6 w-6" />
          </div>
        </ActionTooltip>
        <div>
          <UserItem />
          <Item
            label="Buscar"
            icon={Search}
            onClick={search.onOpen}
            shortcut="Ctrl + K"
          />
          <Item label="Ajustes" icon={Settings} onClick={settings.onOpen} />
          {isAdmin && (
            <Item
              label="Usuarios"
              icon={Users}
              onClick={() => router.push("/admin/users")}
            />
          )}
          <Item onClick={handleCreate} label="Nueva página" icon={PlusCircle} />
          <Item
            onClick={handleCreatePila}
            label="Crear pila pública"
            icon={Globe}
          />
        </div>
        <div className="mt-4">
          <div>
            <ScrollableList>
              <FavoritesList />
              <RootDocumentList />
            </ScrollableList>
          </div>
          <Item onClick={handleCreate} icon={Plus} label="Añadir página" />
          <Popover>
            <PopoverTrigger className="mt-3 w-full">
              <Item label="Papelera" icon={Trash} />
            </PopoverTrigger>
            <PopoverContent
              side={isMobile ? "bottom" : "right"}
              className="w-72 p-0"
              collisionPadding={16}
            >
              <TrashBox />
            </PopoverContent>
          </Popover>
        </div>
        <div
          onMouseDown={handleMouseDown}
          onClick={resetWidth}
          className="bg-primary/10 absolute top-0 right-0 h-full w-1 cursor-ew-resize opacity-0 transition group-hover/sidebar:opacity-100"
        ></div>
      </aside>
      {isCollapsed && isDesktop && !focusMode && (
        <NavDrawer resetWidth={resetWidth} isMobile={isMobile} />
      )}
      <div
        ref={navbarRef}
        onMouseEnter={() => setIsNavbarHovered(true)}
        onMouseLeave={() => setIsNavbarHovered(false)}
        className={cn(
          "absolute top-0 left-60 z-40 w-[calc(100%-240px)]",
          !isResizingRef.current && "transition-all duration-300 ease-in-out",
          isMobile && "left-0 w-full",
        )}
      >
        {!!params.documentId ? (
          (!isMobile || isCollapsed) && (
            <Navbar isCollapsed={isCollapsed} onResetWidth={resetWidth} />
          )
        ) : (
          <nav
            className={cn(
              "w-full bg-transparent px-3 py-2",
              !isCollapsed && "p-0",
            )}
          >
            {isCollapsed && (
              <ActionTooltip label="Abrir la barra lateral (Ctrl + \)">
                <button onClick={resetWidth}>
                  <MenuIcon className="text-muted-foreground h-6 w-6" />
                </button>
              </ActionTooltip>
            )}
          </nav>
        )}
      </div>
    </>
  );
};
export default Navigation;
