import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "antd";
import type { HistoryItem, Page } from "../../shared/contracts";
import { get } from "./api";
import { ErrorState, Loading, PageTitle } from "./shared";
import { HistoryTable } from "./HistoryTable";

export function HistoryPage() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["history", page],
    queryFn: () => get<Page<HistoryItem>>(`/progress/history?page=${page}`),
  });
  return (
    <div className="page">
      <PageTitle
        eyebrow="HÀNH TRÌNH CỦA BẠN"
        title="Lịch sử luyện tập"
        description="Mỗi lần luyện tập đều là một bước tiến."
      />
      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <HistoryTable items={q.data?.items || []} />
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
      )}
    </div>
  );
}
