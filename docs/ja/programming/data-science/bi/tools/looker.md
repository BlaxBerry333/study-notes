# Looker

> Google Cloud のエンタープライズ BI プラットフォーム

## コア概念

### LookML

Looker のモデリング言語。データモデルを定義するために使用する。

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

LookML モデルに基づくインタラクティブなデータ探索画面。

- ディメンションとメジャーを選択
- フィルタ条件を追加
- 結果を可視化
- Look またはダッシュボードとして保存

---

## 主な特徴

| 特徴 | 説明 |
| ---------- | ----------------------- |
| セマンティックレイヤー | LookML でビジネスロジックを統一定義 |
| Git 統合 | バージョン管理、コードレビュー |
| 組み込み分析 | プロダクトへの埋め込み |
| API | 完全な REST API |
| スケジューリング | レポートの定期配信 |

---

## メリット・デメリット

::: tip メリット

- 強力なセマンティックレイヤーにより指標の一貫性を確保
- BigQuery との深い統合
- エンタープライズ級の権限管理
:::

::: warning デメリット

- 学習コストが高い（LookML）
- 価格が高い
- モデリングに開発者の関与が必要
:::
