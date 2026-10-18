import { initEdgeStore } from "@edgestore/server";
import { createEdgeStoreNextHandler } from "@edgestore/server/adapters/next/app";
import { createClient } from "@/lib/supabase/server";

const es = initEdgeStore.create();

const requireUser = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }
};

const edgeStoreRouter = es.router({
  publicFiles: es
    .fileBucket()
    .beforeUpload(async () => {
      await requireUser();
      return true;
    })
    .beforeDelete(async () => {
      await requireUser();
      return true;
    }),
});

const handler = createEdgeStoreNextHandler({
  router: edgeStoreRouter,
});

export { handler as GET, handler as POST };

export type EdgeStoreRouter = typeof edgeStoreRouter;
