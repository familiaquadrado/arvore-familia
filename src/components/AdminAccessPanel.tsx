import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type UserRole = "admin" | "editor" | "viewer";

type UserRoleRow = {
  user_id: string;
  email: string | null;
  role: UserRole;
  approved: boolean;
  created_at?: string;
};

type AdminAccessPanelProps = {
  currentUserId: string;
};

export default function AdminAccessPanel({ currentUserId }: AdminAccessPanelProps) {
  const [rows, setRows] = useState<UserRoleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadRows() {
      setIsLoading(true);
      setStatusMessage("");

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("user_id, email, role, approved, created_at")
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (!active) return;

        setRows((data as UserRoleRow[] | null) || []);
      } catch (error: any) {
        if (!active) return;
        setStatusMessage(error?.message || "Não foi possível carregar os acessos.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadRows();

    return () => {
      active = false;
    };
  }, []);

  function updateRow(userId: string, patch: Partial<UserRoleRow>) {
    setRows((current) =>
      current.map((row) => (row.user_id === userId ? { ...row, ...patch } : row)),
    );
  }

  async function saveRow(row: UserRoleRow) {
    setStatusMessage("");

    try {
      const { error } = await supabase
        .from("user_roles")
        .update({
          email: row.email,
          role: row.role,
          approved: row.approved,
        })
        .eq("user_id", row.user_id);

      if (error) throw error;

      setStatusMessage(`Acesso atualizado para ${row.email || row.user_id}.`);
    } catch (error: any) {
      setStatusMessage(error?.message || "Não foi possível guardar a alteração.");
    }
  }

  if (isLoading) {
    return (
      <div
        style={{
          background: "white",
          border: "1px solid #e7e5e4",
          borderRadius: 24,
          padding: 24,
        }}
      >
        A carregar acessos…
      </div>
    );
  }

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e7e5e4",
        borderRadius: 24,
        padding: 24,
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.18em",
          color: "#92400e",
          marginBottom: 10,
        }}
      >
        Administração
      </div>

      <h2 style={{ marginTop: 0 }}>Acessos e permissões</h2>

      <p style={{ color: "#57534e", marginTop: 0 }}>
        Aqui podes aprovar utilizadores e definir se cada pessoa pode apenas ver ou também editar.
      </p>

      {statusMessage ? (
        <div
          style={{
            marginBottom: 16,
            color: "#57534e",
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 14 }}>
        {rows.length ? (
          rows.map((row) => {
            const isCurrentUser = row.user_id === currentUserId;

            return (
              <div
                key={row.user_id}
                style={{
                  border: "1px solid #e7e5e4",
                  background: "#fafaf9",
                  borderRadius: 18,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: "#78716c", marginBottom: 4 }}>
                      Email
                    </div>
                    <div style={{ fontWeight: 600, color: "#292524" }}>
                      {row.email || "Sem email"}
                      {isCurrentUser ? " (tu)" : ""}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, color: "#78716c", marginBottom: 4 }}>
                        Permissão
                      </div>

                      <select
                        value={row.role}
                        onChange={(e) =>
                          updateRow(row.user_id, {
                            role: e.target.value as UserRole,
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #d6d3d1",
                          background: "white",
                        }}
                      >
                        <option value="viewer">viewer</option>
                        <option value="editor">editor</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 20,
                        color: "#292524",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={row.approved}
                        onChange={(e) =>
                          updateRow(row.user_id, {
                            approved: e.target.checked,
                          })
                        }
                      />
                      Aprovado
                    </label>

                    <button
                      onClick={() => saveRow(row)}
                      style={{
                        marginTop: 20,
                        border: "1px solid #d6d3d1",
                        background: "white",
                        borderRadius: 12,
                        padding: "10px 14px",
                        cursor: "pointer",
                      }}
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div
            style={{
              border: "1px dashed #d6d3d1",
              background: "#fafaf9",
              borderRadius: 20,
              padding: 16,
              color: "#78716c",
            }}
          >
            Ainda não existem utilizadores na tabela de acessos.
          </div>
        )}
      </div>
    </div>
  );
}