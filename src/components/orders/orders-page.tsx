"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/ui/pagination";
import { 
  DropdownMenu, 
  DropdownMenuCheckboxItem,
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  CalendarDays, 
  CreditCard, 
  Package, 
  MoreHorizontal,
  Eye,
  Trash2,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { zhCN, enUS, ja } from "date-fns/locale";
import type { Order } from "@/lib/db/schema/orders";
import { OrderDetails } from "./order-details";

interface OrdersPageProps {
  dict: {
    title: string;
    subtitle: string;
    description: string;
    ordersList: {
      title: string;
      subtitle: string;
      noOrders: string;
      loading: string;
      error: string;
      retry: string;
    };
    orderCard: {
      orderNumber: string;
      status: string;
      amount: string;
      product: string;
      createdAt: string;
      paidAt: string;
      actions: string;
      viewDetails: string;
      refreshStatus: string;
    };
    status: {
      pending: string;
      paid: string;
      failed: string;
      cancelled: string;
      refunded: string;
    };
    filters: {
      title: string;
      all: string;
      pending: string;
      paid: string;
      failed: string;
      cancelled: string;
      refunded: string;
    };
    search: {
      placeholder: string;
    };
    refresh: string;
    pagination: {
      previous: string;
      next: string;
      showing: string;
      of: string;
      results: string;
    };
    orderDetails: {
      title: string;
      subtitle: string;
      orderInfo: {
        orderNumber: string;
        status: string;
        createdAt: string;
        paidAt: string;
        cancelledAt: string;
        amount: string;
        currency: string;
        paymentProvider: string;
        customerEmail: string;
      };
      productInfo: {
        title: string;
        productName: string;
        productType: string;
        productId: string;
      };
      paymentInfo: {
        title: string;
        provider: string;
        requestId: string;
        sessionId: string;
      };
      customerInfo: {
        title: string;
        email: string;
      };
      orderItems: {
        title: string;
        productName: string;
        description: string;
        unitPrice: string;
        quantity: string;
        totalPrice: string;
      };
      actions: {
        back: string;
        refreshStatus: string;
      };
      status: {
        pending: string;
        paid: string;
        failed: string;
        cancelled: string;
        refunded: string;
      };
      loading: string;
      error: string;
      retry: string;
      notFound: string;
    };
  };
  locale: string;
}

export function OrdersPage({ dict, locale }: OrdersPageProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

  const itemsPerPage = 10;

  const deleteLabelByLocale: Record<string, string> = {
    en: "Delete",
    zh: "删除",
    ja: "削除",
    es: "Eliminar",
    ar: "حذف",
    id: "Hapus",
    pt: "Excluir",
    fr: "Supprimer",
    ru: "Удалить",
    de: "Löschen",
  };
  const deleteConfirmByLocale: Record<string, string> = {
    en: "Delete this order from your list?",
    zh: "删除这条订单记录（从列表隐藏）？",
    ja: "この注文をリストから削除しますか？",
    es: "¿Eliminar este pedido de tu lista?",
    ar: "هل تريد حذف هذا الطلب من قائمتك؟",
    id: "Hapus pesanan ini dari daftar Anda?",
    pt: "Excluir este pedido da sua lista?",
    fr: "Supprimer cette commande de votre liste ?",
    ru: "Удалить этот заказ из списка?",
    de: "Diese Bestellung aus deiner Liste löschen?",
  };
  const deleteLabel = deleteLabelByLocale[locale] ?? deleteLabelByLocale.en ?? "Delete";
  const deleteConfirm = deleteConfirmByLocale[locale] ?? deleteConfirmByLocale.en ?? "Delete this order?";

  // 获取订单列表
  const fetchOrders = useCallback(async (page = 1, statuses = statusFilters, search = searchTerm) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        limit: itemsPerPage.toString(),
        offset: ((page - 1) * itemsPerPage).toString(),
      });

      if (statuses.length > 0) {
        params.append("status", statuses.join(","));
      }

      if (search) {
        params.append("search", search);
      }

      const response = await fetch(`/api/orders?${params}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "获取订单失败");
      }

      setOrders(data.data.orders || []);
      const total = Number(data.data.pagination?.total || 0);
      setTotalOrders(total);
      setTotalPages(Math.max(1, Math.ceil(total / itemsPerPage)));
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取订单失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilters, searchTerm, itemsPerPage]);

  // 刷新订单状态
  const refreshOrderStatus = async (orderId: string) => {
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, refresh: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "刷新订单状态失败");
      }

      // Sync can create new orders (e.g. upgrade proration). Refresh the list to show them.
      await fetchOrders(currentPage);
    } catch (err) {
      console.error("刷新订单状态失败:", err);
    }
  };

  // 查看订单详情
  const viewOrderDetails = (orderId: string) => {
    setSelectedOrderId(orderId);
  };

  const deleteOrder = async (orderId: string) => {
    if (deletingOrderId) return;
    if (!window.confirm(deleteConfirm)) return;

    try {
      setDeletingOrderId(orderId);
      const response = await fetch("/api/orders", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Delete failed");
      }

      await fetchOrders(currentPage);
    } catch (err) {
      console.error("删除订单失败:", err);
      window.alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingOrderId(null);
    }
  };

  // 返回订单列表
  const backToOrders = () => {
    setSelectedOrderId(null);
  };

  const handleStatusFiltersChange = (next: string[]) => {
    const normalized = Array.from(new Set(next)).filter(Boolean).sort();
    setStatusFilters(normalized);
    setCurrentPage(1);
    fetchOrders(1, normalized, searchTerm);
  };

  // 处理搜索
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    fetchOrders(1, statusFilters, term);
  };

  // 处理刷新
  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders(currentPage, statusFilters, searchTerm);
  };

  // 获取状态标签样式
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "failed":
        return "destructive";
      case "cancelled":
        return "outline";
      case "refunded":
        return "secondary";
      default:
        return "secondary";
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return dict.status.pending;
      case "paid":
        return dict.status.paid;
      case "failed":
        return dict.status.failed;
      case "cancelled":
        return dict.status.cancelled;
      case "refunded":
        return dict.status.refunded;
      default:
        return status;
    }
  };

  // 格式化日期
  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const dateLocale = navigator.language.startsWith("zh") ? zhCN : 
                  navigator.language.startsWith("ja") ? ja : enUS;
    
    return format(dateObj, "yyyy-MM-dd HH:mm", { locale: dateLocale });
  };

  // 格式化金额
  const formatAmount = (amount: string, currency: string) => {
    const numAmount = parseFloat(amount);
    return new Intl.NumberFormat(navigator.language, {
      style: "currency",
      currency: currency || "USD",
    }).format(numAmount);
  };

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const statusLabelSeparator = locale === "zh" || locale === "ja" ? "、" : ", ";
  const selectedStatusLabel =
    statusFilters.length === 0
      ? dict.filters.all
      : statusFilters.map((s) => getStatusText(s)).join(statusLabelSeparator);

  const paginationFrom = totalOrders === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const paginationTo = totalOrders === 0 ? 0 : Math.min((currentPage - 1) * itemsPerPage + orders.length, totalOrders);

  const paginationItems = (() => {
    if (totalPages <= 1) return [];
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    pages.add(currentPage);
    pages.add(currentPage - 1);
    pages.add(currentPage + 1);
    const sorted = Array.from(pages).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
    const items: Array<number | "ellipsis"> = [];
    let prev = 0;
    for (const p of sorted) {
      if (prev && p - prev > 1) items.push("ellipsis");
      items.push(p);
      prev = p;
    }
    return items;
  })();

  // 如果选择了订单，显示详情页面
  if (selectedOrderId) {
    // 需要通过 locale 获取完整的订单详情翻译
    // 这里简化处理，直接传递一个对象
    return (
      <OrderDetails
        orderId={selectedOrderId}
        locale={locale}
        dict={dict.orderDetails}
        onBack={backToOrders}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{dict.title}</h1>
        <p className="text-muted-foreground mt-2">{dict.subtitle}</p>
      </div>

      {/* 订单列表 */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {dict.ordersList.title}
              </CardTitle>
              {dict.ordersList.subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{dict.ordersList.subtitle}</p>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={dict.search.placeholder}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="justify-between sm:min-w-[220px]">
                    {selectedStatusLabel}
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleStatusFiltersChange([])}>
                    {dict.filters.all}
                  </DropdownMenuItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilters.includes("pending")}
                    onCheckedChange={() => {
                      const has = statusFilters.includes("pending");
                      handleStatusFiltersChange(
                        has ? statusFilters.filter((s) => s !== "pending") : [...statusFilters, "pending"],
                      );
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {dict.filters.pending}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilters.includes("paid")}
                    onCheckedChange={() => {
                      const has = statusFilters.includes("paid");
                      handleStatusFiltersChange(has ? statusFilters.filter((s) => s !== "paid") : [...statusFilters, "paid"]);
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {dict.filters.paid}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilters.includes("cancelled")}
                    onCheckedChange={() => {
                      const has = statusFilters.includes("cancelled");
                      handleStatusFiltersChange(
                        has ? statusFilters.filter((s) => s !== "cancelled") : [...statusFilters, "cancelled"],
                      );
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {dict.filters.cancelled}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilters.includes("failed")}
                    onCheckedChange={() => {
                      const has = statusFilters.includes("failed");
                      handleStatusFiltersChange(has ? statusFilters.filter((s) => s !== "failed") : [...statusFilters, "failed"]);
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {dict.filters.failed}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilters.includes("refunded")}
                    onCheckedChange={() => {
                      const has = statusFilters.includes("refunded");
                      handleStatusFiltersChange(
                        has ? statusFilters.filter((s) => s !== "refunded") : [...statusFilters, "refunded"],
                      );
                    }}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {dict.filters.refunded}
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
                className="shrink-0"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                {dict.refresh || "刷新"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 订单列表 */}
      <Card>
        <CardHeader>
          <CardTitle>{dict.ordersList.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4 py-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Skeleton className="h-5 w-40" />
                          <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-4 w-56" />
                        </div>
                      </div>
                      <Skeleton className="h-8 w-10 rounded-md" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-destructive mb-4">{dict.ordersList.error}</p>
              <Button onClick={() => fetchOrders()}>
                {dict.ordersList.retry}
              </Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{dict.ordersList.noOrders}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{order.orderNumber}</h3>
                          <Badge
                            variant={getStatusBadgeVariant(order.status)}
                            className={
                              order.status === "paid"
                                ? "bg-cyan-500 text-white hover:bg-cyan-600 dark:bg-cyan-400 dark:text-neutral-950 dark:hover:bg-cyan-300"
                                : undefined
                            }
                          >
                            {getStatusText(order.status)}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            <span>{formatAmount(order.amount, order.currency)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4" />
                            <span>{order.productName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            <span>
                              {order.status === "paid" && order.paidAt
                                ? `${dict.orderCard.paidAt}: ${formatDate(order.paidAt)}`
                                : `${dict.orderCard.createdAt}: ${formatDate(order.createdAt)}`
                              }
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex w-40 flex-col items-stretch gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => viewOrderDetails(order.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {dict.orderCard.viewDetails}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => refreshOrderStatus(order.id)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          {dict.orderCard.refreshStatus}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="w-full justify-start"
                          disabled={deletingOrderId === order.id}
                          onClick={() => deleteOrder(order.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {deleteLabel}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 分页 */}
          {!loading && !error && totalOrders > 0 && (
            <>
              <Separator className="my-6" />
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {dict.pagination.showing} {paginationFrom} - {paginationTo} {dict.pagination.of} {totalOrders} {dict.pagination.results}
                </p>
                {totalPages > 1 ? (
                  <Pagination className="mx-0 justify-end">
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          size="default"
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "gap-1 px-2.5 sm:pl-2.5"}
                          aria-label={dict.pagination.previous}
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage === 1) return;
                            fetchOrders(currentPage - 1);
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          <span className="hidden sm:block">{dict.pagination.previous}</span>
                        </PaginationLink>
                      </PaginationItem>

                      {paginationItems.map((item, idx) => (
                        <PaginationItem key={`orders-page-${idx}-${item}`}>
                          {item === "ellipsis" ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              href="#"
                              isActive={item === currentPage}
                              onClick={(e) => {
                                e.preventDefault();
                                if (item === currentPage) return;
                                fetchOrders(item);
                              }}
                            >
                              {item}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          size="default"
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "gap-1 px-2.5 sm:pr-2.5"}
                          aria-label={dict.pagination.next}
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage === totalPages) return;
                            fetchOrders(currentPage + 1);
                          }}
                        >
                          <span className="hidden sm:block">{dict.pagination.next}</span>
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </PaginationLink>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
