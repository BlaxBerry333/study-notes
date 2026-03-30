# 文件上传

> GraphQL 规范本身不支持文件上传，需要借助额外方案实现

---

## 常见方案对比

| 方案             | 原理                                        | 优点                                     | 缺点                                           |
| ---------------- | ------------------------------------------- | ---------------------------------------- | ---------------------------------------------- |
| 签名 URL（推荐） | Mutation 获取上传 URL → 客户端直传 OSS/S3   | GraphQL 职责清晰、支持大文件、可断点续传 | 需要额外的存储服务配置                         |
| graphql-upload   | multipart/form-data 直接发送到 GraphQL 端点 | 一次请求完成、API 集中                   | 大文件占用服务端内存、Apollo Server 4 不再内置 |
| 混合方案         | 文件走 REST 端点，元数据走 GraphQL          | 各取所长、灵活                           | 需维护两套 API                                 |

---

## 方案一：签名 URL（推荐）

客户端通过 Mutation 获取预签名 URL，然后直接上传到云存储（S3、OSS、GCS 等），最后将文件地址回传给 GraphQL

```txt
客户端                      GraphQL Server              S3 / OSS
  │                              │                         │
  │── mutation getUploadUrl ───▶ │                         │
  │                              │── 生成预签名 URL ──────▶ │
  │◀── { uploadUrl, fileKey } ── │                         │
  │                              │                         │
  │── PUT 文件到 uploadUrl ──────────────────────────────▶ │
  │◀── 200 OK ──────────────────────────────────────────── │
  │                              │                         │
  │── mutation saveFile ───────▶ │                         │
  │   { fileKey, fileName }      │── 保存文件记录           │
  │◀── { file: { url, ... } } ── │                         │
```

---

### Schema 定义

```graphql
type Mutation {
  # 第一步：获取上传 URL
  getUploadUrl(input: GetUploadUrlInput!): UploadUrlPayload!
  # 第二步：上传完成后保存文件记录
  saveFile(input: SaveFileInput!): File!
}

input GetUploadUrlInput {
  fileName: String!
  contentType: String!
}

type UploadUrlPayload {
  uploadUrl: String!
  fileKey: String!
}

input SaveFileInput {
  fileKey: String!
  fileName: String!
  contentType: String!
  size: Int!
}

type File {
  id: ID!
  url: String!
  fileName: String!
  contentType: String!
  size: Int!
  createdAt: DateTime!
}
```

---

### 服务端 Resolver

```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: "ap-northeast-1" });

const resolvers = {
  Mutation: {
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

    saveFile: async (_, { input }, { db }) => {
      const file = await db.files.create({
        ...input,
        url: `https://my-bucket.s3.amazonaws.com/${input.fileKey}`,
      });
      return file;
    },
  },
};
```

---

### 客户端使用

```ts
// 1. 获取上传 URL
const { data } = await client.mutate({
  mutation: GET_UPLOAD_URL,
  variables: { input: { fileName: "photo.jpg", contentType: "image/jpeg" } },
});

// 2. 直传到 S3/OSS
await fetch(data.getUploadUrl.uploadUrl, {
  method: "PUT",
  body: file,
  headers: { "Content-Type": "image/jpeg" },
});

// 3. 保存文件记录
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

通过 multipart 请求直接将文件发送到 GraphQL 端点

```zsh
% npm install graphql-upload
```

---

### Schema 定义

```graphql
scalar Upload

type Mutation {
  uploadFile(file: Upload!): File!
}
```

---

### 服务端 Resolver

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

      // 将文件流写入磁盘
      await pipeline(createReadStream(), createWriteStream(path));

      return {
        id: "generated-id",
        url: path,
        fileName: filename,
        contentType: mimetype,
        size: 0, // 需从文件流中获取
      };
    },
  },
};
```

---

### 客户端使用（Apollo Client）

```ts
import { createUploadLink } from "apollo-upload-client";

const client = new ApolloClient({
  link: createUploadLink({ uri: "http://localhost:4000/graphql" }),
  cache: new InMemoryCache(),
});

// 直接将 File 对象作为变量传递
const UPLOAD_FILE = gql`
  mutation UploadFile($file: Upload!) {
    uploadFile(file: $file) {
      id
      url
      fileName
    }
  }
`;

await client.mutate({
  mutation: UPLOAD_FILE,
  variables: { file: selectedFile }, // HTMLInputElement.files[0]
});
```

::: warning 注意

- Apollo Server 4 移除了内置的文件上传支持，需要额外中间件集成
- 大文件上传会占用服务端内存，生产环境建议使用签名 URL 方案
- `apollo-upload-client` 替换了默认的 `httpLink`，不能同时使用
:::

---

## 方案三：混合方案

文件上传走 REST，文件元数据走 GraphQL

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
      coverImage: fileUrl, // 将文件 URL 作为普通字符串传递
    },
  },
});
```

适合已有 REST 文件上传服务、不想改造的场景
