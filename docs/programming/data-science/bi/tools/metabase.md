# Metabase

> 开源、轻量级的 BI 工具

## 快速开始

::: code-group

```bash [Docker]
docker run -d -p 3000:3000 --name metabase metabase/metabase
```

:::

访问 `http://localhost:3000` 即可使用。

---

## 核心功能

### 问题 (Questions)

两种创建方式：

| 方式   | 说明             | 适用人群    |
| ------ | ---------------- | ----------- |
| Simple | 点选式，无需 SQL | 业务人员    |
| Native | 原生 SQL 查询    | 开发/分析师 |

---

### 仪表盘 (Dashboard)

将多个问题组合成仪表盘：

- 拖拽布局
- 筛选器联动
- 自动刷新
- 全屏展示

---

### 模型 (Models)

定义可复用的数据模型：

```sql
-- 定义订单汇总模型
SELECT
  customer_id,
  COUNT(*) as order_count,
  SUM(amount) as total_amount,
  MAX(created_at) as last_order_date
FROM orders
GROUP BY customer_id
```

---

## 部署架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Metabase   │────▶│  App DB     │     │  Data DB    │
│  (Java)     │     │  (H2/PG)    │     │  (业务数据) │
└─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                    存储配置/问题          查询数据
```

::: warning 生产环境
默认使用 H2 数据库存储配置，生产环境应切换到 PostgreSQL。
:::

---

## 优缺点

::: tip 优点

- 开源免费（社区版）
- 5 分钟即可上手
- 支持 20+ 数据源
- 嵌入式分析支持
  :::

::: warning 缺点

- 复杂建模能力有限
- 大数据量性能一般
- 高级功能需付费版
  :::
