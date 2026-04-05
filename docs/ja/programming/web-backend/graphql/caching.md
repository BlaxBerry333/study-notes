# キャッシュ

## なぜ GraphQL は自前でキャッシュを実装する必要があるのか

REST の各エンドポイントは独立した URL（`GET /api/users/1`）であり、ブラウザや CDN は URL ごとに自然とレスポンスをキャッシュする——追加の作業は一切不要である。

GraphQL のリクエストはすべて `POST /graphql` であり、URL は常に同じため、HTTP キャッシュの仕組みが完全に機能しない：

```txt
REST:
  GET /api/users/1    → ブラウザ/CDN が URL ごとにキャッシュ ✓
  GET /api/users/2    → 異なる URL、独立してキャッシュ ✓

GraphQL:
  POST /graphql       → ユーザー 1 を取得
  POST /graphql       → ユーザー 2 を取得
  POST /graphql       → 記事一覧を取得
  URL がすべて同じ、HTTP キャッシュでは区別不可 ✗
```

そのため GraphQL のキャッシュは**クライアント側**で実装する必要がある——Apollo Client、urql などのクライアントライブラリが管理を担う。

---

## キャッシュの仕組み

クライアントライブラリは GraphQL のレスポンスを受け取った後、そのまま捨てるのではなく保存しておく。次に同じクエリを発行する際、まずキャッシュに存在するか確認し、あればそのまま使い、リクエストを送らない。

ただし「どう保存するか」には 2 つのアプローチがある：

---

### アプローチ 1：丸ごと保存（ドキュメントキャッシュ）

urql のやり方である。「クエリ文 + 変数」をキーとし、レスポンス全体を値としてそのまま保存する。ブラウザキャッシュと同じ発想である：

```txt
キャッシュキー                              キャッシュ値
────────────────────────────────────   ──────────────────────────
query { user(id:"1") { name posts } } → { user: { name:"Alice", posts:[...] } }
query { user(id:"2") { name } }       → { user: { name:"Bob" } }
query { posts { title } }             → { posts: [{ title:"Hello" }, ...] }
```

シンプルで直感的だが、問題がある：Mutation でデータを変更した後、どのキャッシュを無効化すべきか？ urql のやり方は Mutation のレスポンスに含まれる `__typename` を確認し、レスポンスに `User` 型が含まれていれば、`User` をクエリしたことのあるキャッシュをすべて期限切れとマークし、次回アクセス時に再リクエストする。手動設定は不要だが、粒度は粗い（無関係なクエリまで再リクエストされる可能性がある）。

---

### アプローチ 2：分解して保存（正規化キャッシュ）

Apollo のやり方である。レスポンス全体を保存するのではなく、レスポンス内の各オブジェクトを**分解して個別に保存**し、`型名:id` をキーとする：

```txt
クエリ結果:                             Apollo キャッシュ内の保存:
{ user(id:"1") {                    ┌──────────────────────────────────┐
    id: "1"                         │ "User:1"  → { name:"Alice" }    │
    name: "Alice"          →        │ "Post:10" → { title:"Hello" }   │
    posts: [                        │ "Post:20" → { title:"World" }   │
      { id:"10", title:"Hello" }    └──────────────────────────────────┘
      { id:"20", title:"World" }    同一オブジェクトはサイト全体で 1 つだけ保存
    ]
  }
}
```

利点：どこかで `User:1` の name が更新されれば、`User:1` を参照している全コンポーネントが自動的に新しいデータを取得し、再リクエストは不要である。

代償：サーバーが返すデータに **`id` フィールドが含まれていなければならない**。そうでなければ Apollo はオブジェクトを識別できない。

---

### どう選ぶか

| | 丸ごと保存（urql） | 分解して保存（Apollo） |
| --- | --- | --- |
| 実装 | シンプル、すぐに使える | 複雑、データに `id` が必要 |
| 更新精度 | クエリ粒度での無効化 | オブジェクト単位の精密な更新 |
| 適合 | データ関係がシンプル、素早い統合 | データ関係が複雑、複数箇所で同一オブジェクトを参照 |

::: tip 大多数のプロジェクトでは Apollo を選ぶ。特に軽量さを求める場合を除く
:::

---

## 読み取り戦略（fetchPolicy）

`useQuery` がまずキャッシュを見るか、まずリクエストを送るかを制御する。**大多数の場合はデフォルトで十分**であり、特定の要件があるときに調整する：

| 戦略 | 動作 | いつ使うか |
| --- | --- | --- |
| `cache-first` | **デフォルト**。キャッシュがあればキャッシュを使い、なければリクエスト | 大多数のクエリ |
| `cache-and-network` | まずキャッシュを返し（ページにすぐ内容が表示される）、同時にバックグラウンドでリクエストして更新 | ページを開いたらすぐにデータを表示したいが、最新のデータも欲しい場合 |
| `network-only` | 常にリクエストし、結果をキャッシュに書き込む | フォーム送信後のリスト更新、データの鮮度が重要な場合 |
| `cache-only` | キャッシュのみ読み、リクエストしない | データが既にキャッシュにあると確定している場合（例：詳細ページから一覧ページに戻るとき） |
| `no-cache` | 常にリクエストし、結果をキャッシュに書き込まない | 一度きりのデータ、機密データ |

```ts
const { data } = useQuery(GET_USER, {
  fetchPolicy: "cache-and-network",
});
```

---

## Mutation 後のキャッシュ更新

これは GraphQL キャッシュで最もハマりやすいポイントである。問題は単純である：

```txt
1. ページ読み込み時にユーザー一覧をクエリ → [Alice, Bob] がキャッシュされる
2. ユーザーがフォームで Charlie を作成 → サーバー側にデータが 1 件追加される
3. しかしクライアントのキャッシュはまだ [Alice, Bob] → ページに変化なし
```

3 つの解決方法があり、シンプルな順に紹介する：

---

### refetchQueries（再リクエスト）

最もシンプル——Mutation 完了後に指定したクエリを再リクエストさせる：

```ts
const [createUser] = useMutation(CREATE_USER, {
  refetchQueries: [{ query: GET_USERS }],
});
```

ネットワークリクエストが 1 回増えるが、キャッシュを気にする必要がない。**大多数のシーンではこれで十分である**。

---

### update（キャッシュの手動更新）

追加リクエストなしで、新しいデータを直接キャッシュに書き込む：

```ts
const [createUser] = useMutation(CREATE_USER, {
  update(cache, { data: { createUser: newUser } }) {
    const existing = cache.readQuery({ query: GET_USERS });
    cache.writeQuery({
      query: GET_USERS,
      data: { users: [...existing.users, newUser] },
    });
  },
});
```

リクエスト回数を減らしたい場合や、パフォーマンスに敏感なシーンに適している。

---

### optimisticResponse（楽観的更新）

サーバーのレスポンスを待たず、まず成功を仮定して、**即座に**予期されるデータで UI を更新する。リクエスト成功後に実データで置き換え、失敗時は自動的にロールバックする：

```ts
const [toggleLike] = useMutation(TOGGLE_LIKE, {
  optimisticResponse: {
    toggleLike: {
      __typename: "Post",
      id: postId,
      liked: !currentLiked,
      likeCount: currentLiked ? count - 1 : count + 1,
    },
  },
});
```

ユーザーが即時フィードバックを期待する操作（いいね、お気に入り、ドラッグ＆ドロップでの並べ替え）に適している。

---

### 比較

| 方式 | 追加リクエスト | 複雑さ | 適用シーン |
| --- | --- | --- | --- |
| `refetchQueries` | あり | 低 | **大多数のシーン**、まずこれを使う |
| `update` | なし | 中 | リストの追加削除、リクエスト削減 |
| `optimisticResponse` | なし | 高 | いいね、お気に入り等の即時フィードバック |

---

## 手動キャッシュ操作

::: tip 通常これらの API を使う必要はない

上記の fetchPolicy + refetchQueries で 90% のシーンをカバーできる。手動操作が必要なのは以下の場合のみである：

- ユーザーログアウト後にキャッシュ内の個人データを消去する
- 削除操作後にキャッシュからオブジェクトを除去する
- Mutation の `update` コールバック内でキャッシュを読み書きする（上記で既に示した）
:::

```ts
import { useApolloClient } from "@apollo/client";

function SomeComponent() {
  const client = useApolloClient();

  // キャッシュの読み取り
  const data = client.readQuery({ query: GET_USERS });

  // キャッシュへの書き込み
  client.writeQuery({
    query: GET_USERS,
    data: { users: [...data.users, newUser] },
  });

  // 特定オブジェクトの削除（例：ユーザーログアウト後の個人データ消去）
  client.cache.evict({ id: "User:1" });
  client.cache.gc(); // 参照のないオブジェクトをガベージコレクション
}
```
