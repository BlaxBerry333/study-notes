# gqlgen（Go）

> Go 语言的 Schema-First GraphQL 框架，自动生成类型安全的 Resolver 签名

## 下载安装

```zsh
% go get -tool github.com/99designs/gqlgen
```

---

## 项目初始化

```zsh
% mkdir my-graphql-server && cd my-graphql-server
% go mod init my-graphql-server
% go tool gqlgen init
```

生成的目录结构：

```txt
my-graphql-server/
├── gqlgen.yml              # gqlgen 配置
├── server.go               # HTTP 入口
└── graph/
    ├── schema.graphqls     # GraphQL Schema 定义
    ├── schema.resolvers.go # Resolver 实现（你写的业务逻辑）
    ├── resolver.go         # Resolver 根结构体
    ├── generated/          # 自动生成的运行时代码（不要手动修改）
    └── model/              # 自动生成的 Go 类型
```

---

## 基本流程

gqlgen 是 **Schema-First**：先写 Schema → 生成代码 → 实现 Resolver

---

### 1. 定义 Schema

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

### 2. 生成代码

```zsh
% go tool gqlgen generate
```

自动生成 Resolver 签名和 Go 类型，你只需实现 `schema.resolvers.go` 中的方法体

---

### 3. 实现 Resolver

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

### 4. 启动服务

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

访问 `http://localhost:8080/` 打开 GraphQL Playground

---

## gqlgen.yml 常用配置

```yaml
# gqlgen.yml
schema:
  - graph/*.graphqls # Schema 文件位置

exec:
  filename: graph/generated/generated.go
  package: generated

model:
  filename: graph/model/models_gen.go
  package: model

resolver:
  layout: follow-schema # 每个 schema 文件对应一个 resolver 文件
  dir: graph
  package: graph

# 自定义类型映射（用已有的 Go 类型替代自动生成）
models:
  ID:
    model:
      - github.com/99designs/gqlgen/graphql.ID
```

::: tip Schema 变更后的工作流

修改 `.graphqls` 文件后，执行 `go tool gqlgen generate` 重新生成代码。gqlgen 只会添加新的 Resolver 签名，不会覆盖你已实现的业务逻辑
:::
