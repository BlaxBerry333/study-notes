# gqlgen（Go）

> Go 言語の Schema-First GraphQL フレームワーク。型安全な Resolver シグネチャを自動生成する

## ダウンロードとインストール

```zsh
% go get -tool github.com/99designs/gqlgen
```

---

## プロジェクト初期化

```zsh
% mkdir my-graphql-server && cd my-graphql-server
% go mod init my-graphql-server
% go tool gqlgen init
```

生成されるディレクトリ構造：

```txt
my-graphql-server/
├── gqlgen.yml              # gqlgen 設定
├── server.go               # HTTP エントリポイント
└── graph/
    ├── schema.graphqls     # GraphQL Schema 定義
    ├── schema.resolvers.go # Resolver 実装（ビジネスロジックを書く場所）
    ├── resolver.go         # Resolver ルート構造体
    ├── generated/          # 自動生成されたランタイムコード（手動で変更しないこと）
    └── model/              # 自動生成された Go 型
```

---

## 基本フロー

gqlgen は **Schema-First** である：Schema を記述 → コードを生成 → Resolver を実装

---

### 1. Schema を定義

```graphql
# graph/schema.graphqls

type User {
  id: ID!
  name: String!
  email: String!
}

type Query {
  users: [User!]!
  user(id: ID!): User
}

input CreateUserInput {
  name: String!
  email: String!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}
```

---

### 2. コードを生成

```zsh
% go tool gqlgen generate
```

Resolver シグネチャと Go 型が自動生成される。あとは `schema.resolvers.go` 内のメソッド本体を実装するだけである

---

### 3. Resolver を実装

```go
// graph/schema.resolvers.go
package graph

import (
	"context"
	"fmt"
	"my-graphql-server/graph/model"
)

var users = []*model.User{
	{ID: "1", Name: "Alice", Email: "alice@example.com"},
	{ID: "2", Name: "Bob", Email: "bob@example.com"},
}

func (r *queryResolver) Users(ctx context.Context) ([]*model.User, error) {
	return users, nil
}

func (r *queryResolver) User(ctx context.Context, id string) (*model.User, error) {
	for _, u := range users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, nil
}

func (r *mutationResolver) CreateUser(ctx context.Context, input model.CreateUserInput) (*model.User, error) {
	user := &model.User{
		ID:    fmt.Sprintf("%d", len(users)+1),
		Name:  input.Name,
		Email: input.Email,
	}
	users = append(users, user)
	return user, nil
}

func (r *mutationResolver) DeleteUser(ctx context.Context, id string) (bool, error) {
	for i, u := range users {
		if u.ID == id {
			users = append(users[:i], users[i+1:]...)
			return true, nil
		}
	}
	return false, nil
}
```

---

### 4. サーバーを起動

```go
// server.go
package main

import (
	"log"
	"net/http"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/playground"
	"my-graphql-server/graph"
	"my-graphql-server/graph/generated"
)

func main() {
	srv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{
		Resolvers: &graph.Resolver{},
	}))

	http.Handle("/", playground.Handler("GraphQL Playground", "/query"))
	http.Handle("/query", srv)

	log.Println("Server running at http://localhost:8080/")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
```

```zsh
% go run server.go
```

`http://localhost:8080/` にアクセスすると GraphQL Playground が開く

---

## gqlgen.yml の主な設定

```yaml
# gqlgen.yml
schema:
  - graph/*.graphqls # Schema ファイルの場所

exec:
  filename: graph/generated/generated.go
  package: generated

model:
  filename: graph/model/models_gen.go
  package: model

resolver:
  layout: follow-schema # 各 schema ファイルに対応する resolver ファイルを生成
  dir: graph
  package: graph

# カスタム型マッピング（自動生成の代わりに既存の Go 型を使用）
models:
  ID:
    model:
      - github.com/99designs/gqlgen/graphql.ID
```

::: tip Schema 変更後のワークフロー

`.graphqls` ファイルを変更した後、`go tool gqlgen generate` を実行してコードを再生成する。gqlgen は新しい Resolver シグネチャの追加のみ行い、既に実装済みのビジネスロジックを上書きすることはない
:::
