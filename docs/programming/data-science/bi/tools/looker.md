# Looker

> Google Cloud 的企业级 BI 平台

## 核心概念

### LookML

Looker 的建模语言，用于定义数据模型。

```lookml
view: orders {
  sql_table_name: public.orders ;;

  dimension: id {
    primary_key: yes
    type: number
    sql: ${TABLE}.id ;;
  }

  dimension: status {
    type: string
    sql: ${TABLE}.status ;;
  }

  dimension_group: created {
    type: time
    timeframes: [date, week, month, year]
    sql: ${TABLE}.created_at ;;
  }

  measure: count {
    type: count
  }

  measure: total_amount {
    type: sum
    sql: ${TABLE}.amount ;;
  }
}
```

---

### Explore

基于 LookML 模型的交互式数据探索界面。

- 选择维度和度量
- 添加筛选条件
- 可视化结果
- 保存为 Look 或仪表盘

---

## 关键特性

| 特性       | 说明                    |
| ---------- | ----------------------- |
| 语义层     | LookML 统一定义业务逻辑 |
| Git 集成   | 版本控制、代码审查      |
| 嵌入式分析 | 嵌入到产品中            |
| API        | 完整的 REST API         |
| 调度       | 定时发送报表            |

---

## 优缺点

::: tip 优点

- 强大的语义层，确保指标一致性
- 与 BigQuery 深度集成
- 企业级权限管理
:::

::: warning 缺点

- 学习曲线陡峭（LookML）
- 价格较高
- 需要开发者参与建模
:::
