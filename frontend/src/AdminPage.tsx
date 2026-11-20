import { useContext, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Table,
  Tabs,
  Tag,
  message,
} from "antd";
import type {
  AdminOverview,
  AuditLog,
  Exercise,
  ExerciseCode,
  HistoryItem,
  Page,
  User,
} from "../../shared/contracts";
import { errorText, get, write } from "./api";
import { Auth, ErrorState, Loading, PageTitle } from "./shared";
import { HistoryTable } from "./HistoryTable";

export function AdminPage() {
  const { user } = useContext(Auth);
  const [tab, setTab] = useState("users");
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return (
    <div className="page">
      <PageTitle
        eyebrow="QUẢN TRỊ"
        title="Không gian quản lý"
        description="Theo dõi hoạt động và quản lý nội dung luyện tập."
      />
      <AdminStats />
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: "users", label: "Thành viên", children: <UsersAdmin /> },
          { key: "exercises", label: "Bài tập", children: <ExercisesAdmin /> },
          { key: "audit", label: "Nhật ký", children: <AuditAdmin /> },
        ]}
      />
    </div>
  );
}
function AdminStats() {
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => get<AdminOverview>("/admin/overview"),
  });
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <div className="stats-strip admin-stats">
      {[
        ["Thành viên", q.data?.usersCount],
        ["Đang hoạt động", q.data?.activeUsers],
        ["Bài đã hoàn thành", q.data?.completedSessions],
        ["Ngày hoàn thành", q.data?.completedDays],
      ].map(([label, value]) => (
        <div key={String(label)}>
          <span>{label}</span>
          <strong>{value ?? "—"}</strong>
        </div>
      ))}
    </div>
  );
}
function UsersAdmin() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const q = useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: () =>
      get<Page<User>>(
        `/admin/users?page=${page}&search=${encodeURIComponent(search)}`,
      ),
  });
  const qc = useQueryClient();
  async function change(user: User, body: Partial<User>) {
    try {
      await write("patch", `/admin/users/${user.id}`, body);
      message.success("Đã cập nhật thành viên");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      message.error(errorText(e));
    }
  }
  return (
    <>
      <div className="admin-toolbar">
        <Input.Search
          placeholder="Tìm theo tên hoặc email"
          allowClear
          onSearch={(v) => {
            setPage(1);
            setSearch(v);
          }}
          style={{ maxWidth: 320 }}
        />
      </div>
      {q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <Table<User>
          rowKey="id"
          loading={q.isLoading}
          dataSource={q.data?.items}
          scroll={{ x: 800 }}
          pagination={{
            current: page,
            total: q.data?.total,
            pageSize: q.data?.pageSize || 20,
            onChange: setPage,
            showSizeChanger: false,
          }}
          columns={[
            {
              title: "Thành viên",
              render: (_, u) => (
                <>
                  <strong>{u.name}</strong>
                  <div className="muted">{u.email}</div>
                </>
              ),
            },
            {
              title: "Vai trò",
              render: (_, u) =>
                u.role === "ADMIN" ? "Quản trị viên" : "Thành viên",
            },
            {
              title: "Trạng thái",
              render: (_, u) => (
                <Tag color={u.status === "ACTIVE" ? "green" : "default"}>
                  {u.status === "ACTIVE" ? "Hoạt động" : "Đã khóa"}
                </Tag>
              ),
            },
            {
              title: "Thao tác",
              render: (_, u) => (
                <div className="row-actions">
                  <Button size="small" onClick={() => setSelected(u)}>
                    Lịch sử
                  </Button>
                  <Popconfirm
                    title={
                      u.status === "ACTIVE"
                        ? "Khóa thành viên này?"
                        : "Mở khóa thành viên này?"
                    }
                    description="Thay đổi này ảnh hưởng đến quyền đăng nhập."
                    okText="Xác nhận"
                    cancelText="Hủy"
                    onConfirm={() =>
                      void change(u, {
                        status: u.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                      })
                    }
                  >
                    <Button size="small">
                      {u.status === "ACTIVE" ? "Khóa" : "Mở khóa"}
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title={
                      u.role === "ADMIN"
                        ? "Gỡ quyền quản trị?"
                        : "Cấp quyền quản trị?"
                    }
                    description="Quyền quản trị cho phép quản lý toàn bộ hệ thống."
                    okText="Xác nhận"
                    cancelText="Hủy"
                    onConfirm={() =>
                      void change(u, {
                        role: u.role === "ADMIN" ? "USER" : "ADMIN",
                      })
                    }
                  >
                    <Button size="small">
                      {u.role === "ADMIN" ? "Gỡ quyền" : "Cấp quyền"}
                    </Button>
                  </Popconfirm>
                </div>
              ),
            },
          ]}
        />
      )}
      <Modal
        title={`Lịch sử: ${selected?.name || ""}`}
        open={!!selected}
        footer={null}
        onCancel={() => setSelected(null)}
        width={800}
      >
        {selected && <UserHistory id={selected.id} />}
      </Modal>
    </>
  );
}
function UserHistory({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["user-history", id, page],
    queryFn: () =>
      get<Page<HistoryItem>>(`/admin/users/${id}/sessions?page=${page}`),
  });
  if (q.isLoading) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      <HistoryTable items={q.data?.items || []} admin />
      <div className="pagination">
        <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Trước
        </Button>
        <span>Trang {page}</span>
        <Button
          disabled={page * (q.data?.pageSize || 20) >= (q.data?.total || 0)}
          onClick={() => setPage(page + 1)}
        >
          Sau
        </Button>
      </div>
    </>
  );
}
function ExercisesAdmin() {
  const q = useQuery({
    queryKey: ["admin-exercises"],
    queryFn: () => get<Exercise[]>("/admin/exercises"),
  });
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Exercise | null>(null);
  async function update(code: ExerciseCode, body: Partial<Exercise>) {
    try {
      await write("patch", `/admin/exercises/${code}`, body);
      setEditing(null);
      message.success("Đã cập nhật bài tập");
      void qc.invalidateQueries({ queryKey: ["admin-exercises"] });
      void qc.invalidateQueries({ queryKey: ["exercises"] });
    } catch (e) {
      message.error(errorText(e));
    }
  }
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      <Table<Exercise>
        rowKey="code"
        loading={q.isLoading}
        dataSource={q.data}
        pagination={false}
        columns={[
          { title: "Bài tập", dataIndex: "name" },
          { title: "Mô tả", dataIndex: "description" },
          {
            title: "Trạng thái",
            render: (_, e) => (e.enabled ? "Đang mở" : "Tạm đóng"),
          },
          {
            title: "Thao tác",
            render: (_, e) => (
              <div className="row-actions">
                <Button size="small" onClick={() => setEditing(e)}>
                  Chỉnh sửa
                </Button>
                <Popconfirm
                  title={e.enabled ? "Tạm đóng bài tập?" : "Mở lại bài tập?"}
                  okText="Xác nhận"
                  cancelText="Hủy"
                  onConfirm={() => void update(e.code, { enabled: !e.enabled })}
                >
                  <Button size="small">
                    {e.enabled ? "Tạm đóng" : "Mở lại"}
                  </Button>
                </Popconfirm>
              </div>
            ),
          },
        ]}
      />
      <Modal
        title="Chỉnh sửa bài tập"
        open={!!editing}
        footer={null}
        onCancel={() => setEditing(null)}
        destroyOnHidden
      >
        {editing && (
          <Form
            layout="vertical"
            initialValues={editing}
            onFinish={(values) => void update(editing.code, values)}
          >
            <Form.Item
              name="name"
              label="Tên bài tập"
              rules={[{ required: true, message: "Vui lòng nhập tên" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="description"
              label="Mô tả"
              rules={[{ required: true, message: "Vui lòng nhập mô tả" }]}
            >
              <Input.TextArea rows={4} />
            </Form.Item>
            <Button htmlType="submit" type="primary">
              Lưu thay đổi
            </Button>
          </Form>
        )}
      </Modal>
    </>
  );
}
function AuditAdmin() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["audit", page],
    queryFn: () => get<Page<AuditLog>>(`/admin/audit-logs?page=${page}`),
  });
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <Table<AuditLog>
      rowKey="id"
      loading={q.isLoading}
      dataSource={q.data?.items}
      scroll={{ x: 800 }}
      pagination={{
        current: page,
        total: q.data?.total,
        pageSize: q.data?.pageSize || 20,
        onChange: setPage,
        showSizeChanger: false,
      }}
      columns={[
        {
          title: "Thời gian",
          render: (_, a) => new Date(a.createdAt).toLocaleString("vi-VN"),
        },
        { title: "Người thực hiện", dataIndex: "actorEmail" },
        { title: "Thao tác", dataIndex: "action" },
        { title: "Đối tượng", dataIndex: "targetId" },
        { title: "Chi tiết", dataIndex: "detail" },
      ]}
    />
  );
}
