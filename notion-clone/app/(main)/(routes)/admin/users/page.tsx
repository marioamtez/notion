import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_EMAILS } from "@/lib/adminEmails";

const AdminUsersPage = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    redirect("/documents");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <h1 className="mb-4 text-2xl font-semibold">Usuarios</h1>
        <p className="text-destructive">
          Error al cargar los usuarios: {error.message}
        </p>
      </div>
    );
  }

  const users = [...data.users].sort((a, b) =>
    (a.email ?? "").localeCompare(b.email ?? ""),
  );

  const formatDate = (value: string | undefined) =>
    value
      ? new Date(value).toLocaleString("es-ES", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-semibold">Usuarios</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        {users.length} usuario{users.length === 1 ? "" : "s"} con acceso a
        Mbrand AI / Zotion.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Creado</th>
              <th className="py-2 pr-4 font-medium">Último acceso</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{u.email}</td>
                <td className="text-muted-foreground py-2 pr-4">
                  {formatDate(u.created_at)}
                </td>
                <td className="text-muted-foreground py-2 pr-4">
                  {formatDate(u.last_sign_in_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPage;
