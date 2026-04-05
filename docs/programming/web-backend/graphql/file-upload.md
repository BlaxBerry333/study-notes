# 文件上传

## 问题

GraphQL 的请求和响应都是 JSON，而 JSON 无法承载二进制文件。所以 GraphQL 本身没有文件上传功能，需要绕过 JSON 这一层来实现

常见的做法有三种，核心区别是**文件经不经过 GraphQL 服务端**：

```txt
方案一：签名 URL（文件不经过 GraphQL）
  Client ──▶ GraphQL: "给我上传凭证"
  Client ──▶ S3/OSS: 直接上传文件      ← 文件直传云存储
  Client ──▶ GraphQL: "文件传好了，记录一下"

方案二：graphql-upload（文件经过 GraphQL）
  Client ──▶ GraphQL: 文件 + 请求一起发   ← 文件先到 GraphQL 服务端

方案三：混合（文件走 REST，元数据走 GraphQL）
  Client ──▶ REST: 上传文件
  Client ──▶ GraphQL: 保存元数据
```

| 方案 | 文件经过 GraphQL | 适用场景 |
| --- | --- | --- |
| 签名 URL | 不经过 | 新项目、有云存储、大文件 |
| graphql-upload | 经过 | 小文件（头像、图标）、想简化流程 |
| 混合方案 | 不经过 | 已有 REST 上传服务 |

---

## 方案一：签名 URL

> 推荐方案

思路：GraphQL 只负责**生成上传凭证**和**保存文件记录**，文件本身由客户端直传到云存储（S3/OSS/GCS），不经过 GraphQL 服务端

分三步：

```txt
步骤                        做什么                           谁处理
─────────────────────────────────────────────────────────────────────
① getUploadUrl Mutation     获取预签名 URL 和文件标识         GraphQL
② PUT 文件                  客户端用预签名 URL 直传云存储     客户端 → S3
③ saveFile Mutation         告诉 GraphQL "文件传好了"         GraphQL
```

---

### 服务端

```graphql
type Mutation {
  getUploadUrl(input: GetUploadUrlInput!): UploadUrlPayload!
  saveFile(input: SaveFileInput!): File!
}

input GetUploadUrlInput {
  fileName: String!
  contentType: String!
}

type UploadUrlPayload {
  uploadUrl: String!     # 预签名 URL，客户端用这个直传文件
  fileKey: String!       # 文件在云存储中的路径标识
}

input SaveFileInput {
  fileKey: String!
  fileName: String!
  contentType: String!
  size: Int!
}
```

```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: "ap-northeast-1" });

const resolvers = {
  Mutation: {
    // ① 生成预签名 URL
    getUploadUrl: async (_, { input }) => {
      const fileKey = `uploads/${Date.now()}-${input.fileName}`;
      const command = new PutObjectCommand({
        Bucket: "my-bucket",
        Key: fileKey,
        ContentType: input.contentType,
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
      return { uploadUrl, fileKey };
    },

    // ③ 保存文件记录
    saveFile: async (_, { input }, { db }) => {
      return db.files.create({
        ...input,
        url: `https://my-bucket.s3.amazonaws.com/${input.fileKey}`,
      });
    },
  },
};
```

---

### 客户端

```ts
// ① 获取上传凭证
const { data } = await client.mutate({
  mutation: GET_UPLOAD_URL,
  variables: { input: { fileName: "photo.jpg", contentType: "image/jpeg" } },
});

// ② 直传到 S3（不经过 GraphQL 服务端）
await fetch(data.getUploadUrl.uploadUrl, {
  method: "PUT",
  body: file, // HTMLInputElement.files[0]
  headers: { "Content-Type": "image/jpeg" },
});

// ③ 告诉 GraphQL 文件传好了
await client.mutate({
  mutation: SAVE_FILE,
  variables: {
    input: {
      fileKey: data.getUploadUrl.fileKey,
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      size: file.size,
    },
  },
});
```

---

## 方案二：graphql-upload

文件通过 multipart/form-data 直接发送到 GraphQL 端点，一次请求完成。适合小文件场景

```zsh
% npm install graphql-upload
```

::: warning Apollo Server 4 兼容性

Apollo Server 4 移除了内置的文件上传支持，需要额外配置 Express 中间件（`graphqlUploadExpress`），不能直接用 `startStandaloneServer`
:::

---

### 服务端

```graphql
scalar Upload

type Mutation {
  uploadFile(file: Upload!): File!
}
```

```ts
import { GraphQLUpload } from "graphql-upload";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";

const resolvers = {
  Upload: GraphQLUpload,

  Mutation: {
    uploadFile: async (_, { file }) => {
      const { createReadStream, filename, mimetype } = await file;
      const path = `./uploads/${Date.now()}-${filename}`;

      await pipeline(createReadStream(), createWriteStream(path));

      return {
        id: "generated-id",
        url: path,
        fileName: filename,
        contentType: mimetype,
        size: 0,
      };
    },
  },
};
```

---

### 客户端

需要 `apollo-upload-client` 替换默认的 HTTP Link：

```ts
import { createUploadLink } from "apollo-upload-client";

// 替换默认的 httpLink（两者不能同时使用）
const client = new ApolloClient({
  link: createUploadLink({ uri: "http://localhost:4000/graphql" }),
  cache: new InMemoryCache(),
});

// 直接将 File 对象作为变量传递
await client.mutate({
  mutation: gql`
    mutation UploadFile($file: Upload!) {
      uploadFile(file: $file) { id url fileName }
    }
  `,
  variables: { file: selectedFile }, // HTMLInputElement.files[0]
});
```

::: danger 大文件风险

整个文件会加载到 GraphQL 服务端内存。上传 100MB 的文件 = 服务端内存多占 100MB。生产环境传大文件应该用签名 URL 方案
:::

---

## 方案三：混合方案

文件上传走已有的 REST 端点，GraphQL 只处理元数据。适合已有 REST 文件上传服务、不想改造的场景

```ts
// 1. REST 上传文件
const formData = new FormData();
formData.append("file", selectedFile);
const res = await fetch("/api/upload", { method: "POST", body: formData });
const { fileUrl } = await res.json();

// 2. GraphQL 保存元数据
await client.mutate({
  mutation: CREATE_POST,
  variables: {
    input: {
      title: "My Post",
      content: "...",
      coverImage: fileUrl, // 文件 URL 作为普通字符串传递
    },
  },
});
```
