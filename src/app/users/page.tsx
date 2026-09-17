import { query } from "@/lib/db";
import { createUser, setUserRole, setUserActive } from "@/app/actions/users";
import { PageHeader, Card, Button } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const roleLabel: Record<string, string> = { admin: "مدير", technician: "فني", reception: "استقبال" };

export default async function UsersPage() {
  const users = await query<any>(
    `select id, username, full_name, role, is_active from app_users order by created_at`
  );

  return (
    <div className="max-w-3xl">
      <PageHeader title="المستخدمون" subtitle="إدارة حسابات الكادر وأدوارهم (للمدير)" />

      <Card className="mb-4">
        <div className="mb-3 text-sm font-semibold">إضافة مستخدم</div>
        <form action={createUser} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input name="full_name" placeholder="الاسم" required className={field} />
          <input name="username" placeholder="اسم المستخدم" required className={field} />
          <input name="password" type="password" placeholder="كلمة المرور" required className={field} />
          <select name="role" className={field} defaultValue="technician">
            <option value="technician">فني</option>
            <option value="reception">استقبال</option>
            <option value="admin">مدير</option>
          </select>
          <div className="lg:col-span-4"><Button>إضافة</Button></div>
        </form>
      </Card>

      <Card className="p-0 data-table">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-right text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">المستخدم</th>
              <th className="px-4 py-3 font-medium">الدور</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{u.full_name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{u.username}</td>
                <td className="px-4 py-3">
                  <form action={setUserRole} className="flex items-center gap-1">
                    <input type="hidden" name="user_id" value={u.id} />
                    <select name="role" defaultValue={u.role} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs">
                      {Object.entries(roleLabel).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                    <button className="rounded-lg bg-brand-light px-2 py-1 text-xs font-semibold text-brand-dark">حفظ</button>
                  </form>
                </td>
                <td className="px-4 py-3">
                  <form action={setUserActive}>
                    <input type="hidden" name="user_id" value={u.id} />
                    <input type="hidden" name="active" value={u.is_active ? "0" : "1"} />
                    <button className={`rounded-full px-2 py-0.5 text-xs ${u.is_active ? "bg-teal-50 text-brand-dark" : "bg-gray-100 text-gray-500"}`}>
                      {u.is_active ? "نشط" : "معطّل"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
